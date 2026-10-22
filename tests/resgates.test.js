import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lembrarResgate, mensagemRepeteResgate, mesmoTextoDoResgate, JANELA_DO_RESGATE_MS } from '../src/resgates.js';

const resgate = { plataforma: 'twitch', nome: 'Ana', texto: 'Toma ÁGUA, mestre!', quando: 1000 };

test('a mensagem do chat que repete o texto do resgate é reconhecida (sem diferenciar maiúsculas, acentos e espaços)', () => {
  assert.equal(mesmoTextoDoResgate(resgate, { plataforma: 'twitch', nome: 'ana', texto: 'toma agua,  mestre!', quando: 2500 }), true);
});

test('outro autor, outra plataforma, outro texto ou passado da janela não é repetição', () => {
  const base = { plataforma: 'twitch', nome: 'Ana', texto: 'toma agua, mestre!', quando: 2000 };
  assert.equal(mesmoTextoDoResgate(resgate, { ...base, nome: 'Beto' }), false);
  assert.equal(mesmoTextoDoResgate(resgate, { ...base, plataforma: 'kick' }), false);
  assert.equal(mesmoTextoDoResgate(resgate, { ...base, texto: 'outra coisa' }), false);
  assert.equal(mesmoTextoDoResgate(resgate, { ...base, quando: 1000 + JANELA_DO_RESGATE_MS + 1 }), false);
  assert.equal(mesmoTextoDoResgate(resgate, { ...base, texto: '' }), false);
});

test('a lista guarda só resgates com texto e esquece os antigos', () => {
  let lista = [];
  lista = lembrarResgate(lista, { plataforma: 'twitch', nome: 'Ana', texto: '', quando: 1000 }, 1000);
  assert.equal(lista.length, 0, 'resgate sem texto não entra');
  lista = lembrarResgate(lista, resgate, 1000);
  assert.equal(lista.length, 1);
  lista = lembrarResgate(lista, { plataforma: 'kick', nome: 'Beto', texto: 'oi', quando: 1000 + JANELA_DO_RESGATE_MS + 5 }, 1000 + JANELA_DO_RESGATE_MS + 5);
  assert.deepEqual(lista.map(r => r.nome), ['Beto'], 'o antigo saiu');
});

test('mensagemRepeteResgate pergunta à lista pela mensagem que acabou de chegar', () => {
  const lista = lembrarResgate([], resgate, 1000);
  assert.equal(mensagemRepeteResgate(lista, { plataforma: 'twitch', nome: 'Ana', texto: 'toma água, mestre!' }, 3000), true);
  assert.equal(mensagemRepeteResgate(lista, { plataforma: 'twitch', nome: 'Ana', texto: 'bom dia' }, 3000), false);
});
