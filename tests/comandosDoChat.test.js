import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comandosDoChat, sugestoesDeComando, textoDoComando } from '../src/comandosDoChat.js';

const nomes = lista => lista.map(c => c.nome);

test('cada chat mostra só os comandos que valem para ele', () => {
  assert.deepEqual(nomes(comandosDoChat(['twitch'])), ['ban', 'timeout', 'limpar', 'emotes', 'subs', 'lento', 'seguidores', 'escudo', 'limpardock', 'limparresgates']);
  assert.deepEqual(nomes(comandosDoChat(['kick'])), ['ban', 'timeout', 'limpardock', 'limparresgates']);
  assert.deepEqual(nomes(comandosDoChat(['youtube'])), ['ban', 'timeout', 'limpardock', 'limparresgates']);
  assert.ok(nomes(comandosDoChat(['kick', 'twitch'])).includes('emotes'), 'com a Twitch junto, os modos aparecem');
  assert.deepEqual(nomes(comandosDoChat([])), ['limpardock', 'limparresgates'], 'sem plataforma, só os do próprio dock');
});

test('os modos sem a ação Painel: Controles ficam na lista marcados', () => {
  const lista = comandosDoChat(['twitch'], { temControles: false });
  assert.equal(lista.find(c => c.nome === 'subs').semAcao, true);
  assert.equal(lista.find(c => c.nome === 'ban').semAcao, undefined);
});

test('a lista filtra pelo que já foi digitado, também pelos apelidos', () => {
  const lista = comandosDoChat(['twitch']);
  assert.equal(sugestoesDeComando('/', lista).length, lista.length);
  assert.deepEqual(nomes(sugestoesDeComando('/s', lista)), ['timeout', 'subs', 'lento', 'seguidores', 'escudo'], 'entram pelo nome ou pelo apelido (silenciar, slow, shield)');
  assert.deepEqual(nomes(sugestoesDeComando('/su', lista)), ['subs']);
  assert.deepEqual(nomes(sugestoesDeComando('/silenc', lista)), ['timeout'], 'apelido');
  assert.deepEqual(nomes(sugestoesDeComando('/LIMPAR', lista)), ['limpar', 'limpardock', 'limparresgates']);
  assert.deepEqual(sugestoesDeComando('/xyz', lista), []);
});

test('a lista some quando não é mais o nome do comando', () => {
  const lista = comandosDoChat(['twitch']);
  assert.deepEqual(sugestoesDeComando('oi', lista), []);
  assert.deepEqual(sugestoesDeComando('/ban fulano', lista), []);
  assert.deepEqual(sugestoesDeComando('', lista), []);
});

test('escolher um comando põe um espaço no fim só quando ele leva argumento', () => {
  const lista = comandosDoChat(['twitch']);
  assert.equal(textoDoComando(lista.find(c => c.nome === 'ban')), '/ban ');
  assert.equal(textoDoComando(lista.find(c => c.nome === 'limpar')), '/limpar');
  assert.equal(textoDoComando(lista.find(c => c.nome === 'subs')), '/subs ');
});
