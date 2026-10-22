import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limparTags, adicionarTags, removerTag, mesmasTags, respostaDaLeitura, aguardarLeitura } from '../src/tagsLista.js';

test('limparTags tira #, símbolos e repetidas (sem diferenciar maiúsculas)', () => {
  assert.deepEqual(limparTags('#rpg #dados, RPG | Mesa'), ['rpg', 'dados', 'Mesa']);
});

test('limparTags corta cada tag em 25 caracteres e a lista em 10', () => {
  assert.deepEqual(limparTags('a'.repeat(30)), ['a'.repeat(25)]);
  assert.equal(limparTags('a b c d e f g h i j k l').length, 10);
});

test('adicionarTags acrescenta no fim sem repetir as que já estão', () => {
  assert.deepEqual(adicionarTags(['rpg'], '#dados #RPG'), ['rpg', 'dados']);
});

test('adicionarTags não passa de 10 tags', () => {
  const dez = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  assert.deepEqual(adicionarTags(dez, '#nova'), dez);
});

test('adicionarTags com texto vazio devolve a mesma lista, sem alterar a original', () => {
  const lista = ['rpg'];
  const nova = adicionarTags(lista, '   ');
  assert.deepEqual(nova, ['rpg']);
  assert.notEqual(nova, lista);
});

test('removerTag tira a tag sem diferenciar maiúsculas', () => {
  assert.deepEqual(removerTag(['rpg', 'dados'], 'RPG'), ['dados']);
});

test('mesmasTags ignora ordem e maiúsculas', () => {
  assert.equal(mesmasTags(['rpg', 'dados'], ['Dados', 'rpg']), true);
  assert.equal(mesmasTags(['rpg'], ['rpg', 'dados']), false);
  assert.equal(mesmasTags([], []), true);
});

test('mesmasTags é falso quando a lista do canal ainda não foi lida', () => {
  assert.equal(mesmasTags(['rpg'], null), false);
});

// Só os campos de sempre (as leituras novas têm teste próprio).
const basico = r => ({ ok: r.ok, tags: r.tags, erro: r.erro });
const leitura = (pedido, extra = {}) => JSON.stringify({ pedido, ok: true, tags: ['rpg', 'dados'], erro: '', ...extra });

test('respostaDaLeitura devolve as tags quando o pedido é o esperado (valor como texto)', () => {
  const r = respostaDaLeitura({ status: 'ok', value: leitura('p1') }, 'p1');
  assert.deepEqual(r, { ok: true, tags: ['rpg', 'dados'], erro: '', titulo: '', categoria: '', afiliado: null, parceiro: null, youtube: { titulo: '', categoria: '' } });
});

test('respostaDaLeitura traz título, categoria, afiliação e a reserva do YouTube quando a ação nova responde', () => {
  const r = respostaDaLeitura({ status: 'ok', value: leitura('p1', { titulo: 'Mesa de RPG', categoria: "Baldur's Gate 3", afiliado: false, parceiro: false, youtube: { titulo: 'Live YT', categoria: 'Gaming' } }) }, 'p1');
  assert.equal(r.titulo, 'Mesa de RPG');
  assert.equal(r.categoria, "Baldur's Gate 3");
  assert.equal(r.afiliado, false);
  assert.deepEqual(r.youtube, { titulo: 'Live YT', categoria: 'Gaming' });
});

test('respostaDaLeitura entende o valor dentro de variable', () => {
  const r = respostaDaLeitura({ status: 'ok', variable: { name: 'painelTags', value: leitura('p1') } }, 'p1');
  assert.deepEqual(r.tags, ['rpg', 'dados']);
});

// Formato que o Streamer.bot 1.0.7 devolve de verdade ao GetGlobal: um mapa `variables` com o nome da variável.
test('respostaDaLeitura entende a resposta real do GetGlobal ({ variables: { nome: { value } } })', () => {
  const resposta = {
    id: 'pedido-1', count: 1, status: 'ok',
    variables: { painelTags: { name: 'painelTags', value: leitura('p1', { tags: ['Português'] }), lastWrite: '2026-10-13T20:16:03.88-03:00' } },
  };
  assert.deepEqual(basico(respostaDaLeitura(resposta, 'p1')), { ok: true, tags: ['Português'], erro: '' });
});

test('respostaDaLeitura ignora o mapa variables vazio', () => {
  assert.equal(respostaDaLeitura({ status: 'ok', count: 0, variables: {} }, 'p1'), null);
});

test('respostaDaLeitura ignora a leitura de outro pedido (resposta antiga)', () => {
  assert.equal(respostaDaLeitura({ status: 'ok', value: leitura('antigo') }, 'p1'), null);
});

