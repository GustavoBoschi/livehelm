// Lista e busca de emojis do seletor do título (Emojis.jsx). Sem React nem DOM. Os dados vêm de emojisDados.js (gerado, com nome e palavras de busca
// em português e em inglês).
import DADOS from './emojisDados.js';

export const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Os grupos do Unicode que o seletor mostra, na ordem das abas.
export const GRUPOS_DE_EMOJI = [
  { id: 0, icone: '😀', nome: 'Rostos e emoções' },
  { id: 1, icone: '👍', nome: 'Pessoas e gestos' },
  { id: 3, icone: '🐶', nome: 'Animais e natureza' },
  { id: 4, icone: '🍕', nome: 'Comida e bebida' },
  { id: 5, icone: '✈️', nome: 'Viagens e lugares' },
  { id: 6, icone: '⚽', nome: 'Atividades' },
  { id: 7, icone: '💡', nome: 'Objetos' },
  { id: 8, icone: '🔣', nome: 'Símbolos' },
  { id: 9, icone: '🏁', nome: 'Bandeiras' },
];

// { emoji, nome, busca, grupo, versao, peles: { tom: emoji } | null }
export const TODOS_OS_EMOJIS = DADOS.map(([emoji, nome, busca, grupo, versao, peles]) => ({ emoji, nome, busca, grupo, versao, peles: peles || null }));
const NOME_POR_EMOJI = new Map(TODOS_OS_EMOJIS.map(e => [e.emoji, e.nome]));
export const nomeDoEmoji = emoji => NOME_POR_EMOJI.get(emoji) || '';

// Os emojis cujo nome ou palavras de busca têm todas as palavras digitadas (sem diferenciar acento nem maiúsculas), os de nome mais parecido com o
// texto primeiro: nome igual, depois nome que começa com ele, depois nome que o contém e, por fim, só as palavras de busca. Sem texto, lista vazia.
export function buscarEmojis(lista, termo) {
  const completo = semAcento(termo).trim();
  const palavras = completo.split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [];
  const pontos = e => {
    const nome = semAcento(e.nome);
    return nome === completo ? 0 : nome.startsWith(completo) ? 1 : nome.includes(completo) ? 2 : 3;
  };
  return lista
    .filter(e => palavras.every(p => e.busca.includes(p)))
    .map((e, i) => ({ e, i, p: pontos(e) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map(x => x.e);
}

// O emoji no tom de pele escolhido (1 a 5; 0 é o padrão). Quem não tem versão com tom fica como é.
export const comTom = (e, tom) => (tom && e.peles && e.peles[tom] ? e.peles[tom] : e.emoji);
