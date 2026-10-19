import { test } from 'node:test';
import assert from 'node:assert/strict';
import { converterEventoStreamerbot } from '../src/streamerbot.js';

// Campos do gatilho Twitch > Upcoming Ad como a documentação do Streamer.bot os lista (minutes, adLength, nextAdAt e snoozesLeft);
// o formato do evento no WebSocket ainda não foi visto com dados reais.
const anuncio = data => converterEventoStreamerbot({ event: { source: 'Twitch', type: 'UpcomingAd' }, data }).alerta;

test('aviso de anúncio com os minutos que faltam', () => {
  const a = anuncio({ minutes: 5, adLength: 90, snoozesLeft: 3 });
  assert.equal(a.event, 'upcoming_ad');
  assert.equal(a.chatname, 'Em 5 min');
  assert.equal(a.segundos, 300);
  assert.equal(a.detalhe, 'Dura 90 s · 3 adiamentos restantes');
});

test('aviso de anúncio com a hora exata: usa o que falta de verdade, em segundos', () => {
  const a = anuncio({ minutes: 1, nextAdAt: new Date(Date.now() + 45000).toISOString() });
  assert.ok(a.segundos >= 43 && a.segundos <= 45, `segundos: ${a.segundos}`);
  assert.match(a.chatname, /^Em (43|44|45) s$/);
});

test('aviso de anúncio com um adiamento restante e sem o resto dos campos', () => {
  const a = anuncio({ snoozesLeft: 1 });
  assert.equal(a.chatname, 'Em breve');
  assert.equal(a.segundos, 60);
  assert.equal(a.detalhe, '1 adiamento restante');
});

test('o aviso de anúncio leva a hora do anúncio, a duração e os adiamentos restantes pro aviso na tela', () => {
  const quando = Date.now() + 90000;
  const a = anuncio({ nextAdAt: new Date(quando).toISOString(), adLength: 60, snoozesLeft: 2 }).anuncio;
  assert.equal(a.quandoMs, quando);
  assert.equal(a.duracaoS, 60);
  assert.equal(a.adiamentos, 2);
});

test('sem a hora exata, a hora do anúncio sai dos minutos que faltam; o que não veio fica nulo', () => {
  const antes = Date.now();
  const a = anuncio({ minutes: 2 }).anuncio;
  assert.ok(a.quandoMs >= antes + 120000 && a.quandoMs <= Date.now() + 120000);
  assert.equal(a.duracaoS, null);
  assert.equal(a.adiamentos, null);
});

test('só o aviso de anúncio leva o campo anuncio', () => {
  const seguidor = converterEventoStreamerbot({ event: { source: 'Twitch', type: 'Follow' }, data: { user: { id: '1', name: 'Joao' } } }).alerta;
  assert.equal(seguidor.anuncio, undefined);
});

test('aviso de anúncio sem nenhum campo conhecido continua valendo', () => {
  const a = anuncio({});
  assert.equal(a.chatname, 'Em breve');
  assert.equal(a.detalhe, '');
});

// Resgates de pontos. Formato da Twitch (RewardRedemption e AutomaticRewardRedemption) como a documentação do Streamer.bot o descreve;
// o da Kick não tem esquema documentado, então os campos são lidos por vários candidatos.
const resgate = (source, type, data) => converterEventoStreamerbot({ event: { source, type }, data })?.alerta;
const maria = { id: '1', login: 'maria', name: 'Maria' };

test('recompensa padrão da Twitch (AutomaticRewardRedemption) aparece com o tipo em português e os pontos', () => {
  const a = resgate('Twitch', 'AutomaticRewardRedemption', { user: maria, rewardType: 'send_highlighted_message', channelPoints: 100, text: 'oi' });
  assert.equal(a.event, 'reward');
  assert.equal(a.principal, 'Maria resgatou');
  assert.equal(a.detalhe, 'Mensagem em destaque · 100 pontos');
});

test('todos os tipos de recompensa padrão têm nome em português; um tipo novo aparece com o nome cru legível', () => {
  const rotulo = tipo => resgate('Twitch', 'AutomaticRewardRedemption', { user: maria, rewardType: tipo, channelPoints: 5 }).detalhe;
  assert.equal(rotulo('random_sub_emote_unlock'), 'Emote aleatório de sub · 5 pontos');
  assert.equal(rotulo('chosen_sub_emote_unlock'), 'Emote de sub à escolha · 5 pontos');
  assert.equal(rotulo('chosen_modified_sub_emote_unlock'), 'Emote de sub modificado · 5 pontos');
  assert.equal(rotulo('single_message_bypass_sub_mode'), 'Mensagem no modo só inscritos · 5 pontos');
  assert.equal(rotulo('message_effect'), 'Efeito de mensagem · 5 pontos');
  assert.equal(rotulo('gigantify_an_emote'), 'Emote gigante · 5 pontos');
  assert.equal(rotulo('celebration'), 'Celebração na tela · 5 pontos');
  assert.equal(rotulo('tipo_novo_da_twitch'), 'tipo novo da twitch · 5 pontos');
});