test('respostaDaLeitura devolve null enquanto a variável não existe', () => {
  assert.equal(respostaDaLeitura({ status: 'error', error: "Variable 'painelTags' not found" }, 'p1'), null);
});

test('respostaDaLeitura repassa o erro que a ação anotou', () => {
  const r = respostaDaLeitura({ status: 'ok', value: leitura('p1', { ok: false, tags: [], erro: 'Twitch desconectada' }) }, 'p1');
  assert.deepEqual(basico(r), { ok: false, tags: [], erro: 'Twitch desconectada' });
});

test('respostaDaLeitura ignora valor que não é JSON', () => {
  assert.equal(respostaDaLeitura({ status: 'ok', value: 'lixo' }, 'p1'), null);
});

const RAPIDO = { limiteMs: 500, intervaloMs: 5 };

test('aguardarLeitura tenta de novo até a leitura do pedido chegar', async () => {
  const respostas = [
    { status: 'error', error: "Variable 'painelTags' not found" },
    { status: 'ok', value: leitura('antigo') },
    { status: 'ok', value: leitura('p1') },
  ];
  let chamadas = 0;
  const r = await aguardarLeitura(async () => respostas[Math.min(chamadas++, respostas.length - 1)], 'p1', RAPIDO);
  assert.deepEqual(basico(r), { ok: true, tags: ['rpg', 'dados'], erro: '' });
  assert.equal(chamadas, 3);
});

test('aguardarLeitura devolve null quando o tempo acaba sem resposta do pedido', async () => {
  const r = await aguardarLeitura(async () => ({ status: 'error', error: 'not found' }), 'p1', { limiteMs: 30, intervaloMs: 5 });
  assert.equal(r, null);
});

test('aguardarLeitura não fica presa se a busca falhar', async () => {
  const r = await aguardarLeitura(async () => { throw new Error('caiu'); }, 'p1', { limiteMs: 30, intervaloMs: 5 });
  assert.equal(r, null);
});

import { respostaDoYoutube } from '../src/tagsLista.js';

test('respostaDoYoutube traz o resultado da ação do YouTube só quando o pedido é o esperado', () => {
  const valor = JSON.stringify({ pedido: 'p7', ok: true, erro: '', titulo: 'Live nova', categoria: 'Gaming', avisos: '', semTransmissao: false });
  assert.deepEqual(respostaDoYoutube({ status: 'ok', variables: { painelYoutube: { value: valor } } }, 'p7'), { ok: true, erro: '', titulo: 'Live nova', categoria: 'Gaming', avisos: '', semTransmissao: false, versao: 1, descricao: '', tags: [], descricaoOk: true, tagsOk: true });
  assert.equal(respostaDoYoutube({ status: 'ok', variables: { painelYoutube: { value: valor } } }, 'outro'), null);
  const falha = JSON.stringify({ pedido: 'p8', ok: false, erro: 'nenhuma transmissão monitorada' });
  assert.equal(respostaDoYoutube({ status: 'ok', value: falha }, 'p8').erro, 'nenhuma transmissão monitorada');
});

test('respostaDoYoutube traz o aviso de que não havia transmissão para mudar', () => {
  const valor = JSON.stringify({ pedido: 'p9', ok: false, erro: 'nenhuma transmissão', semTransmissao: true });
  assert.equal(respostaDoYoutube({ status: 'ok', value: valor }, 'p9').semTransmissao, true);
  assert.equal(respostaDoYoutube({ status: 'ok', value: JSON.stringify({ pedido: 'p9', ok: true }) }, 'p9').semTransmissao, false);
});

test('respostaDoYoutube traz a versão do código, a descrição, as tags e o resultado de cada uma', () => {
  const valor = JSON.stringify({ pedido: 'p20', ok: true, versao: 2, descricao: 'linha 1\nlinha 2', tags: ['rpg', 'marvel rivals'], descricaoOk: false, tagsOk: true });
  const r = respostaDoYoutube({ status: 'ok', value: valor }, 'p20');
  assert.equal(r.versao, 2);
  assert.equal(r.descricao, 'linha 1\nlinha 2');
  assert.deepEqual(r.tags, ['rpg', 'marvel rivals']);
  assert.equal(r.descricaoOk, false);
  assert.equal(r.tagsOk, true);
  // o código antigo da ação não manda versão: vale 1
  assert.equal(respostaDoYoutube({ status: 'ok', value: JSON.stringify({ pedido: 'p21', ok: true }) }, 'p21').versao, 1);
});
