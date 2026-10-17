// Saúde da transmissão lida do obs-websocket (v5): tempo no ar, fps, CPU e rede (upload e congestionamento), incluindo os destinos do
// plugin de multistream (obs-multi-rtmp), que o OBS não conta como "a transmissão": cada destino é uma saída própria, todas com o mesmo
// nome, então só dá pra consultar o status da primeira delas (os destinos começam juntos, o tempo vale pra todos). Também para tudo.
import { sha256Base64 } from './sha256.js';
import { saudeDeAmostras, qualidadeDeQuadros } from './lives.js';

const INTERVALO_MS = 3000;
const REENVIO_MS = 15000;
const TIPOS_DE_TRANSMISSAO = new Set(['rtmp_output', 'ffmpeg_output', 'srt_output', 'rist_output']);
const NOMES_DA_PRINCIPAL = new Set(['adv_stream', 'simple_stream']);

// Uma conexão que autentica e responde a pedidos por requestId. `aoFechar` roda quando a conexão cai.
function abrirConexao({ url, senha }, aoFechar) {
  const pendentes = new Map();
  let proximo = 0;
  let ws;
  const pronta = new Promise((resolve, reject) => {
    try { ws = new WebSocket(url); } catch (_) { reject(new Error('endereço do OBS inválido')); return; }
    ws.onerror = () => reject(new Error('não consegui falar com o OBS (servidor WebSocket desligado?)'));
    ws.onclose = () => {
      reject(new Error('o OBS fechou a conexão'));
      pendentes.forEach(p => p.reject(new Error('o OBS fechou a conexão')));
      pendentes.clear();
      if (aoFechar) aoFechar();
    };
    ws.onmessage = async ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (m.op === 0) {
        const identificar = { rpcVersion: 1, eventSubscriptions: 0 };
        const a = m.d && m.d.authentication;
        if (a) {
          if (!senha) { reject(new Error('o OBS pede senha: coloque a do servidor WebSocket nas configurações')); return; }
          identificar.authentication = await sha256Base64((await sha256Base64(senha + a.salt)) + a.challenge);
        }
        ws.send(JSON.stringify({ op: 1, d: identificar }));
      } else if (m.op === 2) {
        resolve();
      } else if (m.op === 7) {
        const p = pendentes.get(m.d.requestId);
        if (!p) return;
        pendentes.delete(m.d.requestId);
        if (m.d.requestStatus && m.d.requestStatus.result) p.resolve(m.d.responseData || {});
        else p.reject(new Error((m.d.requestStatus && m.d.requestStatus.comment) || 'o OBS recusou o pedido'));
      }
    };
  });
  const pedir = (requestType, requestData) => new Promise((resolve, reject) => {
    const id = `p${++proximo}`;
    pendentes.set(id, { resolve, reject });
    ws.send(JSON.stringify({ op: 6, d: { requestType, requestId: id, requestData } }));
  });
  return { pronta, pedir, fechar: () => { try { ws.close(); } catch (_) { /* já fechada */ } } };
}

const ehTransmissao = o => o && TIPOS_DE_TRANSMISSAO.has(o.outputKind);

// Lê o OBS a cada INTERVALO_MS e chama aoAtualizar(saude): { conectado, erro?, ativo, ms, fps, cpu, destinos, kbps, perdaPct, congestao,
// reconectando, renderPct, encoderPct, msPorQuadro, principalAtiva, msPrincipal, msDestinos }. `ms` é o tempo da transmissão: o da principal do OBS e, sem ela, o dos destinos; `destinos` é quantas saídas de transmissão estão no ar.
// Devolve a função que encerra a leitura.
export function observarSaudeDoObs(config, aoAtualizar) {
  let parado = false;
  let conexao = null;
  let temporizador = null;
  let amostraAnterior = null;
  let statsAnterior = null;

  async function ciclo() {
    try {
      const [stats, principal, lista] = await Promise.all([conexao.pedir('GetStats'), conexao.pedir('GetStreamStatus'), conexao.pedir('GetOutputList')]);
      const ativas = (lista.outputs || []).filter(o => ehTransmissao(o) && o.outputActive);
      const nomesDeDestinos = [...new Set(ativas.filter(o => !NOMES_DA_PRINCIPAL.has(o.outputName)).map(o => o.outputName))];
      const statusDeDestino = nomesDeDestinos.length ? await conexao.pedir('GetOutputStatus', { outputName: nomesDeDestinos[0] }).catch(() => null) : null;
      const medido = principal.outputActive ? principal : statusDeDestino && statusDeDestino.outputActive ? statusDeDestino : null;
      // A principal (a Twitch, que sai pelo botão nativo do OBS) é a fonte do tempo e da rede; os destinos do multistream (YouTube e Kick) são a reserva.
      const msPrincipal = principal.outputActive ? principal.outputDuration || 0 : 0;
      const msDestinos = statusDeDestino && statusDeDestino.outputActive ? statusDeDestino.outputDuration || 0 : 0;
      let saude = { kbps: null, perdaPct: null };
      if (medido) {
        const amostra = { bytes: medido.outputBytes || 0, quadros: medido.outputTotalFrames || 0, perdidos: medido.outputSkippedFrames || 0, ms: Date.now() };
        saude = saudeDeAmostras(amostraAnterior, amostra) || saude;
        amostraAnterior = amostra;
      } else {
        amostraAnterior = null;
      }
      const quadros = { renderPulados: stats.renderSkippedFrames || 0, renderTotal: stats.renderTotalFrames || 0, encoderPulados: stats.outputSkippedFrames || 0, encoderTotal: stats.outputTotalFrames || 0 };
      const qualidade = qualidadeDeQuadros(statsAnterior, quadros) || { renderPct: 0, encoderPct: 0 };
      statsAnterior = quadros;
      aoAtualizar({
        conectado: true, lidoEm: Date.now(), renderPct: qualidade.renderPct, encoderPct: qualidade.encoderPct, msPorQuadro: stats.averageFrameRenderTime ?? null, ativo: ativas.length > 0, principalAtiva: Boolean(principal.outputActive), msPrincipal, msDestinos, ms: msPrincipal || msDestinos, destinos: ativas.length,
        fps: stats.activeFps ?? null, cpu: stats.cpuUsage ?? null,
        kbps: saude.kbps, perdaPct: saude.perdaPct, congestao: medido ? medido.outputCongestion ?? null : null,
        reconectando: Boolean((principal && principal.outputReconnecting) || (statusDeDestino && statusDeDestino.outputReconnecting)),
      });
    } catch (erro) {
      if (!parado) aoAtualizar({ conectado: false, erro: erro.message });
    }
  }

  function conectar() {
    if (parado) return;
    conexao = abrirConexao(config, () => {
      clearInterval(temporizador);
      if (!parado) setTimeout(conectar, REENVIO_MS);
    });
    conexao.pronta.then(() => {
      if (parado) { conexao.fechar(); return; }
      ciclo();
      temporizador = setInterval(ciclo, INTERVALO_MS);
    }).catch(erro => {
      if (!parado) aoAtualizar({ conectado: false, erro: erro.message });
    });
  }
  conectar();
  return () => {
    parado = true;
    clearInterval(temporizador);
    if (conexao) conexao.fechar();
  };
}