test('resgate de recompensa personalizada da Twitch: título e custo vêm do objeto reward', () => {
  const a = resgate('Twitch', 'RewardRedemption', { user: maria, reward: { title: 'Hidratar', cost: 100 }, redemptionId: 'r1' });
  assert.equal(a.principal, 'Maria resgatou');
  assert.equal(a.detalhe, 'Hidratar · 100 pontos');
});

test('resgate com os campos soltos (rewardName, rewardCost) também é lido', () => {
  const a = resgate('Twitch', 'RewardRedemption', { user: maria, rewardName: 'Hidratar', rewardCost: 250 });
  assert.equal(a.detalhe, 'Hidratar · 250 pontos');
});

test('resgate da Kick com quem resgatou em redeemer (como na API pública da Kick)', () => {
  const a = resgate('Kick', 'RewardRedemption', { redeemer: { id: '9', username: 'Joao', channel_slug: 'joao' }, reward: { title: 'Dançar', cost: 50 }, status: 'pending' });
  assert.equal(a.event, 'reward');
  assert.equal(a.principal, 'Joao resgatou');
  assert.equal(a.detalhe, 'Dançar · 50 pontos');
});

test('resgate da Kick com os campos no formato dos outros eventos (user, title, cost)', () => {
  const a = resgate('Kick', 'RewardRedemption', { user: { id: '9', login: 'joao', name: 'Joao' }, title: 'Dançar', cost: 50 });
  assert.equal(a.principal, 'Joao resgatou');
  assert.equal(a.detalhe, 'Dançar · 50 pontos');
});

test('resgate sem o nome de quem resgatou não some: aparece como "Alguém"', () => {
  const a = resgate('Kick', 'RewardRedemption', { reward: { title: 'Dançar', cost: 50 } });
  assert.equal(a.principal, 'Alguém resgatou');
  assert.equal(a.detalhe, 'Dançar · 50 pontos');
});

test('resgate com o nome fora do objeto user: campos soltos (user_name, userName) e usuário como texto', () => {
  const soltos = resgate('Twitch', 'RewardRedemption', { user_id: '7', user_login: 'ana', user_name: 'Ana', reward: { title: 'Hidratar', cost: 100 } });
  assert.equal(soltos.principal, 'Ana resgatou');
  assert.equal(soltos.userid, '7');
  assert.equal(resgate('Twitch', 'RewardRedemption', { userName: 'Beto', reward: { title: 'x', cost: 1 } }).principal, 'Beto resgatou');
  assert.equal(resgate('Twitch', 'RewardRedemption', { user: 'Caio', reward: { title: 'x', cost: 1 } }).principal, 'Caio resgatou');
  assert.equal(resgate('Twitch', 'RewardRedemption', { user: { login: 'dani' }, reward: { title: 'x', cost: 1 } }).principal, 'dani resgatou');
});

test('resgate com texto: userInput da Twitch, text da recompensa padrão e candidatos da Kick vão em `mensagem`', () => {
  const personalizada = resgate('Twitch', 'RewardRedemption', { user: maria, reward: { title: 'Fale comigo', cost: 100 }, userInput: 'oi, tudo bem?' });
  assert.equal(personalizada.mensagem, 'oi, tudo bem?');
  assert.equal(resgate('Twitch', 'RewardRedemption', { user: maria, reward: { title: 'Hidratar', cost: 100 }, userInput: null }).mensagem, '');
  const padrao = resgate('Twitch', 'AutomaticRewardRedemption', { user: maria, rewardType: 'send_highlighted_message', channelPoints: 100, text: 'olha eu aqui' });
  assert.equal(padrao.mensagem, 'olha eu aqui');
  assert.equal(resgate('Kick', 'RewardRedemption', { user: maria, title: 'Dançar', cost: 50, userInput: '  vai!  ' }).mensagem, 'vai!');
  assert.equal(resgate('Kick', 'RewardRedemption', { redeemer: { id: '9', username: 'Joao' }, reward: { title: 'Dançar', cost: 50 }, user_input: 'bora' }).mensagem, 'bora');
  assert.equal(resgate('Kick', 'RewardRedemption', { redeemer: { id: '9', username: 'Joao' }, reward: { title: 'Dançar', cost: 50 } }).mensagem, '');
});

test('alerta que não é resgate vem sem `mensagem`', () => {
  assert.equal(converterEventoStreamerbot({ event: { source: 'Twitch', type: 'Follow' }, data: { user: maria } }).alerta.mensagem, '');
});

const chat = (source, user) => converterEventoStreamerbot({ event: { source, type: 'ChatMessage' }, data: { messageId: 'm1', text: 'oi', user } }).mensagem;

