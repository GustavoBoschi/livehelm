// Os comandos que o campo do chat entende e a lista que aparece quando a pessoa digita "/": só os que valem para as plataformas do chat aberto (a aba escolhida, ou as
// plataformas ativas no alto). Sem React nem rede. A execução de cada um está em ChatPanel.jsx (enviar) e comandosDeModo.js.

const TRES = ['twitch', 'kick', 'youtube'];

// nome (o que se digita depois da barra), apelidos, uso, descricao, plataformas (onde vale; `local` = vale sempre, só mexe no dock) e `controles` (precisa da ação Painel: Controles).
export const COMANDOS_DO_CHAT = [
  { nome: 'ban', apelidos: ['banir'], uso: '/ban nome [motivo]', descricao: 'Bane a pessoa do chat (sem motivo: Violar as Regras do Chat)', plataformas: TRES },
  { nome: 'timeout', apelidos: ['silenciar'], uso: '/timeout nome segundos [motivo]', descricao: 'Silencia a pessoa (10 min se não disser o tempo)', plataformas: TRES },
  { nome: 'limpar', apelidos: ['clear'], uso: '/limpar', descricao: 'Limpa o chat da Twitch', plataformas: ['twitch'] },
  { nome: 'emotes', apelidos: ['emote', 'emoteonly'], uso: '/emotes [on|off]', descricao: 'Modo só emotes (sem on ou off, alterna)', plataformas: ['twitch'], controles: true },
  { nome: 'subs', apelidos: ['sub', 'inscritos', 'subonly'], uso: '/subs [on|off]', descricao: 'Modo só inscritos', plataformas: ['twitch'], controles: true },
  { nome: 'lento', apelidos: ['slow'], uso: '/lento [segundos|off]', descricao: 'Modo lento (3 a 120 segundos)', plataformas: ['twitch'], controles: true },
  { nome: 'seguidores', apelidos: ['followers'], uso: '/seguidores [minutos|off]', descricao: 'Modo só seguidores (0 = todos os seguidores)', plataformas: ['twitch'], controles: true },
  { nome: 'escudo', apelidos: ['shield'], uso: '/escudo [on|off]', descricao: 'Modo escudo da Twitch', plataformas: ['twitch'], controles: true },
  { nome: 'limpardock', apelidos: ['limparlocal'], uso: '/limpardock', descricao: 'Esvazia só a lista de mensagens daqui (nada é apagado nas plataformas)', local: true },
  { nome: 'limparresgates', apelidos: ['limparresgate'], uso: '/limparresgates', descricao: 'Limpa a lista da aba Resgates, inclusive os pendentes (pede confirmação se houver)', local: true },
];

// Os comandos que valem para estas plataformas, na ordem da lista. Os de modo sem a ação Painel: Controles continuam na lista, com `semAcao` para o aviso.
export function comandosDoChat(plataformas, { temControles = true } = {}) {
  const alvo = Array.isArray(plataformas) ? plataformas : [];
  return COMANDOS_DO_CHAT
    .filter(c => c.local || c.plataformas.some(p => alvo.includes(p)))
    .map(c => (c.controles && !temControles ? { ...c, semAcao: true } : c));
}

// A lista que aparece enquanto a pessoa ainda escreve o nome do comando ("/", "/su"): vazia se o texto não começa com "/" ou já tem espaço (aí já é o argumento).
export function sugestoesDeComando(texto, lista) {
  const t = String(texto || '');
  if (!t.startsWith('/') || /\s/.test(t)) return [];
  const prefixo = t.slice(1).toLowerCase();
  return lista.filter(c => c.nome.startsWith(prefixo) || (c.apelidos || []).some(a => a.startsWith(prefixo)));
}

// O texto que vai para o campo ao escolher um comando: com um espaço no fim quando ele leva argumento.
export const textoDoComando = c => `/${c.nome}${/\s/.test(c.uso) ? ' ' : ''}`;
