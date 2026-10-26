import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idadeDaConta, linkDoPerfil, nivelDeSub } from '../src/perfil.js';

test('o link do perfil: Twitch e Kick pelo login (a Kick troca _ por -), YouTube pelo id do canal; sem o dado, vazio', () => {
  assert.equal(linkDoPerfil({ plataforma: 'twitch', login: 'Maria_X', nome: 'Maria_X' }), 'https://www.twitch.tv/maria_x');
  assert.equal(linkDoPerfil({ plataforma: 'kick', login: 'Maria_X' }), 'https://kick.com/maria-x');
  assert.equal(linkDoPerfil({ plataforma: 'kick', nome: 'Joao' }), 'https://kick.com/joao');
  assert.equal(linkDoPerfil({ plataforma: 'youtube', userId: 'UCabcdefghijklmnopqrstuv' }), 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv');
  assert.equal(linkDoPerfil({ plataforma: 'youtube', userId: 'qualquer coisa' }), '');
  assert.equal(linkDoPerfil({ plataforma: 'twitch' }), '');
  assert.equal(linkDoPerfil({ plataforma: 'tiktok', login: 'x' }), '');
  assert.equal(linkDoPerfil({ plataforma: 'twitch', login: 'a/b?c' }), 'https://www.twitch.tv/a%2Fb%3Fc');
});

test('a idade da conta em português: dias, meses, anos e meses; data ruim ou no futuro, vazio', () => {
  const agora = Date.parse('2026-10-23T12:00:00Z');
  assert.equal(idadeDaConta('2026-10-22T12:00:00Z', agora), '1 dia');
  assert.equal(idadeDaConta('2026-10-03T12:00:00Z', agora), '20 dias');
  assert.equal(idadeDaConta('2026-07-20T12:00:00Z', agora), '3 meses');
  assert.equal(idadeDaConta('2025-10-23T12:00:00Z', agora), '1 ano');
  assert.equal(idadeDaConta('2019-05-17T10:30:00Z', agora), '7 anos e 5 meses');
  assert.equal(idadeDaConta('', agora), '');
  assert.equal(idadeDaConta('2030-01-01T00:00:00Z', agora), '');
});

test('o nível de sub: 1000, 2000 e 3000 viram Tier 1, 2 e 3; Prime fica Prime', () => {
  assert.equal(nivelDeSub('1000'), 'Tier 1');
  assert.equal(nivelDeSub('3000'), 'Tier 3');
  assert.equal(nivelDeSub('Prime'), 'Prime');
  assert.equal(nivelDeSub('tier 2'), 'Tier 2');
  assert.equal(nivelDeSub(''), '');
});
