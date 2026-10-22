import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tituloDoYoutube, variantesDeCategoria } from '../src/titulos.js';

test('título do YouTube: "->" vira seta e < e > saem, e o texto avisa o que mudou', () => {
  const r = tituloDoYoutube('Marvel Rivals -> subindo de rank');
  assert.equal(r.texto, 'Marvel Rivals → subindo de rank');
  assert.equal(r.ajustes.length, 1);
  const s = tituloDoYoutube('Live <ao vivo> hoje');
  assert.equal(s.texto, 'Live ao vivo hoje');
  assert.match(s.ajustes[0], /< e >/);
});

test('título do YouTube sem símbolos proibidos não muda', () => {
  const r = tituloDoYoutube("Baldur's Gate 3 | mesa de RPG 🔥");
  assert.equal(r.texto, "Baldur's Gate 3 | mesa de RPG 🔥");
  assert.deepEqual(r.ajustes, []);
});

test('título do YouTube passa de 100 caracteres: corta e avisa (emoji conta como um)', () => {
  const r = tituloDoYoutube('a'.repeat(98) + '🔥🔥🔥🔥');
  assert.equal([...r.texto].length, 100);
  assert.match(r.ajustes[0], /100/);
});

test('variantes da categoria: o apóstrofo que falta, a grafia curva e o nome sem apóstrofo', () => {
  assert.deepEqual(variantesDeCategoria('Baldurs Gate 3'), ["Baldur's Gate 3"]);
  assert.deepEqual(variantesDeCategoria("Baldur's Gate 3"), ['Baldur’s Gate 3', 'Baldurs Gate 3']);
  assert.deepEqual(variantesDeCategoria('Minecraft'), []);
  assert.ok(variantesDeCategoria('Marvel Rivals').includes("Marvel Rival's"));
  assert.ok(variantesDeCategoria('Dungeons Dragons Heroes', 1).length <= 1);
});

import { categoriaDoYoutube, normalizarRegrasDoYoutube, REGRAS_PADRAO_DO_YOUTUBE, CATEGORIAS_DO_YOUTUBE } from '../src/titulos.js';

const cat = (categoria, titulo = '', regras = REGRAS_PADRAO_DO_YOUTUBE) => categoriaDoYoutube({ categoria, titulo, regras });

test('qualquer nome de jogo vai para Gaming, e as categorias que não são jogo vão para a regra delas (em português ou inglês)', () => {
  assert.deepEqual(cat('Marvel Rivals'), { categoria: 'Gaming', regra: false });
  assert.deepEqual(cat("Baldur's Gate 3"), { categoria: 'Gaming', regra: false });
  assert.deepEqual(cat('Minecraft'), { categoria: 'Gaming', regra: false });
  assert.deepEqual(cat('Just Chatting'), { categoria: 'People & Blogs', regra: true });
  assert.deepEqual(cat('Conversando'), { categoria: 'People & Blogs', regra: true });
  assert.deepEqual(cat('Software and Game Development'), { categoria: 'Science & Technology', regra: true });
  assert.deepEqual(cat('Science & Technology'), { categoria: 'Science & Technology', regra: true });
  assert.deepEqual(cat('Tecnologia'), { categoria: 'Science & Technology', regra: true });
  assert.deepEqual(cat('Ciencia'), { categoria: 'Science & Technology', regra: true });
  assert.deepEqual(cat('Música'), { categoria: 'Music', regra: true });
  assert.deepEqual(cat('Music'), { categoria: 'Music', regra: true });
  assert.deepEqual(cat('Esportes'), { categoria: 'Sports', regra: true });
  assert.deepEqual(cat('Sports'), { categoria: 'Sports', regra: true });
});

test('as palavras casam sem diferenciar maiúscula, acento nem plural, e só como palavra inteira', () => {
  const regras = [{ palavras: 'Softwares, Arte', categoria: 'Science & Technology' }, { palavras: '', categoria: 'Gaming', jogos: true }];
  assert.equal(cat('SOFTWARE', '', regras).categoria, 'Science & Technology');
  assert.equal(cat('arte digital', '', regras).categoria, 'Science & Technology');
  assert.equal(cat('Artifact', '', regras).categoria, 'Gaming');
  assert.equal(cat('smart house', '', [{ palavras: 'art', categoria: 'Entertainment' }, { palavras: '', categoria: 'Gaming', jogos: true }]).categoria, 'Gaming');
});

test('os nomes de jogos da linha de jogos ganham das outras regras: um jogo com "Music" no nome continua Gaming', () => {
  const regras = [{ palavras: 'Music', categoria: 'Music' }, { palavras: 'Music Rush, Marvel Rivals, Baldurs Gate', categoria: 'Gaming', jogos: true }];
  assert.deepEqual(cat('Music Rush', '', regras), { categoria: 'Gaming', regra: false });
  assert.deepEqual(cat("Baldur's Gate 3", '', regras), { categoria: 'Gaming', regra: false });
  assert.deepEqual(cat('Music', '', regras), { categoria: 'Music', regra: true });
});

