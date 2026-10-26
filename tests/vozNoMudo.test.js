import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APAGAR_DEPOIS_MS, JANELA, LIMIAR_MAXIMO, LIMIAR_MINIMO, MINIMO_NA_JANELA, criarDetector, emDb, nivelDaEntrada, textoDoTesteDoMic } from '../src/vozNoMudo.js';

const medidor = (nivel, nome = 'Mic/Aux') => ({ inputs: [{ inputName: 'Desktop', inputLevelsMul: [[0.9, 0.9, 0.9]] }, { inputName: nome, inputLevelsMul: [[0, 0, nivel], [0, 0, nivel / 2]] }] });
const silencio = (d, t, n = 40, nivel = 0.0004) => { for (let i = 0; i < n; i++) d.processar(medidor(nivel), 'Mic/Aux', (t.v += 50)); };

test('o nível da entrada vem do pico da entrada, do maior canal; entrada que não está no medidor é null', () => {
  assert.equal(nivelDaEntrada(medidor(0.2), 'Mic/Aux'), 0.2);
  assert.equal(nivelDaEntrada({ inputs: [{ inputName: 'Mic/Aux', inputLevelsMul: [[0.01, 0.4]] }] }, 'Mic/Aux'), 0.4);
  assert.equal(nivelDaEntrada({ inputs: [{ inputName: 'Mic/Aux', inputLevelsMul: [[0.3]] }] }, 'Mic/Aux'), 0.3);
  assert.equal(nivelDaEntrada(medidor(0.2), 'Outro'), null);
  assert.equal(nivelDaEntrada(null, 'Mic/Aux'), null);
  assert.equal(nivelDaEntrada({ inputs: [{ inputName: 'Mic/Aux', inputLevelsMul: 'x' }] }, 'Mic/Aux'), null);
});

test('o formato real do OBS: com o mudo, magnitude e pico vêm zerados e só o pico da entrada mostra o som', () => {
  const real = { inputs: [{ inputLevelsMul: [[0, 0, 0.0004], [0, 0, 0.0004]], inputName: 'Mic/Aux', inputUuid: 'x' }, { inputLevelsMul: [], inputName: 'Desktop' }] };
  assert.equal(nivelDaEntrada(real, 'Mic/Aux'), 0.0004);
  assert.equal(nivelDaEntrada(real, 'Desktop'), 0);
});

test('voz de verdade avisa em meio segundo, mesmo com ganho baixo (-35 dB); o chiado da sala não avisa', () => {
  const d = criarDetector(); const t = { v: 1000 };
  silencio(d, t, 60);
  assert.equal(d.falando, false);
  const voz = 0.018; // -35 dB: um microfone de ganho baixo
  let avisou = null;
  for (let i = 1; i <= JANELA; i++) { d.processar(medidor(voz), 'Mic/Aux', (t.v += 50)); if (d.falando && avisou === null) avisou = i; }
  assert.equal(avisou, MINIMO_NA_JANELA);
  assert.equal(d.falando, true);
});

test('fala com pausas (uma sílaba sim, outra não) também avisa', () => {
  const d = criarDetector(); const t = { v: 0 };
  silencio(d, t, 60);
  for (let i = 0; i < 12; i++) d.processar(medidor(i % 2 ? 0.0004 : 0.1), 'Mic/Aux', (t.v += 50));
  assert.equal(d.falando, true);
});

test('um estalo ou uma tosse isolada (1 a 3 medições) não avisa', () => {
  const d = criarDetector(); const t = { v: 0 };
  silencio(d, t, 60);
  for (let rodada = 0; rodada < 10; rodada++) {
    for (let i = 0; i < MINIMO_NA_JANELA - 1; i++) d.processar(medidor(0.4), 'Mic/Aux', (t.v += 50));
    silencio(d, t, JANELA);
  }
  assert.equal(d.falando, false);
});

test('o limiar acompanha o ruído da sala, sempre entre o mínimo (-42 dB) e o máximo (-30 dB)', () => {
  const quieto = criarDetector(); const t = { v: 0 };
  silencio(quieto, t, 60, 0.0004);
  assert.equal(quieto.limiar, LIMIAR_MINIMO);
  const barulhento = criarDetector();
  silencio(barulhento, t, 60, 0.012);
  assert.ok(barulhento.limiar > LIMIAR_MINIMO && barulhento.limiar <= LIMIAR_MAXIMO);
  const muito = criarDetector();
  silencio(muito, t, 60, 0.2);
  assert.equal(muito.limiar, LIMIAR_MAXIMO);
  assert.ok(Math.abs(emDb(LIMIAR_MINIMO) + 42) < 0.1);
});

test('o aviso apaga depois de um tempo sem som, e zerar apaga na hora', () => {
  const d = criarDetector(); const t = { v: 0 };
  silencio(d, t, 60);
  for (let i = 0; i < JANELA; i++) d.processar(medidor(0.3), 'Mic/Aux', (t.v += 50));
  assert.equal(d.falando, true);
  assert.equal(d.expirar(t.v + APAGAR_DEPOIS_MS - 10), true);
  assert.equal(d.expirar(t.v + APAGAR_DEPOIS_MS + 10), false);
  for (let i = 0; i < JANELA; i++) d.processar(medidor(0.3), 'Mic/Aux', (t.v += 50));
  assert.equal(d.falando, true);
  d.zerar();
  assert.equal(d.falando, false);
  assert.equal(d.maximo, 0);
});

test('a medição de outra entrada não mexe no detector', () => {
  const d = criarDetector();
  for (let i = 0; i < 30; i++) d.processar(medidor(0.9, 'Outra'), 'Mic/Aux', i * 50);
  assert.equal(d.falando, false);
  assert.equal(d.maximo, 0);
});

test('o texto do teste: funciona, som baixo, quase sem som, sem medições e erro', () => {
  const base = { ok: true, medicoes: 90, mudo: true, maxDb: -20, limiarDb: -42, avisaria: true };
  assert.equal(textoDoTesteDoMic(base, 'Mic/Aux').nivel, 0);
  assert.match(textoDoTesteDoMic(base, 'Mic/Aux').texto, /O aviso funciona: o nível mais alto foi -20 dB\./);
  assert.match(textoDoTesteDoMic({ ...base, mudo: false }, 'Mic/Aux').texto, /aberto agora/);
  const baixo = textoDoTesteDoMic({ ...base, avisaria: false, maxDb: -48 }, 'Mic/Aux');
  assert.equal(baixo.nivel, 1);
  assert.match(baixo.texto, /-48 dB, abaixo do que o aviso pede \(-42 dB\)/);
  assert.match(textoDoTesteDoMic({ ...base, avisaria: false, maxDb: -80 }, 'Mic/Aux').texto, /Quase não chegou som/);
  assert.equal(textoDoTesteDoMic({ ...base, medicoes: 0, avisaria: false }, 'Mic/Aux').nivel, 2);
  assert.match(textoDoTesteDoMic({ ok: false, erro: 'o OBS recusou' }, 'Mic/Aux').texto, /o OBS recusou/);
});
