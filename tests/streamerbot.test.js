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
