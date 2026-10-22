// Regras de título e categoria de cada plataforma, sem rede nem React.

const LIMITE_DO_YOUTUBE = 100;

// O YouTube recusa < e > no título e corta em 100 caracteres: setas viram setas de verdade, o resto sai. Devolve { texto, ajustes }: a
// lista do que foi mudado, em português, pra o dock avisar.
export function tituloDoYoutube(titulo) {
  const ajustes = [];
  let texto = String(titulo || '');
  const trocado = texto.replace(/->/g, '→').replace(/<-/g, '←').replace(/=>/g, '⇒');
  if (trocado !== texto) { ajustes.push('as setas "->" viraram "→" (o YouTube não aceita < nem >)'); texto = trocado; }
  const limpo = texto.replace(/[<>]/g, '');
  if (limpo !== texto) { ajustes.push('tirei os símbolos < e > (o YouTube não os aceita)'); texto = limpo; }
  texto = texto.replace(/\s{2,}/g, ' ').trim();
  const letras = [...texto];
  if (letras.length > LIMITE_DO_YOUTUBE) {
    texto = letras.slice(0, LIMITE_DO_YOUTUBE).join('').trim();
    ajustes.push(`cortei em ${LIMITE_DO_YOUTUBE} caracteres (limite do YouTube)`);
  }
  return { texto, ajustes };
}

