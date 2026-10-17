// Cliente do Streamer.bot do Dock: uma única conexão ao servidor WebSocket dele, compartilhada por quem assina
// (chat, alertas). Sem React e sem DOM: converte os eventos do Streamer.bot (Twitch, Kick e YouTube) em
// eventos tipados (chat, alerta, apagar, apagarUsuario, limpar, atualizacao, recusada) e cuida da reconexão. A conexão abre na
// primeira assinatura e fecha quando a última é cancelada.
//
// No Streamer.bot: Servers/Clients > WebSocket Server ligado (endereço e porta em STREAMERBOT_URL). O Kick exige o
// login na conta do Streamer.bot e a conta do Kick ligada no site dele (Account > Connections).
// Formatos vistos em eventos reais: Twitch.ChatMessage, Kick.ChatMessage e Twitch.Follow. Os demais seguem a
// documentação e são lidos de forma defensiva (campos que faltam viram vazio).

import { STREAMERBOT_URL, STREAMERBOT_SENHA } from './config.js';
import { ler } from './armazenamento.js';
import { sha256Base64 } from './sha256.js';

const RECONEXAO_MIN_MS = 1000;
const RECONEXAO_MAX_MS = 15000;
const CONEXAO_ESTAVEL_MS = 5000; // aberta por mais que isso: a próxima queda reconecta rápido de novo

// Eventos que o Dock usa, por fonte do Streamer.bot (o resto não é assinado, pra não receber ruído). StreamUpdate (Twitch) e
// ChannelUpdate (Kick) confirmam a mudança de título e categoria.
const EVENTOS_ASSINADOS = {
  Twitch: [
    'ChatMessage', 'ChatMessageDeleted', 'ChatCleared', 'UserBanned', 'UserTimedOut', 'StreamUpdate',
    'Follow', 'Sub', 'ReSub', 'GiftSub', 'GiftBomb', 'Cheer', 'Raid', 'RewardRedemption', 'AutomaticRewardRedemption', 'HypeChat', 'HypeTrainStart', 'HypeTrainLevelUp',
    'PollCreated', 'PollCompleted', 'PollTerminated', 'PredictionCreated', 'PredictionLocked', 'PredictionCompleted',
    'PredictionCanceled', 'UpcomingAd', 'ViewerCountUpdate', 'StreamOnline', 'StreamOffline',
  ],
  Kick: [
    'ChatMessage', 'UserBanned', 'UserTimedOut', 'ChannelUpdate',
    'Follow', 'Subscription', 'Resubscription', 'GiftSubscription', 'MassGiftSubscription', 'KicksGifted', 'RewardRedemption',
    'ViewerCountUpdate', 'StreamOnline', 'StreamOffline',
  ],
  YouTube: [
    'Message', 'MessageDeleted', 'UserBanned', 'UserTimedout',
    'NewSubscriber', 'NewSponsor', 'MemberMileStone', 'MembershipGift', 'GiftMembershipReceived', 'SuperChat', 'SuperSticker', 'JewelsGifted',
    'PollStarted', 'PollClosed', 'StatisticsUpdated', 'BroadcastStarted', 'BroadcastEnded',
  ],
};

const texto = v => (v === undefined || v === null ? '' : String(v));
// Primeiro valor numérico entre os candidatos (os campos de quantidade variam de evento pra evento).
const numero = (...candidatos) => {
  for (const c of candidatos) {
    const n = Number(c);
    if (c !== undefined && c !== null && c !== '' && Number.isFinite(n)) return n;
  }
  return null;
};
const comUnidade = (n, unidade) => (n === null ? '' : `${n.toLocaleString('pt-BR')} ${unidade}`);

