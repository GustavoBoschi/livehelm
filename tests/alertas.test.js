import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apareceNoChatGeral, passaNaAba } from '../src/alertas.js';

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

test('aba de plataforma: só as mensagens dela, nunca alertas', () => {
  assert.equal(passaNaAba(chat('twitch'), 'twitch'), true);
  assert.equal(passaNaAba(chat('kick'), 'twitch'), false);
  assert.equal(passaNaAba(alerta('new_follower'), 'twitch'), false);
});
