// Saúde da transmissão lida do obs-websocket (v5): tempo no ar, fps, CPU e rede (upload e congestionamento), incluindo os destinos do
// plugin de multistream (obs-multi-rtmp), que o OBS não conta como "a transmissão": cada destino é uma saída própria, todas com o mesmo
// nome, então só dá pra consultar o status da primeira delas (os destinos começam juntos, o tempo vale pra todos). Também para tudo.
import { sha256Base64 } from './sha256.js';
import { saudeDeAmostras, qualidadeDeQuadros } from './lives.js';
import { criarDetector, emDb, nivelDaEntrada } from './vozNoMudo.js';

const INTERVALO_MS = 3000;
const REENVIO_MS = 15000;
const TIPOS_DE_TRANSMISSAO = new Set(['rtmp_output', 'ffmpeg_output', 'srt_output', 'rist_output']);
const NOMES_DA_PRINCIPAL = new Set(['adv_stream', 'simple_stream']);

// Uma conexão que autentica e responde a pedidos por requestId. `aoFechar` roda quando a conexão cai. `eventos` é a máscara de assinatura do
// obs-websocket (0 = nenhum evento; 8 = os das entradas, como o mudo do microfone) e `aoEvento` recebe cada evento ({ eventType, eventData }).
function abrirConexao({ url, senha }, aoFechar, { eventos = 0, aoEvento } = {}) {
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
        const identificar = { rpcVersion: 1, eventSubscriptions: eventos };
        const a = m.d && m.d.authentication;
        if (a) {
          if (!senha) { reject(new Error('o OBS pede senha: coloque a do servidor WebSocket nas configurações')); return; }
          identificar.authentication = await sha256Base64((await sha256Base64(senha + a.salt)) + a.challenge);
        }
        ws.send(JSON.stringify({ op: 1, d: identificar }));
      } else if (m.op === 2) {
        resolve();
      } else if (m.op === 5) {
        if (aoEvento) aoEvento(m.d);
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
  // Troca os eventos assinados sem reconectar (op 3, Reidentify): o medidor de volume só é assinado enquanto o microfone está no mudo.
  const reidentificar = novosEventos => { try { ws.send(JSON.stringify({ op: 3, d: { eventSubscriptions: novosEventos } })); } catch (_) { /* conexão caindo */ } };
  return { pronta, pedir, reidentificar, fechar: () => { try { ws.close(); } catch (_) { /* já fechada */ } } };
}

const ehTransmissao = o => o && TIPOS_DE_TRANSMISSAO.has(o.outputKind);
const EVENTOS_DAS_ENTRADAS = 8;      // InputMuteStateChanged e os outros eventos das entradas de áudio do OBS
const EVENTO_DO_MEDIDOR = 1 << 16;    // InputVolumeMeters (alto volume: o OBS manda a cada ~50 ms), só assinado com o microfone no mudo