// Votação e previsão: título, opções e vencedor. Os campos não têm esquema documentado, então vários candidatos.
const tituloDe = d => texto(d.title || d.question || d.name || (d.poll && d.poll.title) || (d.prediction && d.prediction.title) || 'Sem título');
const listaDe = d => d.choices || d.outcomes || d.options || d.answers || (d.poll && d.poll.choices) || (d.prediction && d.prediction.outcomes) || [];
const nomeDoItem = i => texto(i && (i.title || i.name || i.text || i.label || i));
const opcoesDe = d => (Array.isArray(listaDe(d)) ? listaDe(d).map(nomeDoItem).filter(Boolean).join(' · ') : '');
// Nome da opção vencedora; vazio se o evento não diz qual foi.
function vencedorDe(d) {
  const lista = Array.isArray(listaDe(d)) ? listaDe(d) : [];
  const ganhador = d.winningOutcome || d.winningChoice || lista.find(i => i && (i.winner || i.isWinner || (d.winningOutcomeId !== undefined && i.id === d.winningOutcomeId)));
  return ganhador ? nomeDoItem(ganhador) : '';
}
const SEGUNDOS_ANUNCIO_PADRAO = 60; // quando o aviso de anúncio não diz em quanto tempo ele entra
// Segundos até o anúncio. O gatilho Upcoming Ad do Streamer.bot dispara uma vez por minuto nos 5 minutos antes dele e traz
// `nextAdAt` (hora exata), `minutes`, `adLength` (segundos) e `snoozesLeft`; os outros nomes são candidatos sem esquema documentado.
function segundosDe(d) {
  const hora = Date.parse(texto(d.nextAdAt));
  if (Number.isFinite(hora)) return Math.max(0, Math.round((hora - Date.now()) / 1000));
  const minutos = numero(d.minutes);
  if (minutos !== null) return minutos * 60;
  return numero(d.secondsUntilNextAd, d.secondsUntil, d.seconds, d.nextAdIn, d.duration);
}
const tempoAteOAnuncio = s => (s === null ? 'Em breve' : s >= 60 ? `Em ${Math.round(s / 60)} min` : `Em ${s} s`);
// O que o aviso de anúncio da tela precisa: a hora do anúncio (ms; a exata quando vem, senão agora mais o que falta), a duração (s)
// e os adiamentos restantes (nulos quando o evento não diz).
function anuncioDe(d) {
  const hora = Date.parse(texto(d.nextAdAt));
  const segundos = segundosDe(d);
  return {
    quandoMs: Number.isFinite(hora) ? hora : Date.now() + (segundos === null ? SEGUNDOS_ANUNCIO_PADRAO : segundos) * 1000,
    duracaoS: numero(d.adLength),
    adiamentos: numero(d.snoozesLeft),
  };
}
const adiamentosTexto = n => (n === null ? '' : `${n} ${n === 1 ? 'adiamento restante' : 'adiamentos restantes'}`);

// Resgate de pontos. Recompensa personalizada (Twitch.RewardRedemption: reward.title e reward.cost) e Kick.RewardRedemption (sem esquema
// documentado: vários candidatos). As recompensas padrão da Twitch chegam em Twitch.AutomaticRewardRedemption, com rewardType e
// channelPoints; os tipos têm nome em português e um tipo novo aparece com o nome cru.
const RECOMPENSAS_PADRAO = {
  send_highlighted_message: 'Mensagem em destaque',
  random_sub_emote_unlock: 'Emote aleatório de sub',
  chosen_sub_emote_unlock: 'Emote de sub à escolha',
  chosen_modified_sub_emote_unlock: 'Emote de sub modificado',
  single_message_bypass_sub_mode: 'Mensagem no modo só inscritos',
  message_effect: 'Efeito de mensagem',
  gigantify_an_emote: 'Emote gigante',
  celebration: 'Celebração na tela',
};
const tituloDoResgate = d => texto((d.reward && (d.reward.title || d.reward.name)) || d.rewardName || d.rewardTitle || d.title);
const custoDoResgate = d => numero(d.reward && d.reward.cost, d.rewardCost, d.cost, d.channelPoints, d.points);
const detalheDoResgate = d => [tituloDoResgate(d), comUnidade(custoDoResgate(d), 'pontos')].filter(Boolean).join(' · ');
const tipoDeRecompensaPadrao = d => RECOMPENSAS_PADRAO[d.rewardType] || texto(d.rewardType).replace(/_/g, ' ');
const NOME_SEM_USUARIO = 'Alguém'; // quando o evento não diz quem resgatou, o alerta aparece assim em vez de sumir
// O texto que quem resgatou escreveu junto: `userInput` na Twitch (recompensa personalizada), `text` nas recompensas padrão (a mensagem em
// destaque) e vários candidatos na Kick, que não tem esquema documentado.
const textoDoResgate = d => texto(
  d.userInput || d.user_input || d.rawInput || d.input || d.userMessage || (d.redemption && (d.redemption.userInput || d.redemption.user_input)) || mensagemEmTexto(d),
).trim();

