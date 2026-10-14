import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pastaDeClipesValida } from '../src/pastaClipes.js';

test('pasta vazia vale: a ação usa a pasta padrão dela', () => {
  assert.equal(pastaDeClipesValida(''), true);
});

test('aceita pasta local com letra de unidade, com barra normal ou invertida', () => {
  assert.equal(pastaDeClipesValida('C:\\Clipes'), true);
  assert.equal(pastaDeClipesValida('d:/Transmissao/Clipes'), true);
  assert.equal(pastaDeClipesValida('C:\\Meus Clipes\\Lives'), true);
});

test('recusa caminho de rede (UNC), que faria o Windows tentar autenticar em outro computador', () => {
  assert.equal(pastaDeClipesValida('\\\\servidor\\pasta'), false);
  assert.equal(pastaDeClipesValida('//servidor/pasta'), false);
  assert.equal(pastaDeClipesValida('\\\\?\\C:\\Clipes'), false);
});

test('recusa caminho relativo ou sem letra de unidade', () => {
  assert.equal(pastaDeClipesValida('Clipes'), false);
  assert.equal(pastaDeClipesValida('..\\Clipes'), false);
  assert.equal(pastaDeClipesValida('\\Clipes'), false);
  assert.equal(pastaDeClipesValida('C:Clipes'), false);
  assert.equal(pastaDeClipesValida('C:'), false);
});

test('recusa ".." em qualquer parte do caminho', () => {
  assert.equal(pastaDeClipesValida('C:\\Clipes\\..\\Windows'), false);
  assert.equal(pastaDeClipesValida('C:/Clipes/../Windows'), false);
  assert.equal(pastaDeClipesValida('C:\\..'), false);
});

test('um nome que só contém pontos no meio não é ".."', () => {
  assert.equal(pastaDeClipesValida('C:\\Clipes..antigos'), true);
});
