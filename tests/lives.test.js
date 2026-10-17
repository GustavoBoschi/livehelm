import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicialDasLives, aplicarEventoDeLive, totalDeEspectadores, duracaoCurta, tempoNoAr, saudeDeAmostras, estaNoAr, problemasDaTransmissao } from '../src/lives.js';
import { converterEventoStreamerbot } from '../src/streamerbot.js';

const agora = 1_000_000_000_000;

test('espectadores de cada plataforma somam, e quem parou de avisar há mais de 5 min não conta', () => {
  let e = estadoInicialDasLives();
  e = aplicarEventoDeLive(e, { tipo: 'espectadores', plataforma: 'twitch', quantidade: 12, inicioMs: null }, agora);
  e = aplicarEventoDeLive(e, { tipo: 'espectadores', plataforma: 'kick', quantidade: 3, inicioMs: null }, agora - 60_000);
  e = aplicarEventoDeLive(e, { tipo: 'espectadores', plataforma: 'youtube', quantidade: 5, inicioMs: null }, agora - 6 * 60_000);
  const r = totalDeEspectadores(e, agora);
  assert.equal(r.total, 15);
  assert.deepEqual(r.porPlataforma, { twitch: 12, kick: 3 });
  assert.equal(totalDeEspectadores(estadoInicialDasLives(), agora).total, null);
});

test('início e fim da live: StreamOnline guarda o início, StreamOffline zera a plataforma', () => {
  let e = estadoInicialDasLives();
  e = aplicarEventoDeLive(e, { tipo: 'transmissao', plataforma: 'twitch', aoVivo: true, inicioMs: agora - 90_000 }, agora);
  assert.equal(estaNoAr(e.twitch, agora), true);
  assert.equal(tempoNoAr(e.twitch, null, agora), 90_000);
  e = aplicarEventoDeLive(e, { tipo: 'espectadores', plataforma: 'twitch', quantidade: 7, inicioMs: null }, agora);
  assert.equal(e.twitch.inicioMs, agora - 90_000); // o aviso de espectadores sem início não apaga o início
  e = aplicarEventoDeLive(e, { tipo: 'transmissao', plataforma: 'twitch', aoVivo: false, inicioMs: null }, agora);
  assert.equal(estaNoAr(e.twitch, agora), false);
  assert.equal(e.twitch.espectadores, null);
});

test('sem o início da plataforma o tempo vem do OBS; sem nenhum dos dois é nulo', () => {
  const lv = { aoVivo: true, inicioMs: null, espectadores: 1, quandoMs: agora };
  assert.equal(tempoNoAr(lv, 5000, agora), 5000);
  assert.equal(tempoNoAr(lv, null, agora), null);
});

test('duracaoCurta: minutos:segundos até uma hora e h:mm:ss depois', () => {
  assert.equal(duracaoCurta(65_000), '01:05');
  assert.equal(duracaoCurta(3_725_000), '1:02:05');
  assert.equal(duracaoCurta(-5), '00:00');
});

test('saudeDeAmostras: kbps pelo intervalo e % de quadros perdidos', () => {
  const a = { bytes: 0, quadros: 0, perdidos: 0, ms: 0 };
  const b = { bytes: 1_250_000, quadros: 300, perdidos: 3, ms: 5000 };
  assert.deepEqual(saudeDeAmostras(a, b), { kbps: 2000, perdaPct: 1 });
  assert.equal(saudeDeAmostras(null, b), null);
  assert.equal(saudeDeAmostras(b, b), null);
});

const evento = (source, type, data) => converterEventoStreamerbot({ event: { source, type }, data });

test('eventos do Streamer.bot viram espectadores e início/fim de live', () => {
  assert.deepEqual(evento('Kick', 'ViewerCountUpdate', { viewerCount: 8 }), { tipo: 'espectadores', plataforma: 'kick', quantidade: 8, inicioMs: null });
  assert.equal(evento('Twitch', 'ViewerCountUpdate', { viewerCount: 0 }).quantidade, 0);
  assert.equal(evento('Twitch', 'ViewerCountUpdate', {}), null);
  const yt = evento('YouTube', 'StatisticsUpdated', { concurrentViewers: 4, broadcast: { actualStartTime: '2026-10-17T01:00:00Z' } });
  assert.equal(yt.quantidade, 4);
  assert.equal(yt.inicioMs, Date.parse('2026-10-17T01:00:00Z'));
  const on = evento('Twitch', 'StreamOnline', { startedAt: '2026-10-17T02:30:00Z' });
  assert.deepEqual(on, { tipo: 'transmissao', plataforma: 'twitch', aoVivo: true, inicioMs: Date.parse('2026-10-17T02:30:00Z') });
  assert.equal(evento('Kick', 'StreamOnline', {}).inicioMs, null);
  assert.equal(evento('Twitch', 'StreamOffline', {}).aoVivo, false);
  assert.equal(evento('YouTube', 'BroadcastEnded', { broadcast: {} }).aoVivo, false);
});

test('avisos de qualidade em português simples, do mais grave ao mais leve, e vazio quando está tudo certo', () => {
  const calmo = { congestao: 0, reconectando: false, renderPct: 0, encoderPct: 0, fps: 60, msPorQuadro: 4 };
  assert.deepEqual(problemasDaTransmissao(calmo), []);
  const p = problemasDaTransmissao({ ...calmo, congestao: 0.1, renderPct: 5, encoderPct: 1 });
  assert.deepEqual(p.map(x => x.texto), [
    'O OBS está travando: o PC está sobrecarregado',
    'A internet está oscilando um pouco',
    'O PC teve dificuldade de codificar o vídeo',
  ]);
  assert.equal(problemasDaTransmissao({ ...calmo, reconectando: true })[0].texto, 'Reconectando com a plataforma…');
  assert.equal(problemasDaTransmissao({ ...calmo, congestao: 0.5 })[0].texto, 'A internet está ruim e a live pode estar falhando');
});
