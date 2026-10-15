import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  comAviso, dispensar, adiado, deveMostrar, segundosAte, contagem, mesmoAnuncio, ADIAMENTO_MS, ANTECEDENCIA_PADRAO_S,
} from '../src/anuncios.js';

const AGORA = 1_000_000;
const anuncioEm = (s, extra = {}) => ({ quandoMs: AGORA + s * 1000, duracaoS: 90, adiamentos: 3, ...extra });

test('o aviso aparece só quando faltam ANTECEDENCIA_PADRAO_S segundos ou menos', () => {
  assert.equal(ANTECEDENCIA_PADRAO_S, 30);
  const a = comAviso(null, anuncioEm(120));
  assert.equal(deveMostrar(a, AGORA, 30), false);
  assert.equal(deveMostrar(a, AGORA + 89_000, 30), false);
  assert.equal(deveMostrar(a, AGORA + 90_000, 30), true);
  assert.equal(deveMostrar(a, AGORA + 119_000, 30), true);
});

test('o aviso fica 3 s depois de o anúncio começar e some', () => {
  const a = comAviso(null, anuncioEm(10));
  assert.equal(deveMostrar(a, AGORA + 10_000, 30), true);
  assert.equal(deveMostrar(a, AGORA + 12_000, 30), true);
  assert.equal(deveMostrar(a, AGORA + 13_000, 30), false);
});

test('sem anúncio conhecido ou dispensado, não mostra', () => {
  assert.equal(deveMostrar(null, AGORA, 30), false);
  assert.equal(deveMostrar(dispensar(comAviso(null, anuncioEm(20))), AGORA, 30), false);
});

test('os avisos seguintes do mesmo anúncio (um por minuto) não reabrem um aviso dispensado', () => {
  let a = dispensar(comAviso(null, anuncioEm(40)));
  a = comAviso(a, anuncioEm(41)); // o mesmo anúncio, hora calculada alguns segundos depois
  assert.equal(a.dispensado, true);
  assert.equal(deveMostrar(a, AGORA + 20_000, 30), false);
});

test('um anúncio diferente (por exemplo, depois de adiar) volta a poder avisar', () => {
  let a = dispensar(comAviso(null, anuncioEm(40)));
  a = comAviso(a, anuncioEm(340));
  assert.equal(a.dispensado, false);
  assert.equal(mesmoAnuncio(anuncioEm(40), anuncioEm(340)), false);
});

test('um aviso novo atualiza a hora e os adiamentos restantes do mesmo anúncio', () => {
  const a = comAviso(comAviso(null, anuncioEm(60, { adiamentos: 3 })), anuncioEm(55, { adiamentos: 2 }));
  assert.equal(a.adiamentos, 2);
  assert.equal(a.quandoMs, AGORA + 55_000);
});

test('adiar empurra o anúncio 5 minutos, gasta um adiamento e esconde o aviso até chegar a hora de novo', () => {
  assert.equal(ADIAMENTO_MS, 300_000);
  const a = adiado(comAviso(null, anuncioEm(25)));
  assert.equal(a.quandoMs, AGORA + 325_000);
  assert.equal(a.adiamentos, 2);
  assert.equal(deveMostrar(a, AGORA, 30), false);
  assert.equal(deveMostrar(a, AGORA + 296_000, 30), true);
});

test('adiar sem saber quantos adiamentos restam mantém isso desconhecido e nunca passa de zero', () => {
  assert.equal(adiado(comAviso(null, anuncioEm(25, { adiamentos: null }))).adiamentos, null);
  assert.equal(adiado(comAviso(null, anuncioEm(25, { adiamentos: 0 }))).adiamentos, 0);
});

test('contagem regressiva em m:ss', () => {
  assert.equal(segundosAte(anuncioEm(29.2), AGORA), 30);
  assert.equal(contagem(30), '0:30');
  assert.equal(contagem(5), '0:05');
  assert.equal(contagem(75), '1:15');
  assert.equal(contagem(0), '0:00');
  assert.equal(contagem(-2), '0:00');
});
