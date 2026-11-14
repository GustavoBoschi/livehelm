// Comandos do campo do chat que mudam o modo da Twitch (só emotes, só inscritos, lento, só seguidores e modo escudo): a conta de /emotes, /subs, /lento, /seguidores e /escudo.
// Sem React nem rede; o envio é o de definirModoDoChat (acoes.js, ação `Painel: Controles`). A Kick e o YouTube não têm estes controles no Streamer.bot: valem só na Twitch.

export const COMANDOS_DE_MODO = '/emotes · /subs · /lento [segundos] · /seguidores [minutos] · /escudo (on ou off liga e desliga; sem nada, alterna)';

const NOMES = {
  emotes: 'emotes', emote: 'emotes', emoteonly: 'emotes',
  subs: 'inscritos', sub: 'inscritos', inscritos: 'inscritos', subonly: 'inscritos', subscribers: 'inscritos',
  lento: 'lento', slow: 'lento',
  seguidores: 'seguidores', followers: 'seguidores',
  escudo: 'escudo', shield: 'escudo',
};
const ROTULOS = { emotes: 'Só emotes', inscritos: 'Só inscritos', lento: 'Modo lento', seguidores: 'Só seguidores', escudo: 'Modo escudo' };
const LIGAR = ['on', 'ligar', 'liga', 'ligado', 'sim', '1', 'true'];
const DESLIGAR = ['off', 'desligar', 'desliga', 'desligado', 'nao', 'não', '0', 'false'];

export const rotuloDoModo = modo => ROTULOS[modo] || modo;

// `texto` é o que foi digitado (começa com /). `estado` é o que foi enviado por último ({ emotes: true, ... }) para o comando sem argumento alternar. `opcoes` traz os tempos
// das configurações (modo lento e só seguidores) para quando o comando não diz. Devolve null se não é um comando de modo, { erro } se está mal escrito, ou
// { modo, ligar, segundos, minutos, rotulo }.
export function interpretarModoDoChat(texto, estado = {}, { lentoSegundos = 30, seguidoresMinutos = 0 } = {}) {
  const partes = String(texto || '').trim().slice(1).split(/\s+/).filter(Boolean);
  const modo = NOMES[(partes[0] || '').toLowerCase()];
  if (!modo) return null;
  const rotulo = ROTULOS[modo];
  const arg = (partes[1] || '').toLowerCase();
  const resultado = { modo, ligar: !estado[modo], segundos: lentoSegundos, minutos: seguidoresMinutos, rotulo };
  if (arg === '') return resultado;
  // os números vêm antes do on/off: "0" e "1" são tempos aqui (/seguidores 0 = todos os seguidores; /lento 0 = desligar)
  if (/^\d+$/.test(arg) && modo === 'lento') {
    const s = Number(arg);
    if (s === 0) return { ...resultado, ligar: false };
    if (s < 3 || s > 120) return { erro: 'Modo lento: de 3 a 120 segundos (/lento 30), ou /lento off' };
    return { ...resultado, ligar: true, segundos: s };
  }
  if (/^\d+$/.test(arg) && modo === 'seguidores') {
    const m = Number(arg);
    if (m > 129600) return { erro: 'Só seguidores: até 129600 minutos (3 meses). Use /seguidores 30, ou /seguidores off' };
    return { ...resultado, ligar: true, minutos: m };
  }
  if (LIGAR.includes(arg)) return { ...resultado, ligar: true };
  if (DESLIGAR.includes(arg)) return { ...resultado, ligar: false };
  return { erro: `${rotulo}: use ${partes[0]} on, ${partes[0]} off${modo === 'lento' ? ', /lento 30' : modo === 'seguidores' ? ', /seguidores 30' : ''} ou só ${partes[0]} para alternar` };
}
