// Lista de tags (#) da Twitch: regras de limpeza, edição e a leitura da resposta que a ação `Painel: Tags` deixa numa variável
// global do Streamer.bot. Só funções puras, sem rede nem React.
const MAX_TAGS = 10;
const MAX_LETRAS = 25;

const mesmaTag = (a, b) => a.toLowerCase() === b.toLowerCase();

// Transforma "#rpg #dados, Mesa D&D" em tags da Twitch: sem #, sem espaços nem símbolos, até 25 letras ou números, sem
// repetir (ignorando maiúsculas) e no máximo 10.
export function limparTags(texto) {
  const tags = String(texto || '').split(/[#,|\s]+/u).map(t => t.replace(/[^\p{L}\p{N}]/gu, '').slice(0, MAX_LETRAS)).filter(Boolean);
  return tags.filter((t, i) => tags.findIndex(o => mesmaTag(o, t)) === i).slice(0, MAX_TAGS);
}

// A lista com as tags do texto acrescentadas no fim. O que passar de 10 fica de fora.
export function adicionarTags(lista, texto) {
  return limparTags([...lista, ...limparTags(texto)].join(' '));
}

export const removerTag = (lista, tag) => lista.filter(t => !mesmaTag(t, tag));

// Mesmas tags, em qualquer ordem. Falso enquanto a lista do canal (`b`) não foi lida (null).
export function mesmasTags(a, b) {
  if (!Array.isArray(b) || a.length !== b.length) return false;
  return a.every(t => b.some(o => mesmaTag(o, t)));
}

// O valor da variável na resposta do GetGlobal. O Streamer.bot 1.0.7 devolve um mapa { variables: { nome: { value } } } com
// só a variável pedida; `value` solto e `variable` são formatos aceitos por tolerância.
function valorDaVariavel(r) {
  if (r.variables && typeof r.variables === 'object') {
    const primeira = Object.values(r.variables)[0];
    return primeira && typeof primeira === 'object' ? primeira.value : undefined;
  }
  if (r.value !== undefined) return r.value;
  if (r.variable && typeof r.variable === 'object') return r.variable.value;
  return undefined;
}

// Interpreta a resposta do GetGlobal da variável que a ação `Painel: Tags` escreve ({ pedido, ok, tags, erro } em JSON).
// null enquanto a leitura ainda não chegou: variável inexistente, valor ilegível ou de um pedido anterior.
export function respostaDaLeitura(resposta, pedido) {
  if (!resposta || resposta.status !== 'ok') return null;
  let valor = valorDaVariavel(resposta);
  if (typeof valor === 'string') {
    try { valor = JSON.parse(valor); } catch (_) { return null; }
  }
  if (!valor || typeof valor !== 'object' || valor.pedido !== pedido) return null;
  return { ok: valor.ok === true, tags: Array.isArray(valor.tags) ? valor.tags.map(String) : [], erro: String(valor.erro || '') };
}

const espera = ms => new Promise(resolve => setTimeout(resolve, ms));

// A ação roda depois que o DoAction responde, então a resposta do pedido pode demorar: pergunta de novo a cada `intervaloMs`
// (`buscar` devolve a resposta do GetGlobal) até ela chegar ou passar `limiteMs`. null se não chegou.
export async function aguardarLeitura(buscar, pedido, { limiteMs = 6000, intervaloMs = 400 } = {}) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    let resposta = null;
    try { resposta = respostaDaLeitura(await buscar(), pedido); } catch (_) { /* tenta de novo até o limite */ }
    if (resposta) return resposta;
    await espera(intervaloMs);
  }
  return null;
}
