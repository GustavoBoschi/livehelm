import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acoesNecessarias, montarVerificacao } from '../src/verificacao.js';

const config = (parte = {}) => ({
  anuncio: { ligado: false }, modosDoChat: { ligado: false }, clipe: { ligado: false }, chat: { resgates: false, responder: false, automod: false },
  youtubeInfo: { ligado: false }, mic: { ligado: false, entrada: '' }, ...parte,
});
const TODAS = ['Painel: Twitch', 'Painel: Kick', 'Painel: YouTube', 'Painel: Chat', 'Painel: Tags', 'Painel: Momentos'];
const base = (parte = {}) => ({
  streamerbot: { conectado: true, recusa: null }, nomes: TODAS, ativas: { twitch: true, kick: true, youtube: true }, conectadas: ['twitch', 'kick', 'youtube'],
  config: config(), controles: null, youtube: null, obs: { ok: true, versao: '32.0.1', micOk: false }, ...parte,
});
const niveis = linhas => linhas.map(l => `${l.id}:${l.nivel}`);

test('tudo no lugar: só ✓, com a linha final de "tudo certo"', () => {
  const l = montarVerificacao(base());
  assert.ok(l.every(x => x.nivel === 0));
  assert.equal(l[l.length - 1].id, 'tudo');
});

test('as ações que cada coisa ligada precisa: plataformas ativas, chat, tags, momentos e, se ligadas, anúncio e Controles', () => {
  const nomes = a => acoesNecessarias({ config: config(a.config), ativas: a.ativas || { twitch: true, kick: false, youtube: false } }).lista.map(([n]) => n);
  assert.deepEqual(nomes({}), ['Painel: Twitch', 'Painel: Chat', 'Painel: Tags', 'Painel: Momentos']);
  assert.ok(nomes({ config: { anuncio: { ligado: true } } }).includes('Painel: Anuncio'));
  assert.ok(nomes({ config: { clipe: { ligado: true } } }).includes('Painel: Controles'));
  assert.ok(nomes({ config: { chat: { resgates: true } } }).includes('Painel: Controles'));
  assert.ok(!nomes({ config: { chat: { automod: true } } }).includes('Painel: Controles'));
});

test('ação que falta: ✕ (ou ! para tags e momentos), com o nome exato e o que fazer', () => {
  const l = montarVerificacao(base({ nomes: ['Painel: Twitch', 'Painel: Kick', 'Painel: Youtube', 'Painel: Chat'] }));
  const por = id => l.find(x => x.id === id);
  assert.equal(por('acao-Painel: YouTube').nivel, 2);
  assert.match(por('acao-Painel: YouTube').texto, /Falta a ação “Painel: YouTube”/);
  assert.equal(por('acao-Painel: Tags').nivel, 1);
  assert.equal(por('acao-Painel: Momentos').nivel, 1);
  assert.match(por('acao-Painel: YouTube').ajuda, /exato/);
});

test('o código de Painel: Controles e de Painel: YouTube precisa estar na versão 2 quando o recurso está ligado', () => {
  const comControles = { config: config({ clipe: { ligado: true } }), nomes: [...TODAS, 'Painel: Controles'] };
  assert.equal(montarVerificacao(base({ ...comControles, controles: { achou: true, versao: 1 } })).find(x => x.id === 'controles').nivel, 2);
  assert.equal(montarVerificacao(base({ ...comControles, controles: { achou: true, versao: 2 } })).find(x => x.id === 'controles').nivel, 0);
  assert.equal(montarVerificacao(base({ ...comControles, controles: { achou: false, versao: 0 } })).find(x => x.id === 'controles').nivel, 1);
  const comYoutube = { config: config({ youtubeInfo: { ligado: true } }) };
  assert.equal(montarVerificacao(base({ ...comYoutube, youtube: { achou: true, versao: 1 } })).find(x => x.id === 'youtube').nivel, 2);
  assert.equal(montarVerificacao(base({ ...comYoutube, youtube: { achou: true, versao: 2 } })).find(x => x.id === 'youtube').nivel, 1);
  assert.equal(montarVerificacao(base({ ...comYoutube, youtube: { achou: true, versao: 3 } })).find(x => x.id === 'youtube').nivel, 1, 'a versão 3 ainda funciona, mas a 4 é a atual');
  assert.equal(montarVerificacao(base({ ...comYoutube, youtube: { achou: true, versao: 4 } })).find(x => x.id === 'youtube').nivel, 0);
  // sem tags e descrição ligadas, o código antigo só pede atualização (aviso), e a versão 4 está certa
  assert.equal(montarVerificacao(base({ youtube: { achou: true, versao: 1 } })).find(x => x.id === 'youtube').nivel, 1);
  assert.equal(montarVerificacao(base({ youtube: { achou: true, versao: 4 } })).find(x => x.id === 'youtube').nivel, 0);
});

test('Streamer.bot desconectado ou que recusou a conexão: ✕ e nada de checar ações; plataforma ligada sem conexão: !', () => {
  const sem = montarVerificacao(base({ streamerbot: { conectado: false, recusa: null } }));
  assert.deepEqual(niveis(sem).filter(x => !x.startsWith('obs')), ['streamerbot:2']);
  assert.match(montarVerificacao(base({ streamerbot: { conectado: true, recusa: 'senha errada' } }))[0].texto, /recusou a conexão \(senha errada\)/);
  const kick = montarVerificacao(base({ conectadas: ['twitch', 'youtube'] }));
  assert.equal(kick.find(x => x.id === 'plataforma-kick').nivel, 1);
});

test('OBS: ✓ com a versão, ✕ com a ajuda quando não responde; microfone achado, não achado ou sem entrada escolhida', () => {
  assert.match(montarVerificacao(base()).find(x => x.id === 'obs').texto, /versão 32\.0\.1/);
  const ruim = montarVerificacao(base({ obs: { ok: false, erro: 'o OBS não respondeu' } })).find(x => x.id === 'obs');
  assert.equal(ruim.nivel, 2);
  assert.match(ruim.ajuda, /servidor WebSocket/);
  const mic = (entrada, micOk) => montarVerificacao(base({ config: config({ mic: { ligado: true, entrada } }), obs: { ok: true, versao: '32', micOk } })).find(x => x.id === 'mic');
  assert.equal(mic('Mic/Aux', true).nivel, 0);
  assert.equal(mic('Mic/Aux', false).nivel, 2);
  assert.equal(mic('', false).nivel, 1);
});