// Lê o OBS a cada INTERVALO_MS e chama aoAtualizar(saude): { conectado, erro?, ativo, ms, fps, cpu, destinos, kbps, perdaPct, congestao,
// reconectando, renderPct, encoderPct, msPorQuadro, principalAtiva, msPrincipal, msDestinos, micMudo, micErro }. Com `config.mic` (o nome da entrada
// de áudio do microfone no OBS), lê também se ela está no mudo: `micMudo` é true, false ou null (sem entrada de microfone ou não achada, e então
// `micErro` diz o motivo); o evento do OBS atualiza na hora, sem esperar o próximo ciclo. `ms` é o tempo da transmissão: o da principal do OBS e, sem ela, o dos destinos; `destinos` é quantas saídas de transmissão estão no ar.
// Devolve a função que encerra a leitura.
export function observarSaudeDoObs(config, aoAtualizar) {
  let parado = false;
  let conexao = null;
  let temporizador = null;
  let amostraAnterior = null;
  let statsAnterior = null;
  let ultima = null; // a última saúde entregue: o evento de mudo a reaproveita
  const entregar = saude => { ultima = saude; aoAtualizar(saude); };
  // "Falando no mudo": com o microfone no mudo (e o aviso ligado), assina o medidor de volume e avisa quando há voz (vozNoMudo.js).
  const detector = criarDetector();
  let medidorAssinado = false;
  let relogioDoAviso = null;
  function ajustarMedidor(mudo) {
    const quer = Boolean(config.mic && config.avisoNoMudo && mudo);
    if (quer === medidorAssinado || !conexao) return;
    medidorAssinado = quer;
    conexao.reidentificar(EVENTOS_DAS_ENTRADAS | (quer ? EVENTO_DO_MEDIDOR : 0));
    clearInterval(relogioDoAviso);
    if (quer) {
      relogioDoAviso = setInterval(() => {
        if (!detector.falando) return;
        if (!detector.expirar(Date.now()) && ultima && ultima.conectado) entregar({ ...ultima, falandoNoMudo: false });
      }, 500);
    } else {
      detector.zerar();
      if (ultima && ultima.falandoNoMudo) entregar({ ...ultima, falandoNoMudo: false });
    }
  }

  async function ciclo() {
    try {
      // O mudo do microfone nunca derruba a leitura da saúde: sem entrada, ou com o nome errado, só vira micErro.
      const lerMic = config.mic
        ? conexao.pedir('GetInputMute', { inputName: config.mic }).then(r => ({ mudo: Boolean(r.inputMuted) }), e => ({ erro: e.message }))
        : Promise.resolve(null);
      const [stats, principal, lista, mic] = await Promise.all([conexao.pedir('GetStats'), conexao.pedir('GetStreamStatus'), conexao.pedir('GetOutputList'), lerMic]);
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
      ajustarMedidor(mic && !mic.erro ? mic.mudo : false);
      entregar({
        conectado: true, lidoEm: Date.now(), micMudo: mic && !mic.erro ? mic.mudo : null, micErro: mic && mic.erro ? mic.erro : '', falandoNoMudo: Boolean(ultima && ultima.falandoNoMudo && medidorAssinado), renderPct: qualidade.renderPct, encoderPct: qualidade.encoderPct, msPorQuadro: stats.averageFrameRenderTime ?? null, ativo: ativas.length > 0, principalAtiva: Boolean(principal.outputActive), msPrincipal, msDestinos, ms: msPrincipal || msDestinos, destinos: ativas.length,
        fps: stats.activeFps ?? null, cpu: stats.cpuUsage ?? null,
        kbps: saude.kbps, perdaPct: saude.perdaPct, congestao: medido ? medido.outputCongestion ?? null : null,
        reconectando: Boolean((principal && principal.outputReconnecting) || (statusDeDestino && statusDeDestino.outputReconnecting)),
      });
    } catch (erro) {
      if (!parado) entregar({ conectado: false, erro: erro.message });
    }
  }

  function conectar() {
    if (parado) return;
    const aoEvento = d => {
      if (d.eventType === 'InputMuteStateChanged' && config.mic && d.eventData && d.eventData.inputName === config.mic && ultima && ultima.conectado) {
        const mudo = Boolean(d.eventData.inputMuted);
        ajustarMedidor(mudo);
        entregar({ ...ultima, micMudo: mudo, micErro: '', falandoNoMudo: mudo ? Boolean(ultima.falandoNoMudo) : false });
      } else if (d.eventType === 'InputVolumeMeters' && config.mic && medidorAssinado && ultima && ultima.conectado && ultima.micMudo) {
        const falando = detector.processar(d.eventData, config.mic, Date.now());
        if (falando !== Boolean(ultima.falandoNoMudo)) entregar({ ...ultima, falandoNoMudo: falando });
      }
    };
    conexao = abrirConexao(config, () => {
      clearInterval(temporizador);
      if (!parado) setTimeout(conectar, REENVIO_MS);
    }, { eventos: config.mic ? EVENTOS_DAS_ENTRADAS : 0, aoEvento });
    conexao.pronta.then(() => {
      if (parado) { conexao.fechar(); return; }
      ciclo();
      temporizador = setInterval(ciclo, INTERVALO_MS);
    }).catch(erro => {
      if (!parado) entregar({ conectado: false, erro: erro.message });
    });
  }
  conectar();
  return () => {
    parado = true;
    clearInterval(temporizador);
    clearInterval(relogioDoAviso);
    if (conexao) conexao.fechar();
  };
}

