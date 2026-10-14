// Silenciados e banidos da sessão: o que o painel fez e o que as plataformas avisaram viram uma lista só, com o que for
// preciso pra desfazer. Funções puras (o tempo entra como parâmetro, em milissegundos).
import { duracao, horaDe } from './texto.js';

export const JANELA_DUPLICADA_S = 20; // o mesmo caso visto duas vezes (pelo dock e pelo aviso da plataforma) dentro disso vale um só
export const MAX_PUNICOES = 50;

let contador = 0;
const mesmoUsuario = (p, plataforma, nome) => p.plataforma === plataforma && p.nome.toLowerCase() === String(nome).toLowerCase();

// nova = { plataforma, nome, banido, segundos, login, userId }; achaUsuario(plataforma, nome) devolve { login, userId } da
// última mensagem dele no chat (ou null). O caso repetido é completado em vez de duplicado; quem já estava na lista é
// trocado pelo caso novo.
export function registrar(lista, nova, agora, achaUsuario) {
  if (!nova.nome) return lista;
  const repetida = lista.find(p => mesmoUsuario(p, nova.plataforma, nova.nome) && p.banido === nova.banido && (agora - p.quando) / 1000 < JANELA_DUPLICADA_S);
  if (repetida) {
    return lista.map(p => (p !== repetida ? p : {
      ...p, segundos: p.segundos || nova.segundos || 0, login: p.login || nova.login || '', userId: p.userId || nova.userId || '',
    }));
  }
  let { login, userId } = nova;
  if (!login || !userId) {
    const visto = achaUsuario(nova.plataforma, nova.nome);
    if (visto) { login = login || visto.login; userId = userId || visto.userId; }
  }
  const resto = lista.filter(p => !mesmoUsuario(p, nova.plataforma, nova.nome));
  const novo = {
    id: ++contador, plataforma: nova.plataforma, nome: nova.nome, login: login || '', userId: userId || '', banido: !!nova.banido,
    segundos: nova.segundos || 0, quando: agora, pedido: null,
  };
  return [novo, ...resto].slice(0, MAX_PUNICOES);
}

export const expirado = (p, agora) => !p.banido && p.segundos > 0 && agora > p.quando + p.segundos * 1000;
export const podeReverter = (p, agora) => p.plataforma !== 'youtube' && !expirado(p, agora);
export const textoDoBotao = p => (p.pedido ? 'Tentar de novo' : p.banido ? 'Desbanir' : 'Liberar');

export function descricao(p, agora) {
  let texto = p.banido
    ? `Banido às ${horaDe(p.quando)}`
    : `Silenciado${p.segundos > 0 ? ` por ${duracao(p.segundos)}` : ''} às ${horaDe(p.quando)}${expirado(p, agora) ? ' (já acabou)' : ''}`;
  if (p.pedido) texto += ` · desbloqueio pedido às ${horaDe(p.pedido)}`;
  return texto;
}

export function dica(p, agora) {
  if (p.plataforma === 'youtube') return 'O Streamer.bot não tem como desfazer no YouTube: faça pelo YouTube Studio.';
  if (expirado(p, agora)) return 'O silêncio já acabou.';
  return `Pede ao Streamer.bot para remover ${p.banido ? 'o banimento' : 'o silêncio'}.`;
}
