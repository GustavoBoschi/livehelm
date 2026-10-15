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
