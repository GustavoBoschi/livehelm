import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertaDoLivePix, dadosDoLivePixNaMensagem, valorDaDoacao } from '../src/livepix.js';
import { converterEventoStreamerbot } from '../src/streamerbot.js';
import { passaNaAba, apareceNoChatGeral, TIPOS_DE_ALERTA } from '../src/alertas.js';
import { plataformaDe } from '../src/plataformas.js';

const doacao = { id: 'm1', username: 'Ana', message: 'Valeu pela live!', amount: 1500, currency: 'BRL', flagged: false, createdAt: '2026-10-24T20:00:00.000Z' };
const aviso = { event: { source: 'Custom', type: 'LivePix' }, data: doacao };

test('o aviso chega em qualquer envelope: Custom.LivePix, General.Custom com objeto, com texto ou com um envelope a mais', () => {
  assert.deepEqual(dadosDoLivePixNaMensagem(aviso), doacao);
  assert.deepEqual(dadosDoLivePixNaMensagem({ event: { source: 'General', type: 'Custom' }, data: aviso }), doacao);
  assert.deepEqual(dadosDoLivePixNaMensagem({ event: { source: 'General', type: 'Custom' }, data: JSON.stringify(aviso) }), doacao);
  assert.deepEqual(dadosDoLivePixNaMensagem({ event: { source: 'General', type: 'Custom' }, data: { data: aviso } }), doacao);
});

test('mensagens que não são do LivePix (Spotify, chat, lixo) não viram doação', () => {
  assert.equal(dadosDoLivePixNaMensagem(null), null);
  assert.equal(dadosDoLivePixNaMensagem({ event: { source: 'Twitch', type: 'ChatMessage' }, data: {} }), null);
  assert.equal(dadosDoLivePixNaMensagem({ event: { source: 'Custom', type: 'Spotify' }, data: { tocando: true } }), null);
  assert.equal(dadosDoLivePixNaMensagem({ event: { source: 'General', type: 'Custom' }, data: 'não é json' }), null);
  assert.equal(dadosDoLivePixNaMensagem({ event: { source: 'General', type: 'Custom' }, data: JSON.stringify({ event: { source: 'Custom', type: 'Spotify' }, data: {} }) }), null);
});

test('o valor: centavos viram reais com vírgula, casas decimais já são reais e outra moeda leva o código', () => {
  assert.equal(valorDaDoacao(1500, 'BRL'), 'R$ 15,00');
  assert.equal(valorDaDoacao(5), 'R$ 0,05');
  assert.equal(valorDaDoacao(123456), 'R$ 1.234,56');
  assert.equal(valorDaDoacao(7.5, 'BRL'), 'R$ 7,50');
  assert.equal(valorDaDoacao(1000, 'usd'), '10,00 USD');
  assert.equal(valorDaDoacao('abc'), '');
  assert.equal(valorDaDoacao(-1), '');
  assert.equal(valorDaDoacao(null), '');
  assert.equal(valorDaDoacao(''), '');
});

test('o alerta: "Nome apoiou", o valor embaixo, a mensagem e a plataforma livepix', () => {
  const { tipo, alerta } = alertaDoLivePix(doacao);
  assert.equal(tipo, 'alerta');
  assert.equal(alerta.type, 'livepix');
  assert.equal(alerta.event, 'livepix');
  assert.equal(alerta.principal, 'Ana apoiou');
  assert.equal(alerta.chatname, 'Ana');
  assert.equal(alerta.detalhe, 'R$ 15,00');
  assert.equal(alerta.mensagem, 'Valeu pela live!');
});

test('a plataforma livepix tem o nome, o azul e o símbolo do logo do LivePix (três traços numa caixa 24 x 24)', () => {
  const p = plataformaDe('livepix');
  assert.equal(p.nome, 'LivePix');
  assert.equal(p.cor, '#4dc4eb');
  assert.equal((p.icone.match(/M/g) || []).length, 3, 'os três traços do logo: o canto de baixo, o de cima e o quadrado');
  const numeros = (p.icone.match(/-?\d+\.?\d*/g) || []).map(Number);
  assert.ok(numeros.every(n => n >= -0.01 && n <= 24.01), 'todos os pontos cabem na caixa de 24');
});

test('sem nome vira Anônimo, mensagem longa é cortada, a retida pelo LivePix some e avisa e o teste vem marcado', () => {
  assert.equal(alertaDoLivePix({ ...doacao, username: '  ' }).alerta.principal, 'Anônimo apoiou');
  const longa = alertaDoLivePix({ ...doacao, message: 'a'.repeat(500) }).alerta.mensagem;
  assert.ok(longa.length <= 220 && longa.endsWith('…'));
  const retida = alertaDoLivePix({ ...doacao, flagged: true, message: 'palavrão' }).alerta;
  assert.equal(retida.mensagem, '');
  assert.equal(retida.detalhe, 'R$ 15,00 · mensagem retida pelo LivePix');
  assert.equal(alertaDoLivePix({ ...doacao, teste: true }).alerta.detalhe, 'R$ 15,00 · teste');
  assert.equal(alertaDoLivePix(null), null);
});

test('o conversor do dock entrega a doação como alerta, pelo General.Custom que o WebsocketBroadcastJson gera', () => {
  const e = converterEventoStreamerbot({ event: { source: 'General', type: 'Custom' }, data: JSON.stringify(aviso) });
  assert.equal(e.tipo, 'alerta');
  assert.equal(e.alerta.principal, 'Ana apoiou');
  assert.equal(e.alerta.type, 'livepix');
  // o aviso do Spotify (também General.Custom, a cada 5 s) continua sem virar nada no dock
  assert.equal(converterEventoStreamerbot({ event: { source: 'General', type: 'Custom' }, data: JSON.stringify({ event: { source: 'Custom', type: 'Spotify' }, data: { tocando: true } }) }), null);
});

test('o alerta aparece na aba Alertas e na Tudo (padrão), pode sair da Tudo nas configurações e nunca aparece nas abas de plataforma', () => {
  const item = { tipo: 'alerta', evento: 'livepix', plataforma: 'livepix' };
  assert.equal(passaNaAba(item, 'alertas'), true);
  assert.equal(passaNaAba(item, 'tudo'), true);
  assert.equal(passaNaAba(item, 'tudo', { livepix: false }), false);
  assert.equal(passaNaAba(item, ['twitch', 'kick', 'youtube']), false);
  assert.equal(apareceNoChatGeral('livepix'), true);
  assert.ok(TIPOS_DE_ALERTA.some(g => g.itens.some(i => i.id === 'livepix')));
});