// Outras grafias da mesma categoria, pra quando a plataforma não acha o nome digitado: o apóstrofo que falta ("Baldurs Gate 3" ->
// "Baldur's Gate 3"), o apóstrofo curvo no lugar do reto e o nome sem apóstrofo. No máximo `max`, sem repetir o nome original.
export function variantesDeCategoria(nome, max = 2) {
  const original = String(nome || '').trim();
  const achadas = [];
  const juntar = v => { if (v && v !== original && !achadas.includes(v)) achadas.push(v); };
  if (/['’]/.test(original)) {
    juntar(original.replace(/'/g, '’'));
    juntar(original.replace(/’/g, "'"));
    juntar(original.replace(/['’]/g, ''));
  } else {
    const palavras = original.split(/\s+/);
    palavras.forEach((p, i) => {
      if (p.length >= 4 && /s$/i.test(p) && /^\p{L}+$/u.test(p)) juntar(palavras.map((q, j) => (j === i ? `${p.slice(0, -1)}'${p.slice(-1)}` : q)).join(' '));
    });
  }
  return achadas.slice(0, max);
}

// ---- Descrição e tags do YouTube ----
const LIMITE_DA_DESCRICAO = 5000;
const LIMITE_DAS_TAGS = 500; // soma das letras das tags (a com espaço conta mais duas, das aspas, e cada uma mais uma, da vírgula)

// A descrição segue as regras do título: setas viram setas de verdade e < e > saem; até 5000 letras. As quebras de linha ficam. Devolve { texto, ajustes }.
export function descricaoDoYoutube(descricao) {
  const ajustes = [];
  let texto = String(descricao || '').replace(/\r\n?/g, '\n');
  const trocado = texto.replace(/->/g, '→').replace(/<-/g, '←').replace(/=>/g, '⇒');
  if (trocado !== texto) { ajustes.push('as setas "->" viraram "→" (o YouTube não aceita < nem >)'); texto = trocado; }
  const limpo = texto.replace(/[<>]/g, '');
  if (limpo !== texto) { ajustes.push('tirei os símbolos < e > (o YouTube não os aceita)'); texto = limpo; }
  texto = texto.replace(/[ \t]+$/gm, '').trim();
  const letras = [...texto];
  if (letras.length > LIMITE_DA_DESCRICAO) {
    texto = letras.slice(0, LIMITE_DA_DESCRICAO).join('').trim();
    ajustes.push(`cortei em ${LIMITE_DA_DESCRICAO} caracteres (limite do YouTube)`);
  }
  return { texto, ajustes };
}

// Tags do YouTube: palavras ou frases soltas (não só uma palavra como na Twitch). Aceita um texto ("uma, outra frase") ou uma lista; sem < > nem vírgula dentro
// da tag, sem espaço duplo, sem repetir (ignorando maiúsculas) e só até onde cabem as 500 letras do YouTube. Devolve { tags, ajustes }.
export function tagsDoYoutube(entrada) {
  const ajustes = [];
  const bruto = Array.isArray(entrada) ? entrada.flatMap(t => String(t).split(/[,|\n]/)) : String(entrada || '').split(/[,|\n]/);
  const unicas = [];
  for (const b of bruto) {
    const tag = b.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    if (tag && !unicas.some(o => o.toLowerCase() === tag.toLowerCase())) unicas.push(tag);
  }
  const tags = [];
  let soma = 0;
  for (const tag of unicas) {
    const custo = [...tag].length + 1 + (tag.includes(' ') ? 2 : 0);
    if (soma + custo > LIMITE_DAS_TAGS) break;
    soma += custo;
    tags.push(tag);
  }
  if (tags.length < unicas.length) ajustes.push(`${unicas.length - tags.length} tag(s) ficaram de fora (o YouTube aceita até ${LIMITE_DAS_TAGS} letras no total)`);
  return { tags, ajustes };
}

// ---- Categoria do YouTube segundo o que a live é ----
// O YouTube só tem categorias fixas (Gaming, People & Blogs, Music...): o jogo (o "Título do jogo" do YouTube Studio) não existe na API nem no Streamer.bot,
// então o que o dock pode fazer é escolher a categoria certa. As regras ficam nas configurações, uma linha por categoria do YouTube, cada uma com as palavras
// que a identificam: { palavras: 'Just Chatting, Conversando', categoria: 'People & Blogs' }. A linha `jogos` é a de qualquer jogo: a categoria dela vale para
// tudo que não casar com outra regra, e as palavras dela (nomes de jogos, como "Marvel Rivals, Minecraft") ganham das outras regras.

// As categorias que uma transmissão do YouTube aceita, com o nome que a API usa (é o que vai ao Streamer.bot) e o que aparece na tela.
export const CATEGORIAS_DO_YOUTUBE = [
  { nome: 'Gaming', rotulo: 'Gaming (Jogos)' },
  { nome: 'People & Blogs', rotulo: 'People & Blogs (Pessoas e blogs)' },
  { nome: 'Science & Technology', rotulo: 'Science & Technology (Ciência e tecnologia)' },
  { nome: 'Music', rotulo: 'Music (Música)' },
  { nome: 'Sports', rotulo: 'Sports (Esportes)' },
  { nome: 'Entertainment', rotulo: 'Entertainment (Entretenimento)' },
  { nome: 'Education', rotulo: 'Education (Educação)' },
  { nome: 'Howto & Style', rotulo: 'Howto & Style (Guias e estilo)' },
  { nome: 'Comedy', rotulo: 'Comedy (Comédia)' },
  { nome: 'News & Politics', rotulo: 'News & Politics (Notícias e política)' },
  { nome: 'Film & Animation', rotulo: 'Film & Animation (Filmes e animações)' },
  { nome: 'Autos & Vehicles', rotulo: 'Autos & Vehicles (Automóveis e veículos)' },
  { nome: 'Pets & Animals', rotulo: 'Pets & Animals (Animais de estimação)' },
  { nome: 'Travel & Events', rotulo: 'Travel & Events (Viagens e eventos)' },
  { nome: 'Nonprofits & Activism', rotulo: 'Nonprofits & Activism (ONGs e ativismo)' },
];

export const CATEGORIA_DOS_JOGOS = 'Gaming';

// As regras de fábrica. As palavras vêm em português e em inglês porque as categorias da Twitch e da Kick têm o nome em inglês ("Software and Game
// Development", "Science & Technology"). A de jogos fica em segundo lugar, como aparece nas configurações.
export const REGRAS_PADRAO_DO_YOUTUBE = [
  { palavras: 'Just Chatting, Conversando, Bate-papo', categoria: 'People & Blogs' },
  { palavras: '', categoria: CATEGORIA_DOS_JOGOS, jogos: true },
  { palavras: 'Software, Tecnologia, Technology, Ciência, Science', categoria: 'Science & Technology' },
  { palavras: 'Music, Música', categoria: 'Music' },
  { palavras: 'Sports, Esportes', categoria: 'Sports' },
];

// Cada palavra vira um radical: sem acento, em minúsculas, sem o "s" do plural ("Softwares" = "software", "Esportes" = "esporte").
const radicais = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(Boolean).map(p => (p.length > 3 ? p.replace(/s$/, '') : p));

// As palavras de uma regra ("Marvel Rivals, Minecraft; Baldurs Gate"): cada uma é uma lista de radicais.
const palavrasDaRegra = texto => String(texto || '').split(/[,;\n]/).map(radicais).filter(r => r.length > 0);

// A frase aparece inteira, em sequência, dentro do texto (palavras inteiras, não pedaços de palavra).
const aparece = (texto, frase) => {
  for (let i = 0; i + frase.length <= texto.length; i++) if (frase.every((p, j) => texto[i + j] === p)) return true;
  return false;
};
const casa = (texto, regra) => palavrasDaRegra(regra.palavras).some(f => aparece(texto, f));

// Aceita as regras guardadas em qualquer formato: a lista de hoje (conferida e completada: sempre existe a linha de jogos) ou o texto das versões anteriores
// ("texto = Categoria", uma por linha), com `padrao` (a categoria dos jogos de então) para a linha de jogos.
export function normalizarRegrasDoYoutube(regras, padrao = CATEGORIA_DOS_JOGOS) {
  let lista = [];
  if (Array.isArray(regras)) {
    lista = regras.filter(r => r && typeof r === 'object').map(r => ({ palavras: String(r.palavras || ''), categoria: String(r.categoria || ''), ...(r.jogos ? { jogos: true } : {}) }));
  } else if (typeof regras === 'string') {
    lista = regras.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
      const i = l.indexOf('=');
      return { palavras: l.slice(0, i).trim(), categoria: l.slice(i + 1).trim() };
    }).filter(r => r.palavras && r.categoria);
  } else {
    return REGRAS_PADRAO_DO_YOUTUBE.map(r => ({ ...r }));
  }
  const jogos = lista.filter(r => r.jogos);
  lista = lista.filter(r => !r.jogos || r === jogos[0]); // só uma linha de jogos
  if (jogos.length === 0) lista.splice(Math.min(1, lista.length), 0, { palavras: '', categoria: String(padrao || '').trim() || CATEGORIA_DOS_JOGOS, jogos: true });
  return lista;
}

// A categoria do YouTube para esta live. Com categoria digitada, vale o texto dela; sem, as palavras do título. Primeiro os nomes de jogos da linha de jogos
// (mais específicos), depois as outras regras, na ordem; o que não casar é um jogo e vai para a categoria da linha de jogos (Gaming). Devolve
// { categoria, regra }: regra é true quando uma regra de outra categoria que não a de jogos a escolheu.
export function categoriaDoYoutube({ categoria, titulo, regras, padrao }) {
  const lista = normalizarRegrasDoYoutube(regras, padrao);
  const jogos = lista.find(r => r.jogos);
  const fixa = jogos.categoria || CATEGORIA_DOS_JOGOS;
  const texto = radicais(categoria).length ? radicais(categoria) : radicais(titulo);
  if (texto.length === 0) return { categoria: fixa, regra: false };
  if (casa(texto, jogos)) return { categoria: fixa, regra: false };
  const achada = lista.find(r => !r.jogos && r.categoria && casa(texto, r));
  return achada ? { categoria: achada.categoria, regra: true } : { categoria: fixa, regra: false };
}
