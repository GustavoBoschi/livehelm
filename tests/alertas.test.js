import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apareceNoChatGeral, passaNaAba, ALERTAS_NO_CHAT_GERAL, TIPOS_DE_ALERTA } from '../src/alertas.js';
import { ALERTAS } from '../src/streamerbot.js';

const alerta = event => ({ tipo: 'alerta', plataforma: 'twitch', evento: event });
const chat = plataforma => ({ tipo: 'chat', plataforma });

test('seguidor, sub, sub de presente, apoios em dinheiro e resgate de pontos aparecem no chat geral', () => {
  for (const e of ['new_follower', 'new_subscriber', 'resub', 'subscription_gift', 'sponsorship', 'membermilestone', 'giftpurchase',
    'giftredemption', 'cheer', 'gift', 'jeweldonation', 'hype_chat', 'superchat', 'supersticker', 'raid', 'reward']) {
    assert.equal(apareceNoChatGeral(e), true, e);
  }
});

test('anúncio, hype train, votação e previsão ficam só na aba Alertas', () => {
  for (const e of ['upcoming_ad', 'hype_train', 'poll', 'prediction']) {
    assert.equal(apareceNoChatGeral(e), false, e);
  }
});

test('um alerta de tipo desconhecido não vai para o chat geral (só a aba Alertas mostra tudo)', () => {
  assert.equal(apareceNoChatGeral('evento_novo'), false);
});

test('banimento, silêncio e chat limpo (avisos do próprio dock) ficam só na aba Alertas', () => {
  assert.equal(apareceNoChatGeral('moderacao'), false);
  assert.equal(apareceNoChatGeral(undefined), false);
  assert.equal(apareceNoChatGeral(''), false);
});

test('aba Tudo: mensagens de todas as plataformas e só os alertas liberados', () => {
  assert.equal(passaNaAba(chat('kick'), 'tudo'), true);
  assert.equal(passaNaAba(alerta('new_follower'), 'tudo'), true);
  assert.equal(passaNaAba(alerta('upcoming_ad'), 'tudo'), false);
  assert.equal(passaNaAba(alerta('moderacao'), 'tudo'), false);
  assert.equal(passaNaAba({ tipo: 'alerta', plataforma: 'twitch' }, 'tudo'), false);
});

test('aba Alertas: todos os alertas, inclusive o anúncio e a moderação, e nenhuma mensagem', () => {
  assert.equal(passaNaAba(alerta('upcoming_ad'), 'alertas'), true);
  assert.equal(passaNaAba(alerta('moderacao'), 'alertas'), true);
  assert.equal(passaNaAba(alerta('new_follower'), 'alertas'), true);
  assert.equal(passaNaAba(chat('twitch'), 'alertas'), false);
});

test('aba de plataforma: as mensagens dela e os alertas principais dela (o mesmo que a aba Tudo, só dessa plataforma)', () => {
  const daKick = e => ({ tipo: 'alerta', plataforma: 'kick', evento: e });
  assert.equal(passaNaAba(chat('twitch'), 'twitch'), true);
  assert.equal(passaNaAba(chat('kick'), 'twitch'), false);
  assert.equal(passaNaAba(alerta('new_follower'), 'twitch'), true);
  assert.equal(passaNaAba(alerta('reward'), 'twitch'), true);
  assert.equal(passaNaAba(daKick('reward'), 'kick'), true);
  assert.equal(passaNaAba(daKick('reward'), 'twitch'), false);
  assert.equal(passaNaAba(daKick('new_follower'), 'youtube'), false);
});

test('aba de plataforma: anúncio, moderação e os outros alertas só da aba Alertas continuam fora', () => {
  assert.equal(passaNaAba(alerta('upcoming_ad'), 'twitch'), false);
  assert.equal(passaNaAba(alerta('moderacao'), 'twitch'), false);
  assert.equal(passaNaAba(alerta('hype_train'), 'twitch'), false);
  assert.equal(passaNaAba({ tipo: 'alerta', plataforma: 'twitch' }, 'twitch'), false);
});

// Escolhas do usuário (configurações): quais alertas aparecem também na aba Tudo e nas abas de plataforma.
test('sem escolha nenhuma vale o padrão', () => {
  assert.equal(apareceNoChatGeral('reward', {}), true);
  assert.equal(apareceNoChatGeral('upcoming_ad', {}), false);
  assert.equal(passaNaAba(alerta('reward'), 'tudo', {}), true);
});

test('escolher desligar um alerta do padrão tira ele da aba Tudo e das abas de plataforma', () => {
  const escolhas = { reward: false };
  assert.equal(passaNaAba(alerta('reward'), 'tudo', escolhas), false);
  assert.equal(passaNaAba(alerta('reward'), 'twitch', escolhas), false);
  assert.equal(passaNaAba(alerta('new_follower'), 'tudo', escolhas), true);
});

test('escolher ligar um alerta que o padrão esconde traz ele para a aba Tudo e para as abas de plataforma', () => {
  const escolhas = { upcoming_ad: true, moderacao: true };
  assert.equal(passaNaAba(alerta('upcoming_ad'), 'tudo', escolhas), true);
  assert.equal(passaNaAba(alerta('upcoming_ad'), 'twitch', escolhas), true);
  assert.equal(passaNaAba(alerta('upcoming_ad'), 'kick', escolhas), false);
  assert.equal(passaNaAba(alerta('moderacao'), 'tudo', escolhas), true);
});

test('a aba Alertas mostra todos os alertas, qualquer que seja a escolha', () => {
  const tudoDesligado = Object.fromEntries(TIPOS_DE_ALERTA.flatMap(g => g.itens.map(i => [i.id, false])));
  for (const g of TIPOS_DE_ALERTA) for (const i of g.itens) assert.equal(passaNaAba(alerta(i.id), 'alertas', tudoDesligado), true, i.id);
  assert.equal(passaNaAba(chat('twitch'), 'alertas', tudoDesligado), false);
});

test('as escolhas não mexem nas mensagens de chat', () => {
  const tudoDesligado = Object.fromEntries(TIPOS_DE_ALERTA.flatMap(g => g.itens.map(i => [i.id, false])));
  assert.equal(passaNaAba(chat('kick'), 'tudo', tudoDesligado), true);
  assert.equal(passaNaAba(chat('kick'), 'kick', tudoDesligado), true);
});

test('só um valor verdadeiro ou falso conta como escolha (o resto volta ao padrão)', () => {
  assert.equal(apareceNoChatGeral('reward', { reward: 'nao' }), true);
  assert.equal(apareceNoChatGeral('upcoming_ad', { upcoming_ad: null }), false);
  assert.equal(apareceNoChatGeral('constructor', {}), false);
});

test('catálogo: ids únicos, com nome, e todo alerta do padrão e do streamerbot.js está nele', () => {
  const ids = TIPOS_DE_ALERTA.flatMap(g => g.itens.map(i => i.id));
  assert.equal(new Set(ids).size, ids.length, 'ids repetidos');
  for (const g of TIPOS_DE_ALERTA) {
    assert.ok(g.grupo, 'grupo sem nome');
    for (const i of g.itens) assert.ok(i.nome, `${i.id} sem nome`);
  }
  for (const e of ALERTAS_NO_CHAT_GERAL) assert.ok(ids.includes(e), `padrão ${e} fora do catálogo`);
  for (const def of Object.values(ALERTAS)) assert.ok(ids.includes(def.event), `alerta ${def.event} do streamerbot.js fora do catálogo`);
  assert.ok(ids.includes('moderacao'));
});
