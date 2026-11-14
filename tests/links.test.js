import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REDES_DOS_LINKS, linksDoDock, normalizarLink } from '../src/links.js';
import { PLATAFORMAS } from '../src/plataformas.js';

test('o ajuste do endereço: põe https quando falta, mantém a porta e o caminho, recusa o que não é http(s)', () => {
  assert.equal(normalizarLink('twitch.tv/seucanal'), 'https://twitch.tv/seucanal');
  assert.equal(normalizarLink('  https://kick.com/x  '), 'https://kick.com/x');
  assert.equal(normalizarLink('HTTP://Site.com/Z'), 'http://site.com/Z');
  assert.equal(normalizarLink('//a.com'), 'https://a.com/');
  assert.equal(normalizarLink('site.com:8080/x'), 'https://site.com:8080/x');
  for (const ruim of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'file:///c:/x', 'mailto:a@b.com', 'ftp://a.com', 'vbscript:x', 'https://javascript:alert(1)']) {
    assert.equal(normalizarLink(ruim), '', ruim);
  }
});

test('o ajuste do endereço: recusa o que não é um site (sem ponto, com espaço, com senha) e o vazio', () => {
  for (const ruim of ['', '   ', null, undefined, 'seucanal', 'localhost:3000', 'a b.com', 'https://u:p@a.com', 'http://']) {
    assert.equal(normalizarLink(ruim), '', String(ruim));
  }
});

test('os links do modal saem na ordem da lista das redes e só com endereço que serve', () => {
  const links = linksDoDock({ site: 'seusite.com.br', discord: 'discord.gg/convite', twitch: 'twitch.tv/a', kick: 'javascript:x', youtube: '' });
  assert.deepEqual(links.map(l => l.id), ['twitch', 'discord', 'site']);
  assert.equal(links[0].url, 'https://twitch.tv/a');
  assert.deepEqual(linksDoDock(undefined), []);
  assert.deepEqual(linksDoDock('texto'), []);
});

test('a lista das redes: ids únicos, ícone de cada uma (menos o globo do site) e o das plataformas do dock é o de plataformas.js', () => {
  assert.equal(new Set(REDES_DOS_LINKS.map(r => r.id)).size, REDES_DOS_LINKS.length);
  for (const r of REDES_DOS_LINKS) {
    if (r.id === 'site') assert.equal(r.icone, '');
    else assert.match(r.icone, /^M[\d.\s-]/, r.id);
  }
  for (const id of ['twitch', 'youtube', 'kick', 'livepix']) assert.equal(REDES_DOS_LINKS.find(r => r.id === id).icone, PLATAFORMAS[id].icone);
});
