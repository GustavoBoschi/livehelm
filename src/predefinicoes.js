// Predefinições de live: um "modo" com título, categoria, tags da Twitch e (se quiser) a categoria do YouTube, para trocar de uma live para outra com um
// clique. Só funções puras, sem rede nem React: o Predefinicoes.jsx guarda a lista e aplica.
import { limparTags } from './tagsLista.js';

export const MAX_PREDEFINICOES = 20;
// Os painéis Live e Tags leem estes eventos da janela para mostrar o que uma predefinição aplicou (os dois guardam o que mostram no armazenamento).
export const EVENTO_DOS_CAMPOS = 'livehelm:campos'; // detail: { titulo, categoria }
export const EVENTO_DAS_TAGS = 'livehelm:tags';     // detail: { tags }
const MAX_NOME = 40;
const MAX_TITULO = 140;

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Uma predefinição pronta para guardar: { id, nome, titulo, categoria, tags, categoriaYoutube }, sem espaços sobrando, com as tags limpas (regras
// da Twitch) e os textos nos limites. null se faltar o nome ou se não houver nada para guardar (sem título, categoria nem tags).
export function criarPredefinicao({ nome, titulo, categoria, tags, categoriaYoutube }) {
  const n = String(nome || '').trim().slice(0, MAX_NOME);
  const t = String(titulo || '').trim().slice(0, MAX_TITULO);
  const c = String(categoria || '').trim();
  const lista = limparTags(Array.isArray(tags) ? tags.join(' ') : tags);
  if (!n || (!t && !c && lista.length === 0)) return null;
  return { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nome: n, titulo: t, categoria: c, tags: lista, categoriaYoutube: String(categoriaYoutube || '').trim() };
}

// Guarda a predefinição na lista: uma de mesmo nome (sem diferenciar maiúsculas e acentos) é substituída no mesmo lugar, mantendo o id; senão vai para o
// fim. Devolve { lista, erro, substituiu }: cheia (MAX_PREDEFINICOES) e nova = erro.
export function salvarPredefinicao(lista, nova) {
  const i = lista.findIndex(p => semAcento(p.nome) === semAcento(nova.nome));
  if (i >= 0) return { lista: lista.map((p, j) => (j === i ? { ...nova, id: p.id } : p)), erro: '', substituiu: true };
  if (lista.length >= MAX_PREDEFINICOES) return { lista, erro: `no máximo ${MAX_PREDEFINICOES} predefinições: apague uma para guardar outra`, substituiu: false };
  return { lista: [...lista, nova], erro: '', substituiu: false };
}

export const removerPredefinicao = (lista, id) => lista.filter(p => p.id !== id);

// Lê a lista guardada com tolerância (qualquer coisa fora do formato some): cada item passa por criarPredefinicao, mantendo o id que já tinha.
export function lerPredefinicoes(bruto) {
  if (!Array.isArray(bruto)) return [];
  return bruto.map(p => {
    const nova = p && typeof p === 'object' ? criarPredefinicao(p) : null;
    return nova ? { ...nova, id: typeof p.id === 'string' && p.id ? p.id : nova.id } : null;
  }).filter(Boolean).slice(0, MAX_PREDEFINICOES);
}

// O que a predefinição faz, numa linha: "Marvel Rivals · 3 tags · YouTube: Gaming".
export function resumoDaPredefinicao(p) {
  return [
    p.titulo,
    p.categoria,
    p.tags.length ? `${p.tags.length} ${p.tags.length === 1 ? 'tag' : 'tags'}` : '',
    p.categoriaYoutube ? `YouTube: ${p.categoriaYoutube}` : '',
  ].filter(Boolean).join(' · ');
}
