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
