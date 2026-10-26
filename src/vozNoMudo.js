// "Você está falando no mudo": com o microfone no mudo, o OBS zera a magnitude e o pico do medidor de volume (evento InputVolumeMeters), mas o **pico da entrada** (o
// terceiro valor de cada canal) continua mostrando o som que o microfone capta (conferido no OBS 32 com o obs-websocket 5.7). Se há voz por um instante, a caixinha do
// microfone pisca. Sem rede nem React: obsSaude.js entrega as medições (a cada ~50 ms) e lê o resultado.
//
// O limiar acompanha o ruído da sala: vale o maior entre LIMIAR_MINIMO (-42 dB) e 4 vezes o ruído de fundo medido (+12 dB), sem passar de LIMIAR_MAXIMO (-30 dB), então um
// microfone de ganho baixo e um de ganho alto avisam igual. Avisa quando MINIMO_NA_JANELA das últimas JANELA medições (~0,5 s) passam do limiar: voz de verdade conta, um estalo ou uma tosse isolada não.

export const LIMIAR_MINIMO = 0.008;     // -42 dB: abaixo disso nunca é voz, mesmo numa sala muito silenciosa
export const LIMIAR_MAXIMO = 0.03;      // -30 dB: o limiar nunca passa disso (uma sala barulhenta ou uma fala longa não pode esconder a própria voz)
export const FATOR_SOBRE_O_RUIDO = 4;   // +12 dB acima do ruído de fundo
export const JANELA = 10;               // medições olhadas (~0,5 s)
export const MINIMO_NA_JANELA = 4;      // quantas delas precisam passar do limiar
export const APAGAR_DEPOIS_MS = 1500;   // sem som por esse tempo, o aviso apaga
const HISTORICO_DO_RUIDO = 100;         // ~5 s de medições para estimar o ruído de fundo

export const emDb = nivel => (nivel > 0 ? 20 * Math.log10(nivel) : -Infinity);

// O maior nível da entrada `nome` no medidor ({ inputs: [{ inputName, inputLevelsMul: [[magnitude, pico, pico-da-entrada], ...] }] }), canal por canal. Vale o pico da
// entrada (e, sem ele, o pico e a magnitude); abaixar o volume no mixer ou colocar no mudo não esconde a voz. null se a entrada não está no medidor.
export function nivelDaEntrada(dados, nome) {
  const inputs = dados && Array.isArray(dados.inputs) ? dados.inputs : [];
  const entrada = inputs.find(i => i && i.inputName === nome);
  if (!entrada || !Array.isArray(entrada.inputLevelsMul)) return null;
  let maior = 0;
  for (const canal of entrada.inputLevelsMul) {
    if (!Array.isArray(canal)) continue;
    const v = [canal[2], canal[1], canal[0]].find(x => typeof x === 'number' && Number.isFinite(x));
    if (v !== undefined && v > maior) maior = v;
  }
  return maior;
}

// Um detector que guarda o estado entre uma medição e outra. processar(dados, nome, agora) devolve se está falando; expirar(agora) apaga o aviso passado o tempo sem som.
export function criarDetector() {
  let recentes = [];   // as últimas medições passaram do limiar? (true ou false)
  let niveis = [];     // os últimos níveis, para estimar o ruído de fundo
  let ultimoSom = 0;
  let falando = false;
  let maximo = 0;

  // O ruído de fundo: o nível que só é superado por 1 em cada 4 medições recentes (voz fica acima dele, o chiado em volta dele).
  const ruido = () => {
    if (niveis.length < 20) return 0;
    const ordenados = [...niveis].sort((a, b) => a - b);
    return ordenados[Math.floor(ordenados.length * 0.25)];
  };
  const limiar = () => Math.min(LIMIAR_MAXIMO, Math.max(LIMIAR_MINIMO, ruido() * FATOR_SOBRE_O_RUIDO));

  return {
    processar(dados, nome, agora) {
      const nivel = nivelDaEntrada(dados, nome);
      if (nivel === null) return falando;
      maximo = Math.max(maximo, nivel);
      const passou = nivel > limiar();
      recentes.push(passou);
      if (recentes.length > JANELA) recentes.shift();
      if (passou) ultimoSom = agora;
      // o ruído de fundo aprende com todas as medições (é o quarto mais baixo delas, então a voz quase não o move); o limiar tem teto, LIMIAR_MAXIMO
      niveis.push(nivel);
      if (niveis.length > HISTORICO_DO_RUIDO) niveis.shift();
      if (recentes.filter(Boolean).length >= MINIMO_NA_JANELA) falando = true;
      return falando;
    },
    expirar(agora) {
      if (falando && agora - ultimoSom > APAGAR_DEPOIS_MS) { falando = false; recentes = []; }
      return falando;
    },
    zerar() { recentes = []; niveis = []; ultimoSom = 0; falando = false; maximo = 0; },
    get falando() { return falando; },
    get limiar() { return limiar(); },
    get ruido() { return ruido(); },
    get maximo() { return maximo; },
  };
}

// O resultado do teste do aviso (testarAvisoDoMic em obsSaude.js) em português, para a tela de configurações. r = { ok, erro?, medicoes, mudo, maxDb, limiarDb, avisaria }.
// Devolve { nivel, texto } (0 = funciona, 1 = aviso, 2 = erro).
export function textoDoTesteDoMic(r, entrada) {
  const db = x => (Number.isFinite(x) ? `${Math.round(x)} dB` : 'sem som');
  if (!r.ok) return { nivel: 2, texto: `Não consegui testar: ${r.erro || 'o OBS não respondeu'}.` };
  if (r.medicoes === 0) return { nivel: 2, texto: `O OBS não mandou medições de “${entrada}”: confira se a entrada existe e está ativa (um microfone desligado no Windows não manda nada).` };
  if (r.avisaria) return { nivel: 0, texto: `O aviso funciona: o nível mais alto foi ${db(r.maxDb)}.${r.mudo ? '' : ' O microfone está aberto agora; no mudo, a caixinha piscaria.'}` };
  if (!Number.isFinite(r.maxDb) || r.maxDb < -60) return { nivel: 1, texto: `Quase não chegou som (${db(r.maxDb)}): confira se o microfone está ligado e fale mais perto.` };
  return { nivel: 1, texto: `O nível mais alto foi ${db(r.maxDb)}, abaixo do que o aviso pede (${db(r.limiarDb)}). Fale mais alto ou suba o ganho do microfone no OBS.` };
}