// Para "Verificar configuração": o OBS responde? (versão) e, com um microfone escolhido, a entrada existe? Devolve { ok, versao, erro?, micOk? }.
export async function verificarObs(config) {
  const conexao = abrirConexao(config);
  try {
    await conexao.pronta;
    const v = await conexao.pedir('GetVersion');
    let micOk = false;
    if (config.mic) micOk = await conexao.pedir('GetInputMute', { inputName: config.mic }).then(() => true, () => false);
    return { ok: true, versao: String(v.obsVersion || ''), micOk };
  } catch (erro) {
    return { ok: false, erro: erro.message };
  } finally {
    conexao.fechar();
  }
}

// Teste do aviso de voz no mudo (Configurações > Mudo do microfone): ouve o medidor da entrada por `ms` e diz até onde chegou a voz e se o aviso teria disparado. Não depende
// de o microfone estar no mudo (o pico da entrada aparece nos dois casos). Devolve { ok, erro?, medicoes, mudo, maxDb, limiarDb, avisaria }.
export async function testarAvisoDoMic(config, ms = 5000) {
  const detector = criarDetector();
  let medicoes = 0;
  const conexao = abrirConexao(config, undefined, {
    eventos: EVENTOS_DAS_ENTRADAS | EVENTO_DO_MEDIDOR,
    aoEvento: d => {
      if (d.eventType !== 'InputVolumeMeters' || nivelDaEntrada(d.eventData, config.mic) === null) return;
      medicoes++;
      detector.processar(d.eventData, config.mic, Date.now());
    },
  });
  try {
    await conexao.pronta;
    const estado = await conexao.pedir('GetInputMute', { inputName: config.mic }).then(r => ({ mudo: Boolean(r.inputMuted) }), e => ({ erro: e.message }));
    if (estado.erro) return { ok: false, erro: `o OBS não achou a entrada “${config.mic}”` };
    await new Promise(r => setTimeout(r, ms));
    return { ok: true, medicoes, mudo: estado.mudo, maxDb: emDb(detector.maximo), limiarDb: emDb(detector.limiar), avisaria: detector.falando };
  } catch (erro) {
    return { ok: false, erro: erro.message };
  } finally {
    conexao.fechar();
  }
}

// Liga ou tira do mudo a entrada de áudio `nome` (o microfone escolhido nas configurações), com uma conexão só para isso. Devolve { ok, mudo?, erro? }:
// `mudo` é o estado novo, como o OBS o deixou.
export async function alternarMudoDaEntrada(config, nome) {
  const conexao = abrirConexao(config);
  try {
    await conexao.pronta;
    const r = await conexao.pedir('ToggleInputMute', { inputName: nome });
    return { ok: true, mudo: Boolean(r.inputMuted) };
  } catch (erro) {
    return { ok: false, erro: erro.message };
  } finally {
    conexao.fechar();
  }
}

// As entradas do OBS (fontes com áudio ou não: o OBS não diz qual é o microfone), as de captura de áudio primeiro, para a pessoa escolher o microfone nas
// configurações. Devolve { ok, entradas: [{ nome, tipo }], erro? }.
export async function listarEntradasDoObs(config) {
  const conexao = abrirConexao(config);
  try {
    await conexao.pronta;
    const r = await conexao.pedir('GetInputList');
    const entradas = (r.inputs || []).map(i => ({ nome: String(i.inputName), tipo: String(i.unversionedInputKind || i.inputKind || '') }));
    const ehAudio = i => /audio|wasapi|pulse|alsa|coreaudio|jack|dshow/i.test(i.tipo);
    entradas.sort((a, b) => Number(ehAudio(b)) - Number(ehAudio(a)));
    return { ok: true, entradas };
  } catch (erro) {
    return { ok: false, entradas: [], erro: erro.message };
  } finally {
    conexao.fechar();
  }
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