// Peças dos textos dos alertas. Os campos de nível e de meses de sub não têm esquema documentado: vários candidatos.
function tierDe(d) {
  const bruto = texto(d.subTier || d.tier || d.subscriptionTier).trim();
  if (d.isPrime || /prime/i.test(bruto)) return 'Prime';
  const m = /^(?:tier\s*)?(\d)(?:000)?$/i.exec(bruto);
  return m ? `Tier ${m[1]}` : '';
}
const mesesDe = d => numero(d.cumulativeMonths, d.cumulative, d.months, d.totalMonths, d.monthsSubscribed, d.memberMonths);
const mesesTexto = n => (n === null ? '' : `${n} ${n === 1 ? 'mês' : 'meses'}`);
const nivelDe = d => texto(d.levelName || d.membershipLevel);
const juntarLinha = (...partes) => partes.filter(Boolean).join(' · ');
// Valor em dinheiro: sem símbolo na fonte, vira reais (o padrão do canal); com símbolo ou letras, fica como veio.
function dinheiroDe(d) {
  const bruto = texto(d.formattedAmount || d.amount || d.displayAmount).trim();
  if (!bruto) return '';
  if (/[^\d.,\s]/.test(bruto)) return bruto;
  const moeda = texto(d.currency || d.currencyCode).toUpperCase();
  const valor = Number.isFinite(Number(bruto)) ? Number(bruto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : bruto;
  return !moeda || moeda === 'BRL' ? `R$ ${valor}` : `${valor} ${moeda}`;
}

// Alertas: fonte.tipo do Streamer.bot -> valor de `event` (o ChatPanel dá o rótulo pelo `event` quando o alerta não traz `rotulo`). Os campos de cada
// definição, todos opcionais:
//   nome(data)      troca o nome mostrado (quando o evento não tem usuário);
//   principal(data, nome)  a frase do alerta ("Raid de Fulano chegando"), no lugar do nome;
//   rotulo(data)    texto pequeno acima da linha grande (no layout novo só aparece se esta função existir);
//   detalhe(data)   linha pequena abaixo; destaque(data)  linha em destaque (o vencedor de votação e previsão);
//   mensagem(data)  o texto que a pessoa escreveu junto (o do resgate de pontos).
// Os campos de Cheer, Raid, RewardRedemption e SuperChat vêm da documentação; HypeTrain, HypeChat, KicksGifted e o resgate
// do Kick não têm esquema documentado, então os candidatos de cada campo são vários.
const seguidor = frase => ({ event: 'new_follower', principal: (d, nome) => nome, detalhe: () => frase });
// Frase "[antes] Nome [acao]": `principal` guarda a frase inteira (o Dock mostra só ela; `antes` e `acao` ficam pra quem quiser separar).
const quem = (acao, antes = '') => ({ principal: (d, nome) => [antes, nome, acao].filter(Boolean).join(' '), antes: () => antes, acao: () => acao });
const abertura = (event, rotulo) => ({ event, rotulo: () => rotulo, nome: tituloDe, principal: tituloDe, detalhe: opcoesDe });
const encerrada = (event, rotulo) => ({ event, rotulo: () => rotulo, nome: tituloDe, principal: tituloDe, destaque: vencedorDe, detalhe: d => (vencedorDe(d) ? '' : opcoesDe(d)) });
const cancelada = (event, rotulo) => ({ event, rotulo: () => rotulo, nome: tituloDe, principal: tituloDe });
// Subs de presente: quem presenteou fica no nome do alerta (como nos demais "quem fez o quê") e para quem foi vai na linha de baixo. A Twitch
// manda um GiftSub por presenteado (recipient) e um GiftBomb com a lista (recipients); a Kick, GiftSubscription (recipient) e
// MassGiftSubscription (recipients); no YouTube, MembershipGift traz quem presenteou e quantos (count) e GiftMembershipReceived, o presenteado (user) e
// quem presenteou (gifter).
const nomeDaPessoa = p => texto(p && (p.name || p.login));
const ANONIMO = 'Anônimo';
// "Ana, Beto, Caio e mais 2": os primeiros nomes da lista de presenteados, sem passar de `max`.
function listaDePresenteados(lista, max = 3) {
  const nomes = (Array.isArray(lista) ? lista : []).map(nomeDaPessoa).filter(Boolean);
  return nomes.length > max ? `${nomes.slice(0, max).join(', ')} e mais ${nomes.length - max}` : nomes.join(', ');
}
const paraQuem = nomes => (nomes ? `Para ${nomes}` : '');
const quantosSubs = n => (n === null ? '' : `${n} ${n === 1 ? 'sub' : 'subs'}`);
const presenteou = quem('presenteou');

export const ALERTAS = {
  'Twitch.Follow': seguidor('Acabou de seguir'),
  'Kick.Follow': seguidor('Acabou de seguir'),
  'YouTube.NewSubscriber': seguidor('Acabou de se inscrever'),
  'Twitch.Sub': { event: 'new_subscriber', ...quem('virou Sub'), detalhe: tierDe },
  'Twitch.ReSub': { event: 'resub', ...quem('renovou o Sub'), detalhe: d => juntarLinha(tierDe(d), mesesTexto(mesesDe(d))) },
  'Twitch.GiftSub': { event: 'subscription_gift', ...presenteou, detalhe: d => juntarLinha(paraQuem(nomeDaPessoa(d.recipient)), tierDe(d)) },
  'Twitch.GiftBomb': { event: 'subscription_gift', ...presenteou, detalhe: d => juntarLinha(quantosSubs(numero(d.total)), paraQuem(listaDePresenteados(d.recipients)), tierDe(d)) },
  'Kick.Subscription': { event: 'new_subscriber', ...quem('virou Sub'), detalhe: tierDe },
  'Kick.Resubscription': { event: 'resub', ...quem('renovou o Sub'), detalhe: d => juntarLinha(tierDe(d), mesesTexto(mesesDe(d))) },
  'Kick.GiftSubscription': { event: 'subscription_gift', ...presenteou, nome: d => (d.isAnonymous ? ANONIMO : ''), detalhe: d => paraQuem(nomeDaPessoa(d.recipient)) },
  'Kick.MassGiftSubscription': { event: 'subscription_gift', ...presenteou, nome: d => (d.isAnonymous ? ANONIMO : ''), detalhe: d => juntarLinha(quantosSubs(Array.isArray(d.recipients) ? d.recipients.length : null), paraQuem(listaDePresenteados(d.recipients))) },
  'YouTube.NewSponsor': { event: 'sponsorship', ...quem('virou membro'), detalhe: nivelDe },
  'YouTube.MemberMileStone': { event: 'membermilestone', ...quem('renovou a assinatura'), detalhe: d => juntarLinha(nivelDe(d), mesesTexto(mesesDe(d))) },
  'YouTube.MembershipGift': { event: 'giftpurchase', ...presenteou, detalhe: d => juntarLinha(numero(d.count) === null ? '' : `${numero(d.count)} ${numero(d.count) === 1 ? 'membro' : 'membros'}`, texto(d.tier)) },
  'YouTube.GiftMembershipReceived': { event: 'giftredemption', ...presenteou, nome: d => nomeDaPessoa(d.gifter), detalhe: d => juntarLinha(paraQuem(nomeDaPessoa(d.user)), texto(d.tier)) },
  'Twitch.RewardRedemption': { event: 'reward', ...quem('resgatou'), nomePadrao: NOME_SEM_USUARIO, detalhe: detalheDoResgate, mensagem: textoDoResgate },
  'Twitch.AutomaticRewardRedemption': {
    event: 'reward',
    ...quem('resgatou'),
    nomePadrao: NOME_SEM_USUARIO,
    detalhe: d => [tipoDeRecompensaPadrao(d), comUnidade(custoDoResgate(d), 'pontos')].filter(Boolean).join(' · '),
    mensagem: textoDoResgate,
  },
  'Kick.RewardRedemption': { event: 'reward', ...quem('resgatou'), nomePadrao: NOME_SEM_USUARIO, detalhe: detalheDoResgate, mensagem: textoDoResgate },
  'Twitch.Cheer': {
    event: 'cheer',
    nome: d => (d.anonymous ? 'Anônimo' : ''),
    ...quem('mandou'),
    detalhe: d => comUnidade(numero(d.bits), 'Bits'),
  },
  'Kick.KicksGifted': {
    event: 'gift',
    ...quem('mandou'),
    detalhe: d => comUnidade(numero(d.kicks, d.amount, d.quantity, d.value, d.gift && d.gift.amount), 'KICKs'),
  },
  'YouTube.JewelsGifted': {
    event: 'jeweldonation',
    ...quem('mandou'),
    detalhe: d => comUnidade(numero(d.jewels, d.amount, d.quantity), 'joias'),
  },
  'Twitch.HypeChat': { event: 'hype_chat', ...quem('apoiou'), detalhe: dinheiroDe },
  'YouTube.SuperChat': { event: 'superchat', principal: (d, nome) => nome, detalhe: d => (dinheiroDe(d) ? `Ativou Superchat de ${dinheiroDe(d)}` : 'Ativou Superchat') },
  'YouTube.SuperSticker': { event: 'supersticker', principal: (d, nome) => nome, detalhe: d => (dinheiroDe(d) ? `Ativou Super Sticker de ${dinheiroDe(d)}` : 'Ativou Super Sticker') },
  'Twitch.Raid': { event: 'raid', ...quem('chegando', 'Raid de'), detalhe: d => comUnidade(numero(d.viewers), 'Espectadores') },
  'Twitch.HypeTrainStart': { event: 'hype_train', nome: () => 'Começou!', detalhe: d => (numero(d.level) === null ? '' : `Nível ${numero(d.level)}`) },
  'Twitch.PollCreated': abertura('poll', 'A votação começou'),
  'Twitch.PollCompleted': encerrada('poll', 'A votação acabou'),
  'Twitch.PollTerminated': cancelada('poll', 'Votação cancelada'),
  'YouTube.PollStarted': abertura('poll', 'A votação começou'),
  'YouTube.PollClosed': encerrada('poll', 'A votação acabou'),
  'Twitch.PredictionCreated': abertura('prediction', 'Previsão aberta'),
  'Twitch.PredictionLocked': abertura('prediction', 'Previsão travada'),
  'Twitch.PredictionCompleted': encerrada('prediction', 'Previsão encerrada'),
  'Twitch.PredictionCanceled': cancelada('prediction', 'Previsão cancelada'),
  'Twitch.UpcomingAd': {
    event: 'upcoming_ad',
    nome: d => tempoAteOAnuncio(segundosDe(d)),
    detalhe: d => juntarLinha(numero(d.adLength) === null ? '' : `Dura ${numero(d.adLength)} s`, adiamentosTexto(numero(d.snoozesLeft))),
  },
  'Twitch.HypeTrainLevelUp': { event: 'hype_train', nome: d => (numero(d.level, d.newLevel) === null ? 'Subiu de nível!' : `Nível ${numero(d.level, d.newLevel)}!`) },
};

// Enquete e previsão da Twitch: o alerta leva também o id e as opções (com id) pra o Dock poder encerrar, travar e resolver.
const EVENTOS_DE_INTERACAO = new Set(['Twitch.PollCreated', 'Twitch.PollCompleted', 'Twitch.PollTerminated', 'Twitch.PredictionCreated', 'Twitch.PredictionLocked', 'Twitch.PredictionCompleted', 'Twitch.PredictionCanceled']);
const idDaInteracao = d => texto(d.id || d.pollId || d.predictionId || (d.poll && d.poll.id) || (d.prediction && d.prediction.id));
const interacaoDe = (tipo, d) => ({
  evento: tipo,
  id: idDaInteracao(d),
  titulo: tituloDe(d),
  opcoes: (Array.isArray(listaDe(d)) ? listaDe(d) : []).map(o => ({ id: texto(o && o.id), nome: nomeDoItem(o) })),
});

const PLATAFORMA = { Twitch: 'twitch', Kick: 'kick', YouTube: 'youtube' };

const escapar = valor => String(valor).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Mensagem do Streamer.bot -> HTML que o chat entende: texto escapado e emotes como <img> https.
function mensagemEmHtml(data) {
  const partes = Array.isArray(data.parts) ? data.parts : null;
  if (!partes || partes.length === 0) return escapar(texto(data.text || data.message));
  return partes.map(p => {
    const imagem = p.imageUrl || p.url || p.emoteUrl || '';
    if (p.type === 'emote' && /^https:\/\//i.test(imagem)) return `<img src="${escapar(imagem)}" alt="${escapar(texto(p.text))}">`;
    return escapar(texto(p.text));
  }).join('');
}

// A mesma mensagem sem emotes nem HTML (copiar, mencionar).
function mensagemEmTexto(data) {
  const partes = Array.isArray(data.parts) ? data.parts : null;
  if (!partes || partes.length === 0) return texto(data.text || data.message);
  return partes.map(p => texto(p.text)).join('');
}

// Quem fez o evento: o objeto de usuário (`user`, `redeemer`...) ou, quando falta nome, o texto solto no lugar do objeto e os campos soltos no
// topo (`user_name`, `userName`...). Sempre devolve um objeto.
function usuarioDe(data) {
  const bruto = data.user || data.redeemer || data.targetUser || data.raider || data.gifter || data.author;
  const base = typeof bruto === 'string' ? { name: bruto } : bruto && typeof bruto === 'object' ? bruto : {};
  return {
    ...base,
    id: base.id ?? (data.user_id || data.userId),
    login: base.login ?? (data.user_login || data.userLogin),
    name: base.name || base.displayName || base.display_name || data.user_name || data.userName || data.displayName || data.display_name,
  };
}

// Paleta padrão da Twitch: nick sem cor (o YouTube não manda, e muita gente da Twitch nunca escolheu) ganha sempre a mesma, sorteada pelo nome.
const CORES_PADRAO_DO_NOME = [
  '#ff0000', '#0000ff', '#00ff00', '#b22222', '#ff7f50', '#9acd32', '#ff4500', '#2e8b57',
  '#daa520', '#d2691e', '#5f9ea0', '#1e90ff', '#ff69b4', '#8a2be2', '#00ff7f',
];
function corPadraoDoNome(chave) {
  let h = 0;
  for (const c of String(chave || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_PADRAO_DO_NOME[h % CORES_PADRAO_DO_NOME.length];
}

// A primeira mensagem de alguém no canal, de todas as lives (não a primeira da live): o Streamer.bot marca na própria mensagem, em `meta.firstMessage`
// (Twitch), `FirstMessage` (Kick) e `meta.FirstMessage` (YouTube). O gatilho "First Words" não serve: ele só vale até zerar (12 h ou ao entrar no ar).
const ehPrimeiraMensagem = data => [data.meta && data.meta.firstMessage, data.meta && data.meta.FirstMessage, data.FirstMessage, data.firstMessage].some(v => v === true);

// Converte uma mensagem do WebSocket do Streamer.bot em um evento tipado ou null se não usamos.
// Pura: não mexe em DOM nem em estado.
export function converterEventoStreamerbot(msg) {
  if (!msg || !msg.event || !msg.event.source) return null;
  const { source, type } = msg.event;
  const data = msg.data || {};
  const plataforma = PLATAFORMA[source];
  if (!plataforma) return null;
  const chave = `${source}.${type}`;
  const usuario = usuarioDe(data);

  if (type === 'ChatMessage' || (source === 'YouTube' && type === 'Message')) {
    const nome = usuario.name || usuario.login;
    if (!nome) return null;
    const insignias = Array.isArray(usuario.badges) ? usuario.badges.filter(b => b && /^https:\/\//i.test(b.imageUrl || '')) : [];
    return {
      tipo: 'chat',
      mensagem: {
        type: plataforma,
        id: texto(data.messageId || data.id),
        chatname: nome,
        username: texto(usuario.login || nome),
        userid: texto(usuario.id),
        chatmessage: mensagemEmHtml(data),
        chattexto: mensagemEmTexto(data),
        chatimg: texto(usuario.profilePicture || usuario.profileImageUrl),
        chatbadges: insignias.map(b => ({ type: 'img', src: b.imageUrl })),
        nameColor: texto(usuario.color) || corPadraoDoNome(usuario.id || usuario.login || nome),
        membership: '',
        primeira: ehPrimeiraMensagem(data),
      },
    };
  }

  if (type === 'ChatMessageDeleted' || type === 'MessageDeleted') {
    const id = data.messageId || data.targetMessageId || data.id;
    return id ? { tipo: 'apagar', id: texto(id) } : { tipo: 'apagar', chatname: usuario.name || usuario.login, plataforma };
  }
  if (type === 'UserBanned' || type === 'UserTimedOut' || type === 'UserTimedout') {
    const alvo = data.user || data.targetUser || data.bannedUser || data.timedoutUser || {};
    const chatname = alvo.name || alvo.login;
    const banido = type === 'UserBanned';
    return chatname
      ? {
        tipo: 'apagarUsuario', chatname, plataforma, punicao: banido ? 'banido' : 'silenciado', segundos: banido ? null : numero(data.duration, data.timeoutDuration, data.seconds),
        login: texto(alvo.login), userid: texto(alvo.id),
      }
      : null;
  }
  if (type === 'ChatCleared') return { tipo: 'limpar', plataforma };
  // Resposta à mudança de título e categoria (o Dock confirma o que a plataforma aplicou de fato).
  if ((source === 'Twitch' && type === 'StreamUpdate') || (source === 'Kick' && type === 'ChannelUpdate')) {
    const twitch = source === 'Twitch';
    return { tipo: 'atualizacao', plataforma, titulo: texto(twitch ? data.status : data.title), categoria: texto(twitch ? data.game && data.game.name : data.categoryName) };
  }

  // Espectadores e início/fim da live de cada plataforma. Documentados: Twitch.StreamOnline (startedAt), Kick.ViewerCountUpdate (viewerCount),
  // YouTube.StatisticsUpdated (concurrentViewers, broadcast.actualStartTime) e YouTube.BroadcastStarted/Ended; os demais campos têm
  // candidatos (Twitch.ViewerCountUpdate e Kick.StreamOnline não têm esquema documentado).
  if (type === 'ViewerCountUpdate' || (source === 'YouTube' && type === 'StatisticsUpdated')) {
    const quantidade = numero(data.viewerCount, data.viewers, data.concurrentViewers, data.count);
    const inicio = Date.parse(texto(data.broadcast && data.broadcast.actualStartTime));
    return quantidade === null ? null : { tipo: 'espectadores', plataforma, quantidade, inicioMs: Number.isFinite(inicio) ? inicio : null };
  }
  if (type === 'StreamOnline' || (source === 'YouTube' && type === 'BroadcastStarted')) {
    const inicio = Date.parse(texto(data.startedAt || data.started_at || data.createdAt || (data.broadcast && data.broadcast.actualStartTime)));
    return { tipo: 'transmissao', plataforma, aoVivo: true, inicioMs: Number.isFinite(inicio) ? inicio : null };
  }
  if (type === 'StreamOffline' || (source === 'YouTube' && type === 'BroadcastEnded')) return { tipo: 'transmissao', plataforma, aoVivo: false, inicioMs: null };

  const alerta = ALERTAS[chave];
  if (alerta) {
    const nomeDoUsuario = usuario.name || usuario.login || usuario.username;
    const nome = (alerta.nome && alerta.nome(data)) || nomeDoUsuario || alerta.nomePadrao;
    if (!nome) return null;
    if (!nomeDoUsuario && alerta.nomePadrao) console.warn(`[LiveHelm] ${chave} sem o nome de quem fez; campos recebidos: ${Object.keys(data).join(', ')}`);
    const quando = texto(data.followedAt || data.timestamp || data.createdAt || data.publishedAt);
    const nivel = texto(data.subTier || data.tier || data.levelName || data.membershipLevel);
    return {
      tipo: 'alerta',
      alerta: {
        type: plataforma,
        event: alerta.event,
        chatname: nome,
        userid: texto(usuario.id),
        id: `${plataforma}-${alerta.event}-${usuario.id || nome}-${quando}`,
        chatimg: texto(usuario.profilePicture || usuario.profileImageUrl),
        membership: nivel,
        detalhe: alerta.detalhe ? alerta.detalhe(data) : '',
        rotulo: alerta.rotulo ? alerta.rotulo(data) : '',
        principal: alerta.principal ? alerta.principal(data, nome) : undefined,
        antes: alerta.antes ? alerta.antes(data) : '',
        acao: alerta.acao ? alerta.acao(data) : '',
        destaque: alerta.destaque ? alerta.destaque(data) : '',
        mensagem: alerta.mensagem ? alerta.mensagem(data) : '',
        segundos: alerta.event === 'upcoming_ad' ? (segundosDe(data) || SEGUNDOS_ANUNCIO_PADRAO) : undefined,
        anuncio: alerta.event === 'upcoming_ad' ? anuncioDe(data) : undefined,
        meta: { origem: 'streamerbot', evento: chave, quando },
        interacao: EVENTOS_DE_INTERACAO.has(chave) ? interacaoDe(type, data) : undefined,
      },
    };
  }
  return null;
}

// Endereço e senha: ?streamerbot= e ?sbsenha= na URL do dock valem primeiro, depois o que foi salvo nas configurações do
// dock e por fim config.js.
function parametrosDaUrl() {
  const p = new URLSearchParams(location.search);
  const salvo = ler('config', {}).streamerbot || {};
  return {
    url: p.get('streamerbot') || salvo.url || STREAMERBOT_URL,
    senha: p.get('sbsenha') || (salvo.senha !== undefined ? salvo.senha : STREAMERBOT_SENHA),
  };
}

// Abre a conexão e a mantém: reconecta sozinha, com espera crescente quando falha em sequência. O Streamer.bot
// derruba as conexões quando reinicia uma integração (ex.: Kick), então toda abertura se inscreve de novo.
function abrirConexao(aoEvento) {
  const { url, senha } = parametrosDaUrl();
  const pendentes = new Map(); // id do pedido -> resolve, ver pedirStreamerbot
  let aberta = false;
  let contadorDePedidos = 0;
  const entregar = aoEvento;
  let ws = null;
  let timer = null;
  let encerrada = false;
  let falhas = 0;
  let abertaEm = 0;

  const inscrever = () => {
    ws.send(JSON.stringify({ request: 'Subscribe', id: 'inscrever', events: EVENTOS_ASSINADOS }));
    aberta = true;
    aoEvento({ tipo: 'conexao', aberta: true });
  };
  const agendar = () => {
    const espera = Math.min(RECONEXAO_MIN_MS * 2 ** falhas, RECONEXAO_MAX_MS);
    falhas++;
    timer = setTimeout(conectar, espera);
  };
  function conectar() {
    try { ws = new WebSocket(url); } catch (_) { agendar(); return; }
    ws.onopen = () => { abertaEm = Date.now(); };
    ws.onmessage = async ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (m.request === 'Hello') {
        // Com senha, o servidor manda um desafio; sem senha, já dá pra se inscrever.
        if (m.authentication && senha) {
          const segredo = await sha256Base64(senha + m.authentication.salt);
          const assinatura = await sha256Base64(segredo + m.authentication.challenge);
          ws.send(JSON.stringify({ request: 'Authenticate', id: 'autenticar', authentication: assinatura }));
        } else {
          inscrever();
        }
      } else if (m.id === 'autenticar' && m.status === 'ok') {
        inscrever();
      } else if ((m.id === 'autenticar' || m.id === 'inscrever') && m.status === 'error') {
        // Senha errada ou inscrição recusada: quem mostra o estado (o Dock) avisa o motivo.
        aoEvento({ tipo: 'recusada', erro: texto(m.error) || 'senha recusada' });
      } else if (m.id && pendentes.has(m.id)) {
        pendentes.get(m.id)(m);
        pendentes.delete(m.id);
      } else if (m.event) {
        const evento = converterEventoStreamerbot(m);
        if (evento) entregar(evento);
      }
    };
    ws.onerror = () => { /* o onclose cuida de reconectar */ };
    ws.onclose = () => {
      if (aberta && !encerrada) aoEvento({ tipo: 'conexao', aberta: false });
      aberta = false;
      pendentes.forEach(resolve => resolve({ status: 'error', error: 'conexão fechada' }));
      pendentes.clear();
      if (abertaEm && Date.now() - abertaEm >= CONEXAO_ESTAVEL_MS) falhas = 0;
      abertaEm = 0;
      if (!encerrada) agendar();
    };
  }

  conectar();
  return {
    // Manda um pedido ao Streamer.bot e devolve a resposta (ou { status: 'error' } se não houver conexão ou demorar).
    enviar(pedido, limiteMs = 8000) {
      return new Promise(resolve => {
        if (!ws || ws.readyState !== 1) { resolve({ status: 'error', error: 'sem conexão com o Streamer.bot' }); return; }
        const id = `pedido-${++contadorDePedidos}`;
        const timer = setTimeout(() => { pendentes.delete(id); resolve({ status: 'error', error: 'sem resposta' }); }, limiteMs);
        pendentes.set(id, resposta => { clearTimeout(timer); resolve(resposta); });
        ws.send(JSON.stringify({ ...pedido, id }));
      });
    },
    fechar() {
      encerrada = true;
      clearTimeout(timer);
      if (ws) ws.close();
    },
  };
}

const assinantes = new Set();
let conexao = null;

// Manda um pedido ao Streamer.bot (por exemplo { request: 'GetActions' }) pela conexão compartilhada e devolve a
// resposta ({ status: 'error' } enquanto a conexão não está pronta: espere o evento 'conexao'). Abre a conexão se ainda
// não existir (e a deixa aberta).
export async function pedirStreamerbot(pedido, limiteMs) {
  if (!conexao) conexao = abrirConexao(evento => assinantes.forEach(f => f(evento)));
  return conexao.enviar(pedido, limiteMs);
}

// Registra um ouvinte de eventos do Streamer.bot e devolve a função que cancela a assinatura. Além dos eventos de
// chat e alerta, entrega { tipo: 'conexao', aberta } quando a conexão abre ou cai.
export function assinarStreamerbot(ouvinte) {
  assinantes.add(ouvinte);
  if (!conexao) conexao = abrirConexao(evento => assinantes.forEach(f => f(evento)));
  return () => {
    assinantes.delete(ouvinte);
    if (assinantes.size === 0 && conexao) { conexao.fechar(); conexao = null; }
  };
}

// Refaz a conexão com o endereço e a senha atuais (depois de mudar as configurações). Avisa que caiu e a nova avisa quando
// abrir.
export function reconectarStreamerbot() {
  if (!conexao) return;
  conexao.fechar();
  assinantes.forEach(f => f({ tipo: 'conexao', aberta: false }));
  conexao = abrirConexao(evento => assinantes.forEach(f => f(evento)));
}