// Inicia a transmissão principal do OBS (o mesmo que o botão Iniciar transmissão dele); os destinos do multistream (obs-multi-rtmp) começam
// junto quando têm "sincronizar início" ligado no plugin. Devolve { ok, jaEstava?, erro? }.
export async function iniciarTransmissao(config) {
  const conexao = abrirConexao(config);
  try {
    await conexao.pronta;
    const status = await conexao.pedir('GetStreamStatus');
    if (status.outputActive) return { ok: true, jaEstava: true };
    await conexao.pedir('StartStream');
    return { ok: true, jaEstava: false };
  } catch (erro) {
    return { ok: false, erro: erro.message };
  } finally {
    conexao.fechar();
  }
}

const MARGEM_DE_PARADA_S = 15; // além do delay, quanto esperar as saídas terminarem de fechar antes de dar o pedido por não cumprido

// O delay de transmissão configurado no OBS, em segundos (0 se desligado ou se a leitura falhar).
async function delayDoObs(conexao) {
  try {
    const ligado = await conexao.pedir('GetProfileParameter', { parameterCategory: 'Output', parameterName: 'DelayEnable' });
    if (String(ligado.parameterValue) !== 'true') return 0;
    const segundos = await conexao.pedir('GetProfileParameter', { parameterCategory: 'Output', parameterName: 'DelaySec' });
    return Math.max(0, Number(segundos.parameterValue) || 0);
  } catch (_) {
    return 0;
  }
}

const saidasNoAr = lista => (lista.outputs || []).filter(o => ehTransmissao(o) && o.outputActive);

// Para a transmissão do jeito do botão do OBS, sem forçar: o pedido é dado uma vez (StopStream na principal; os destinos do multistream
// acompanham com "sincronizar início e fim", e sem a principal no ar vale um StopOutput) e o OBS segue enviando o que está no delay antes de
// fechar a conexão. Daí a função espera as saídas deixarem de estar no ar (o delay mais MARGEM_DE_PARADA_S) e avisa o andamento em
// aoProgresso({ delayS, restantes, esperouS }). Devolve { ok, delayS, erro? }. Os destinos têm todos o nome "multi-output", então só dá pra
// pedir a parada de um deles por fora; se sobrarem, o aviso manda parar pelo plugin.
export async function pararTransmissoes(config, aoProgresso = () => {}) {
  const conexao = abrirConexao(config);
  try {
    await conexao.pronta;
    const delayS = await delayDoObs(conexao);
    const principal = await conexao.pedir('GetStreamStatus');
    const lista = await conexao.pedir('GetOutputList');
    if (principal.outputActive) await conexao.pedir('StopStream');
    else if (saidasNoAr(lista).length) await conexao.pedir('StopOutput', { outputName: saidasNoAr(lista)[0].outputName }).catch(() => {});
    else return { ok: true, delayS, nadaNoAr: true };

    const limiteMs = (delayS + MARGEM_DE_PARADA_S) * 1000;
    const inicio = Date.now();
    for (;;) {
      const restantes = saidasNoAr(await conexao.pedir('GetOutputList')).length;
      const esperouS = Math.floor((Date.now() - inicio) / 1000);
      aoProgresso({ delayS, restantes, esperouS });
      if (restantes === 0) return { ok: true, delayS };
      if (Date.now() - inicio > limiteMs) {
        return { ok: false, delayS, erro: `${restantes} saída(s) ainda no ar depois de ${esperouS} s: pare o que sobrou pelo plugin de multistream (Painéis > Múltiplas saídas)` };
      }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (erro) {
    return { ok: false, delayS: 0, erro: erro.message };
  } finally {
    conexao.fechar();
  }
}