test('sem categoria digitada, as palavras do título decidem; sem nada que case, é Gaming', () => {
  assert.deepEqual(cat('', 'Papo Just Chatting de domingo'), { categoria: 'People & Blogs', regra: true });
  assert.deepEqual(cat('', 'Subindo de rank'), { categoria: 'Gaming', regra: false });
  assert.deepEqual(cat('', ''), { categoria: 'Gaming', regra: false });
  // com categoria digitada o título não decide
  assert.deepEqual(cat('Marvel Rivals', 'music e rank'), { categoria: 'Gaming', regra: false });
});

test('a categoria dos jogos pode ser outra (a linha de jogos manda), e uma regra sem categoria ou sem palavras não faz nada', () => {
  const regras = [{ palavras: 'Just Chatting', categoria: 'Education' }, { palavras: '', categoria: 'Entertainment', jogos: true }, { palavras: '', categoria: 'Music' }, { palavras: 'Poesia', categoria: '' }];
  assert.deepEqual(cat('Minecraft', '', regras), { categoria: 'Entertainment', regra: false });
  assert.deepEqual(cat('Just Chatting', '', regras), { categoria: 'Education', regra: true });
  assert.deepEqual(cat('Poesia', '', regras), { categoria: 'Entertainment', regra: false });
});

test('normalizarRegrasDoYoutube: sempre existe uma linha de jogos, só uma; o texto das versões antigas vira a lista; sem nada vale o padrão de fábrica', () => {
  const antigo = normalizarRegrasDoYoutube('just chatting = People & Blogs\n# nada\nmusic = Music\nlinha sem igual', 'Entertainment');
  assert.deepEqual(antigo, [
    { palavras: 'just chatting', categoria: 'People & Blogs' },
    { palavras: '', categoria: 'Entertainment', jogos: true },
    { palavras: 'music', categoria: 'Music' },
  ]);
  const duas = normalizarRegrasDoYoutube([{ palavras: 'a', categoria: 'Gaming', jogos: true }, { palavras: 'b', categoria: 'Music', jogos: true }]);
  assert.equal(duas.filter(r => r.jogos).length, 1);
  assert.equal(normalizarRegrasDoYoutube([]).filter(r => r.jogos)[0].categoria, 'Gaming');
  assert.deepEqual(normalizarRegrasDoYoutube(undefined), REGRAS_PADRAO_DO_YOUTUBE);
  assert.deepEqual(normalizarRegrasDoYoutube(null).map(r => r.categoria), ['People & Blogs', 'Gaming', 'Science & Technology', 'Music', 'Sports']);
});

test('as regras de fábrica usam só categorias da lista do YouTube', () => {
  const nomes = new Set(CATEGORIAS_DO_YOUTUBE.map(c => c.nome));
  for (const r of REGRAS_PADRAO_DO_YOUTUBE) assert.ok(nomes.has(r.categoria), r.categoria);
  assert.equal(REGRAS_PADRAO_DO_YOUTUBE.filter(r => r.jogos).length, 1);
});

import { descricaoDoYoutube, tagsDoYoutube } from '../src/titulos.js';

test('descrição do YouTube: setas viram setas, < e > saem, as quebras de linha ficam e passa de 5000 letras é cortada', () => {
  const r = descricaoDoYoutube('Hoje no rank -> subindo <b>forte</b>\r\n\r\nSegunda linha   \n');
  assert.equal(r.texto, 'Hoje no rank → subindo bforte/b\n\nSegunda linha');
  assert.equal(r.ajustes.length, 2);
  assert.deepEqual(descricaoDoYoutube('texto limpo'), { texto: 'texto limpo', ajustes: [] });
  const longa = descricaoDoYoutube('a'.repeat(6000));
  assert.equal([...longa.texto].length, 5000);
  assert.match(longa.ajustes[0], /5000/);
  assert.deepEqual(descricaoDoYoutube(null), { texto: '', ajustes: [] });
});

test('tags do YouTube: frases soltas, separadas por vírgula, sem repetir (ignorando maiúsculas), sem < > e dentro das 500 letras', () => {
  assert.deepEqual(tagsDoYoutube('marvel rivals, Rank,  rank , <jogo> bom, ,').tags, ['marvel rivals', 'Rank', 'jogo bom']);
  assert.deepEqual(tagsDoYoutube(['rpg', 'marvel  rivals, dados', 'RPG']).tags, ['rpg', 'marvel rivals', 'dados']);
  assert.deepEqual(tagsDoYoutube('').tags, []);
  const muitas = tagsDoYoutube(Array.from({ length: 60 }, (_, i) => `tag numero ${i} bem comprida`));
  assert.ok(muitas.tags.length > 5 && muitas.tags.length < 60);
  assert.ok(muitas.tags.reduce((s, t) => s + t.length + 3, 0) <= 500);
  assert.match(muitas.ajustes[0], /ficaram de fora/);
});
