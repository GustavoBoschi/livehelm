// Quais itens do feed aparecem em cada aba do chat. Sem React nem DOM.
//
// A aba Tudo mostra as mensagens de todas as plataformas e só os alertas de quem seguiu, assinou, presenteou, apoiou, resgatou com
// pontos ou chegou em raid; o resto (anúncio, hype train, votação, previsão e os avisos de moderação do dock: banido, silenciado e
// chat limpo) aparece só na aba Alertas, que mostra todos. Um alerta de tipo que esta lista não conhece também fica só nela.

// Valores de `event` (os de ALERTAS em streamerbot.js) liberados no chat geral.
export const ALERTAS_NO_CHAT_GERAL = new Set([
  'new_follower', 'new_subscriber', 'resub', 'subscription_gift', 'sponsorship', 'membermilestone', 'giftpurchase', 'giftredemption',
  'cheer', 'gift', 'jeweldonation', 'hype_chat', 'superchat', 'supersticker', 'raid', 'reward',
]);

export const apareceNoChatGeral = evento => ALERTAS_NO_CHAT_GERAL.has(evento);

// `aba` é 'tudo', 'alertas' ou o id de uma plataforma. Mensagem de plataforma nunca aparece na aba Alertas, e alerta nunca aparece
// na aba de plataforma.
export function passaNaAba(item, aba) {
  if (aba === 'tudo') return item.tipo !== 'alerta' || apareceNoChatGeral(item.evento);
  if (aba === 'alertas') return item.tipo === 'alerta';
  return item.tipo === 'chat' && item.plataforma === aba;
}
