// Quais itens do feed aparecem em cada aba do chat. Sem React nem DOM.
//
// A aba Alertas mostra todos os alertas, sempre. A aba Tudo mostra as mensagens de todas as plataformas e os alertas escolhidos, e
// cada aba de plataforma mostra o mesmo que a Tudo, só dela. Por padrão (ALERTAS_NO_CHAT_GERAL) os alertas são os de quem seguiu,
// assinou, presenteou, apoiou, resgatou com pontos ou chegou em raid; o resto (anúncio, hype train, votação, previsão e os avisos de
// moderação do dock: banido, silenciado e chat limpo) fica só na aba Alertas. Nas configurações o usuário liga ou desliga cada tipo
// (`escolhas`: { tipo: true | false }); o que ele não escolheu segue o padrão. Um tipo que o catálogo não conhece só aparece na aba
// Alertas.

// Valores de `event` (os de ALERTAS em streamerbot.js, mais 'moderacao' dos avisos do dock) que aparecem no chat geral por padrão.
export const ALERTAS_NO_CHAT_GERAL = new Set([
  'new_follower', 'new_subscriber', 'resub', 'subscription_gift', 'sponsorship', 'membermilestone', 'giftpurchase', 'giftredemption',
  'cheer', 'gift', 'jeweldonation', 'hype_chat', 'superchat', 'supersticker', 'raid', 'reward',
]);

// Os tipos de alerta que as configurações oferecem, por grupo. Tipo novo em ALERTAS (streamerbot.js) entra aqui também.
export const TIPOS_DE_ALERTA = [
  { grupo: 'Seguidores e inscrições', itens: [
    { id: 'new_follower', nome: 'Seguidor (Twitch e Kick) e inscrito (YouTube)' },
    { id: 'new_subscriber', nome: 'Sub novo' },
    { id: 'resub', nome: 'Renovação de sub' },
    { id: 'subscription_gift', nome: 'Sub de presente' },
    { id: 'sponsorship', nome: 'Membro novo (YouTube)' },
    { id: 'membermilestone', nome: 'Renovação de membro (YouTube)' },
    { id: 'giftpurchase', nome: 'Presente de assinatura (YouTube)' },
    { id: 'giftredemption', nome: 'Presente de assinatura recebido (YouTube)' },
  ] },
  { grupo: 'Apoios', itens: [
    { id: 'cheer', nome: 'Bits (Twitch)' },
    { id: 'gift', nome: 'KICKs enviados (Kick)' },
    { id: 'jeweldonation', nome: 'Joias (YouTube)' },
    { id: 'hype_chat', nome: 'Hype Chat (Twitch)' },
    { id: 'superchat', nome: 'Super Chat (YouTube)' },
    { id: 'supersticker', nome: 'Super Sticker (YouTube)' },
  ] },
  { grupo: 'Comunidade', itens: [
    { id: 'raid', nome: 'Raid (Twitch)' },
    { id: 'reward', nome: 'Resgate de pontos' },
    { id: 'hype_train', nome: 'Hype train (Twitch)' },
  ] },
  { grupo: 'Votações e previsões', itens: [
    { id: 'poll', nome: 'Votações' },
    { id: 'prediction', nome: 'Previsões (Twitch)' },
  ] },
  { grupo: 'Avisos', itens: [
    { id: 'upcoming_ad', nome: 'Aviso de anúncio (Twitch)' },
    { id: 'moderacao', nome: 'Banido, silenciado e chat limpo' },
  ] },
];

// Só um valor verdadeiro ou falso em `escolhas` conta como escolha; o resto volta ao padrão.
export const apareceNoChatGeral = (evento, escolhas = {}) => (typeof escolhas[evento] === 'boolean' ? escolhas[evento] : ALERTAS_NO_CHAT_GERAL.has(evento));

// `aba` é 'tudo', 'alertas' ou o id de uma plataforma. A aba de uma plataforma mostra o mesmo que a Tudo, só dessa plataforma (as
// mensagens e os alertas escolhidos). Mensagem de plataforma nunca aparece na aba Alertas.
export function passaNaAba(item, aba, escolhas = {}) {
  if (aba === 'tudo') return item.tipo !== 'alerta' || apareceNoChatGeral(item.evento, escolhas);
  if (aba === 'alertas') return item.tipo === 'alerta';
  return item.plataforma === aba && (item.tipo === 'chat' || apareceNoChatGeral(item.evento, escolhas));
}