test('nick sem cor (YouTube, por exemplo) ganha uma cor da paleta, sempre a mesma pro mesmo usuário', () => {
  const a = chat('YouTube', { id: 'UC1', name: 'Luna' });
  assert.match(a.nameColor, /^#[0-9a-f]{6}$/);
  assert.equal(chat('YouTube', { id: 'UC1', name: 'Luna' }).nameColor, a.nameColor);
  const cores = new Set(['UC1', 'UC2', 'UC3', 'UC4', 'UC5', 'UC6', 'UC7', 'UC8'].map(id => chat('YouTube', { id, name: id }).nameColor));
  assert.ok(cores.size > 3, `só ${cores.size} cores em 8 usuários`);
});

test('a cor que a plataforma manda vale mais que a da paleta', () => {
  assert.equal(chat('Twitch', { id: '1', login: 'maria', name: 'Maria', color: '#123456' }).nameColor, '#123456');
});

const chatDe = (source, type, data) => converterEventoStreamerbot({ event: { source, type }, data })?.mensagem;
const autora = { id: '1', login: 'maria', name: 'Maria' };

test('primeira mensagem: vem da marca da própria mensagem (a primeira de todas no canal), em cada plataforma', () => {
  assert.equal(chatDe('Twitch', 'ChatMessage', { messageId: 'a', text: 'oi', user: autora, meta: { firstMessage: true } }).primeira, true);
  assert.equal(chatDe('Twitch', 'ChatMessage', { messageId: 'a', text: 'oi', user: autora, meta: { firstMessage: false, returningChatter: true } }).primeira, false);
  assert.equal(chatDe('Kick', 'ChatMessage', { messageId: 'b', text: 'oi', user: autora, FirstMessage: true }).primeira, true);
  assert.equal(chatDe('YouTube', 'Message', { eventId: 'c', message: 'oi', user: autora, meta: { FirstMessage: true } }).primeira, true);
  assert.equal(chatDe('Twitch', 'ChatMessage', { messageId: 'd', text: 'oi', user: autora }).primeira, false);
});

test('o gatilho "First Words" (primeira da sessão) não marca mais nada', () => {
  assert.equal(converterEventoStreamerbot({ event: { source: 'Twitch', type: 'FirstWord' }, data: { messageId: 'a', user: autora } }), null);
  assert.equal(converterEventoStreamerbot({ event: { source: 'Kick', type: 'FirstWords' }, data: { messageId: 'a', user: autora } }), null);
});

const eventoTwitch = (type, data) => converterEventoStreamerbot({ event: { source: 'Twitch', type }, data });

test('mensagem retida pelo AutoMod vira um evento com id, autor, texto e motivo', () => {
  const r = eventoTwitch('AutoModMessageHeld', { messageId: 'm-9', rawInput: 'isto é um teste', category: 'swearing', level: 2, user: { id: '5', login: 'ana', name: 'Ana' } });
  assert.deepEqual(r, { tipo: 'retida', plataforma: 'twitch', id: 'm-9', nome: 'Ana', texto: 'isto é um teste', motivo: 'swearing', nivel: 2 });
});

test('mensagem retida sem id é ignorada, e a atualização traz o que decidiram', () => {
  assert.equal(eventoTwitch('AutoModMessageHeld', { rawInput: 'sem id', user: { name: 'Ana' } }), null);
  assert.deepEqual(eventoTwitch('AutoModMessageUpdate', { messageId: 'm-9', status: 'Approved' }), { tipo: 'retidaAtualizada', plataforma: 'twitch', id: 'm-9', status: 'permitida' });
  assert.equal(eventoTwitch('AutoModMessageUpdate', { messageId: 'm-9', status: 'denied' }).status, 'negada');
  assert.equal(eventoTwitch('AutoModMessageUpdate', { messageId: 'm-9', status: 'expired' }).status, 'expirada');
  assert.equal(eventoTwitch('AutoModMessageUpdate', { messageId: 'm-9' }), null);
});

// O formato da documentação do Streamer.bot (Twitch.RewardRedemption): vale pra afiliado, com ou sem texto.
test('resgate de pontos no formato documentado mostra quem resgatou, a recompensa, o custo e o texto', () => {
  const r = eventoTwitch('RewardRedemption', {
    redemptionId: 'r1', status: 'unfulfilled', userInput: 'toma água!', counter: 3, userCounter: 1,
    user: { id: '7', login: 'ana', name: 'Ana', type: 'viewer' },
    reward: { id: 'x', title: 'Hidratar', cost: 300, prompt: 'Beba água', requiresUserInput: true },
    broadcaster: { id: '1', login: 'streamer', name: 'Streamer' },
  });
  assert.equal(r.alerta.event, 'reward');
  assert.equal(r.alerta.principal, 'Ana resgatou');
  assert.equal(r.alerta.detalhe, 'Hidratar · 300 pontos');
  assert.equal(r.alerta.mensagem, 'toma água!');
});

test('resgate de pontos sem texto não mostra a descrição da recompensa como se a pessoa a tivesse escrito', () => {
  const r = eventoTwitch('RewardRedemption', { userInput: null, user: { name: 'Ana' }, reward: { title: 'Hidratar', cost: 300, prompt: 'Beba água' } });
  assert.equal(r.alerta.mensagem, '');
});
