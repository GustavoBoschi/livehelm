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

// O valor (já em objeto) que uma ação do Painel escreveu na variável global, se a resposta é do `pedido`; senão null.
export function valorDaResposta(resposta, pedido) {
  if (!resposta || resposta.status !== 'ok') return null;
  let valor = valorDaVariavel(resposta);
  if (typeof valor === 'string') {
    try { valor = JSON.parse(valor); } catch (_) { return null; }
  }
  return valor && typeof valor === 'object' && valor.pedido === pedido ? valor : null;
}

// A resposta da ação `Painel: YouTube` ({ pedido, ok, erro, titulo, categoria, avisos }): null enquanto não chegou.
export function respostaDoYoutube(resposta, pedido) {
  const valor = valorDaResposta(resposta, pedido);
  if (!valor) return null;
  return { ok: valor.ok === true, erro: String(valor.erro || ''), titulo: String(valor.titulo || ''), categoria: String(valor.categoria || ''), avisos: String(valor.avisos || ''), semTransmissao: valor.semTransmissao === true };
}

// Interpreta a resposta do GetGlobal da variável que a ação `Painel: Tags` escreve ({ pedido, ok, tags, erro, titulo, categoria, afiliado,
// parceiro, youtube: { titulo, categoria } } em JSON; os campos além de tags e erro só existem com o código novo da ação: sem eles, vazio e
// afiliado null = desconhecido). null enquanto a leitura ainda não chegou: variável inexistente, valor ilegível ou de um pedido anterior.
export function respostaDaLeitura(resposta, pedido) {
  if (!resposta || resposta.status !== 'ok') return null;
  let valor = valorDaVariavel(resposta);
  if (typeof valor === 'string') {
    try { valor = JSON.parse(valor); } catch (_) { return null; }
  }
  if (!valor || typeof valor !== 'object' || valor.pedido !== pedido) return null;
  const yt = valor.youtube && typeof valor.youtube === 'object' ? valor.youtube : {};
  return {
    ok: valor.ok === true,
    tags: Array.isArray(valor.tags) ? valor.tags.map(String) : [],
    erro: String(valor.erro || ''),
    titulo: String(valor.titulo || ''),
    categoria: String(valor.categoria || ''),
    afiliado: typeof valor.afiliado === 'boolean' ? valor.afiliado : null,
    parceiro: typeof valor.parceiro === 'boolean' ? valor.parceiro : null,
    youtube: { titulo: String(yt.titulo || ''), categoria: String(yt.categoria || '') },
  };
}

const espera = ms => new Promise(resolve => setTimeout(resolve, ms));

// A ação roda depois que o DoAction responde, então a resposta do pedido pode demorar: pergunta de novo a cada `intervaloMs`
// (`buscar` devolve a resposta do GetGlobal) até ela chegar ou passar `limiteMs`. null se não chegou.
export async function aguardarLeitura(buscar, pedido, { limiteMs = 6000, intervaloMs = 400, interpretar = respostaDaLeitura } = {}) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    let resposta = null;
    try { resposta = interpretar(await buscar(), pedido); } catch (_) { /* tenta de novo até o limite */ }
    if (resposta) return resposta;
    await espera(intervaloMs);
  }
  return null;
}
