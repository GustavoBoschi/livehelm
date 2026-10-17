import { test } from 'node:test';
import assert from 'node:assert/strict';
import { converterEventoStreamerbot } from '../src/streamerbot.js';

const alerta = (source, type, data) => converterEventoStreamerbot({ event: { source, type }, data })?.alerta;
const ana = { id: '1', login: 'ana', name: 'Ana' };
const beto = { id: '2', login: 'beto', name: 'Beto' };
const caio = { id: '3', login: 'caio', name: 'Caio' };

test('Twitch.GiftSub: quem presenteou no alerta e para quem foi na linha de baixo', () => {
  const a = alerta('Twitch', 'GiftSub', { user: ana, recipient: beto, subTier: '1000' });
  assert.equal(a.event, 'subscription_gift');
  assert.equal(a.principal, 'Ana presenteou');
  assert.equal(a.detalhe, 'Para Beto · Tier 1');
});

test('Twitch.GiftBomb: quantos subs e os primeiros presenteados, com "e mais N" quando passa de três', () => {
  const quatro = [ana, beto, caio, { login: 'dani' }];
  const a = alerta('Twitch', 'GiftBomb', { user: ana, total: 4, recipients: quatro, subTier: '2000' });
  assert.equal(a.principal, 'Ana presenteou');
  assert.equal(a.detalhe, '4 subs · Para Ana, Beto, Caio e mais 1 · Tier 2');
  assert.equal(alerta('Twitch', 'GiftBomb', { user: ana, total: 1, recipients: null }).detalhe, '1 sub');
});

test('Kick.GiftSubscription e MassGiftSubscription: presenteado, lista e presente anônimo', () => {
  assert.equal(alerta('Kick', 'GiftSubscription', { user: ana, recipient: beto }).detalhe, 'Para Beto');
  const anonimo = alerta('Kick', 'GiftSubscription', { isAnonymous: true, user: null, recipient: beto });
  assert.equal(anonimo.principal, 'Anônimo presenteou');
  const massa = alerta('Kick', 'MassGiftSubscription', { user: ana, recipients: [beto, caio] });
  assert.equal(massa.detalhe, '2 subs · Para Beto, Caio');
});

test('YouTube: MembershipGift diz quantos membros; GiftMembershipReceived diz quem presenteou e quem recebeu', () => {
  const compra = alerta('YouTube', 'MembershipGift', { user: ana, count: 5, tier: 'Nível 1' });
  assert.equal(compra.principal, 'Ana presenteou');
  assert.equal(compra.detalhe, '5 membros · Nível 1');
  const recebida = alerta('YouTube', 'GiftMembershipReceived', { user: beto, gifter: ana });
  assert.equal(recebida.principal, 'Ana presenteou');
  assert.equal(recebida.detalhe, 'Para Beto');
});

test('presente sem informação do presenteado não quebra: só quem presenteou', () => {
  const a = alerta('Twitch', 'GiftSub', { user: ana });
  assert.equal(a.principal, 'Ana presenteou');
  assert.equal(a.detalhe, '');
});
