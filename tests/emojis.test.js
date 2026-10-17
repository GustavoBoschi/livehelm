import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TODOS_OS_EMOJIS, GRUPOS_DE_EMOJI, buscarEmojis, comTom, nomeDoEmoji, semAcento } from '../src/emojiBusca.js';

test('a lista traz todos os emojis do Unicode, com nome, e cada grupo das abas tem emojis', () => {
  assert.ok(TODOS_OS_EMOJIS.length > 1800, `só ${TODOS_OS_EMOJIS.length} emojis`);
  for (const g of GRUPOS_DE_EMOJI) assert.ok(TODOS_OS_EMOJIS.some(e => e.grupo === g.id), `grupo ${g.nome} vazio`);
  assert.ok(TODOS_OS_EMOJIS.every(e => e.emoji && e.nome && e.busca));
  assert.equal(nomeDoEmoji('🔥'), 'fogo');
});

test('busca por texto sem diferenciar acento nem maiúsculas, em português e em inglês, com todas as palavras', () => {
  assert.ok(buscarEmojis(TODOS_OS_EMOJIS, 'fogo').some(e => e.emoji === '🔥'));
  assert.ok(buscarEmojis(TODOS_OS_EMOJIS, 'FOGO').some(e => e.emoji === '🔥'));
  assert.equal(buscarEmojis(TODOS_OS_EMOJIS, 'fogo')[0].emoji, '🔥', 'o nome igual ao texto vem primeiro');
  assert.equal(buscarEmojis(TODOS_OS_EMOJIS, 'coração vermelho')[0].emoji, '❤️');
  assert.ok(buscarEmojis(TODOS_OS_EMOJIS, 'fire').some(e => e.emoji === '🔥'));
  assert.ok(buscarEmojis(TODOS_OS_EMOJIS, 'coracao').some(e => e.emoji === '❤️'), 'sem acento acha coração');
  assert.ok(buscarEmojis(TODOS_OS_EMOJIS, 'dado').some(e => e.emoji === '🎲'));
  const duas = buscarEmojis(TODOS_OS_EMOJIS, 'coração vermelho');
  assert.ok(duas.length > 0 && duas.length < buscarEmojis(TODOS_OS_EMOJIS, 'coração').length);
  assert.deepEqual(buscarEmojis(TODOS_OS_EMOJIS, '   '), []);
  assert.deepEqual(buscarEmojis(TODOS_OS_EMOJIS, 'xyzqwerty'), []);
});

test('tom de pele: muda só quem tem a versão com tom', () => {
  const joia = TODOS_OS_EMOJIS.find(e => e.emoji === '👍');
  assert.equal(comTom(joia, 0), '👍');
  assert.equal(comTom(joia, 3), '👍🏽');
  const fogo = TODOS_OS_EMOJIS.find(e => e.emoji === '🔥');
  assert.equal(comTom(fogo, 3), '🔥');
});

test('semAcento tira acento e põe em minúsculas', () => {
  assert.equal(semAcento('Coração Vermelho'), 'coracao vermelho');
});
