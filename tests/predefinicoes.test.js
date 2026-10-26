import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PREDEFINICOES, criarPredefinicao, lerPredefinicoes, removerPredefinicao, resumoDaPredefinicao, salvarPredefinicao } from '../src/predefinicoes.js';
import { respostaDosControles } from '../src/tagsLista.js';

const base = { nome: 'Rank', titulo: 'Marvel Rivals -> subindo de rank', categoria: 'Marvel Rivals', tags: ['#rpg', 'Português', 'rpg'], categoriaYoutube: '' };

test('uma predefinição guarda título, categoria, tags limpas (sem #, sem repetir) e a categoria do YouTube, com id', () => {
  const p = criarPredefinicao({ ...base, nome: '  Rank  ', categoriaYoutube: ' Gaming ' });
  assert.equal(p.nome, 'Rank');
  assert.equal(p.titulo, 'Marvel Rivals -> subindo de rank');
  assert.deepEqual(p.tags, ['rpg', 'Português']);
  assert.equal(p.categoriaYoutube, 'Gaming');
  assert.ok(p.id.length >= 4);
});

test('sem nome, ou sem nada para guardar (título, categoria e tags vazios), não há predefinição', () => {
  assert.equal(criarPredefinicao({ ...base, nome: '   ' }), null);
  assert.equal(criarPredefinicao({ nome: 'Vazia', titulo: '', categoria: ' ', tags: [] }), null);
  assert.notEqual(criarPredefinicao({ nome: 'Só tags', tags: ['dados'] }), null);
  assert.notEqual(criarPredefinicao({ nome: 'Só categoria', categoria: 'Just Chatting' }), null);
});

test('o nome tem no máximo 40 letras e o título 140', () => {
  const p = criarPredefinicao({ nome: 'n'.repeat(80), titulo: 't'.repeat(300), categoria: 'x' });
  assert.equal(p.nome.length, 40);
  assert.equal(p.titulo.length, 140);
});

test('guardar com o mesmo nome (sem diferenciar maiúsculas e acentos) substitui no mesmo lugar e mantém o id; nome novo vai para o fim', () => {
  const a = criarPredefinicao({ ...base, nome: 'Programando' });
  const b = criarPredefinicao({ ...base, nome: 'Just Chatting', categoria: 'Just Chatting' });
  let lista = salvarPredefinicao(salvarPredefinicao([], a).lista, b).lista;
  assert.deepEqual(lista.map(p => p.nome), ['Programando', 'Just Chatting']);
  const nova = criarPredefinicao({ ...base, nome: 'PROGRAMANDO', titulo: 'Outro título' });
  const r = salvarPredefinicao(lista, nova);
  assert.equal(r.substituiu, true);
  assert.deepEqual(r.lista.map(p => p.nome), ['PROGRAMANDO', 'Just Chatting']);
  assert.equal(r.lista[0].id, a.id);
  assert.equal(r.lista[0].titulo, 'Outro título');
});

test('a lista tem um limite: cheia, uma predefinição nova é recusada com o motivo, e uma de nome já existente ainda é atualizada', () => {
  let lista = [];
  for (let i = 0; i < MAX_PREDEFINICOES; i++) lista = salvarPredefinicao(lista, criarPredefinicao({ ...base, nome: `Modo ${i}` })).lista;
  assert.equal(lista.length, MAX_PREDEFINICOES);
  const cheia = salvarPredefinicao(lista, criarPredefinicao({ ...base, nome: 'Mais um' }));
  assert.equal(cheia.lista, lista);
  assert.match(cheia.erro, /no máximo 20/);
  assert.equal(salvarPredefinicao(lista, criarPredefinicao({ ...base, nome: 'modo 3' })).erro, '');
});

test('apagar tira só a predefinição do id', () => {
  const a = criarPredefinicao({ ...base, nome: 'A' });
  const b = criarPredefinicao({ ...base, nome: 'B' });
  assert.deepEqual(removerPredefinicao([a, b], a.id).map(p => p.nome), ['B']);
});

test('lerPredefinicoes aceita só o que tem o formato: lixo some, o id guardado fica e o que passa do limite sai', () => {
  assert.deepEqual(lerPredefinicoes(null), []);
  assert.deepEqual(lerPredefinicoes('texto'), []);
  const lida = lerPredefinicoes([{ id: 'abc', nome: 'Rank', titulo: 'x', categoria: 'y', tags: ['a'] }, null, 5, { nome: '' }, { nome: 'sem nada' }]);
  assert.equal(lida.length, 1);
  assert.equal(lida[0].id, 'abc');
  const muitas = Array.from({ length: 30 }, (_, i) => ({ nome: `P${i}`, titulo: 't' }));
  assert.equal(lerPredefinicoes(muitas).length, MAX_PREDEFINICOES);
});

test('o resumo diz o que a predefinição faz, numa linha', () => {
  assert.equal(resumoDaPredefinicao(criarPredefinicao({ ...base, categoriaYoutube: 'Gaming' })), 'Marvel Rivals -> subindo de rank · Marvel Rivals · 2 tags · YouTube: Gaming');
  assert.equal(resumoDaPredefinicao(criarPredefinicao({ nome: 'x', categoria: 'Just Chatting', tags: ['um'] })), 'Just Chatting · 1 tag');
});

test('a resposta da ação Painel: Controles: só a do pedido, com ok, erro e o link do clipe', () => {
  const resposta = (valor, status = 'ok') => ({ status, variables: { painelControles: { name: 'painelControles', value: valor } } });
  const json = o => JSON.stringify(o);
  assert.deepEqual(respostaDosControles(resposta(json({ pedido: 'p1', ok: true, erro: '', url: 'https://clips.twitch.tv/X' })), 'p1'), { ok: true, erro: '', url: 'https://clips.twitch.tv/X', versao: 1, perfil: null });
  assert.deepEqual(respostaDosControles(resposta(json({ pedido: 'p1', ok: false, erro: 'sem live' })), 'p1'), { ok: false, erro: 'sem live', url: '', versao: 1, perfil: null });
  assert.equal(respostaDosControles(resposta(json({ pedido: 'outro', ok: true })), 'p1'), null);
  assert.equal(respostaDosControles(resposta('não é json'), 'p1'), null);
  assert.equal(respostaDosControles({ status: 'error' }, 'p1'), null);
});

test('a resposta de Painel: Controles traz a versão do código e o perfil (objeto) de quem escreve', () => {
  const resposta = valor => ({ status: 'ok', variables: { painelControles: { name: 'painelControles', value: JSON.stringify(valor) } } });
  const r = respostaDosControles(resposta({ pedido: 'p2', ok: true, versao: 2, perfil: { nome: 'Maria', seguindo: true } }), 'p2');
  assert.equal(r.versao, 2);
  assert.deepEqual(r.perfil, { nome: 'Maria', seguindo: true });
  assert.equal(respostaDosControles(resposta({ pedido: 'p3', ok: true, perfil: 'texto' }), 'p3').perfil, null);
});
