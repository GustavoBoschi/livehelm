import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarModoDoChat } from '../src/comandosDeModo.js';

test('não é um comando de modo: comandos de moderação e texto comum passam adiante', () => {
  assert.equal(interpretarModoDoChat('/ban fulano'), null);
  assert.equal(interpretarModoDoChat('/limpar'), null);
  assert.equal(interpretarModoDoChat('/'), null);
  assert.equal(interpretarModoDoChat('oi'), null);
});

test('sem argumento o comando alterna pelo que foi enviado por último; on e off valem sempre', () => {
  assert.deepEqual(interpretarModoDoChat('/emotes', {}), { modo: 'emotes', ligar: true, segundos: 30, minutos: 0, rotulo: 'Só emotes' });
  assert.equal(interpretarModoDoChat('/emotes', { emotes: true }).ligar, false);
  assert.equal(interpretarModoDoChat('/subs', { inscritos: true }).ligar, false);
  assert.equal(interpretarModoDoChat('/subs on', { inscritos: true }).ligar, true);
  assert.equal(interpretarModoDoChat('/SUBS Off', {}).ligar, false);
  assert.equal(interpretarModoDoChat('/escudo', {}).modo, 'escudo');
  assert.equal(interpretarModoDoChat('/shield off').ligar, false);
});

test('os apelidos em inglês e português dão o mesmo modo', () => {
  for (const [c, modo] of [['/emoteonly', 'emotes'], ['/sub', 'inscritos'], ['/inscritos', 'inscritos'], ['/slow', 'lento'], ['/followers', 'seguidores'], ['/seguidores', 'seguidores']]) {
    assert.equal(interpretarModoDoChat(c).modo, modo, c);
  }
});

test('/lento usa o tempo dado (3 a 120), o das configurações sem número, e 0 ou off desliga', () => {
  assert.deepEqual(interpretarModoDoChat('/lento 10'), { modo: 'lento', ligar: true, segundos: 10, minutos: 0, rotulo: 'Modo lento' });
  assert.equal(interpretarModoDoChat('/lento', {}, { lentoSegundos: 45 }).segundos, 45);
  assert.equal(interpretarModoDoChat('/lento 0', { lento: false }).ligar, false);
  assert.equal(interpretarModoDoChat('/lento off').ligar, false);
  assert.match(interpretarModoDoChat('/lento 2').erro, /3 a 120/);
  assert.match(interpretarModoDoChat('/lento 500').erro, /3 a 120/);
});

test('/seguidores usa os minutos dados (0 = todos os seguidores), os das configurações sem número', () => {
  assert.equal(interpretarModoDoChat('/seguidores 30').minutos, 30);
  assert.equal(interpretarModoDoChat('/seguidores 0').ligar, true);
  assert.equal(interpretarModoDoChat('/seguidores', {}, { seguidoresMinutos: 10 }).minutos, 10);
  assert.match(interpretarModoDoChat('/seguidores 999999').erro, /129600/);
});

test('argumento que não faz sentido dá um erro que explica o uso', () => {
  assert.match(interpretarModoDoChat('/emotes talvez').erro, /on/);
  assert.match(interpretarModoDoChat('/lento muito').erro, /\/lento 30/);
});
