// Configurações do dock (aba aberta pela bolinha de estado): tema, conexões e marcação de momentos. Tudo fica no armazenamento
// do navegador do dock; o que não foi mudado vale o padrão de config.js. O tema vira variáveis de CSS no <html>.
import { ler, gravar } from './armazenamento.js';
import { STREAMERBOT_URL, STREAMERBOT_SENHA, OBS_URL, OBS_SENHA } from './config.js';

// Cores de destaque e conjuntos de fundo oferecidos na tela de configurações.
export const ACENTOS = [
  { nome: 'Safira', hex: '#2F6FEB' },
  { nome: 'Violeta', hex: '#8B6CFF' },
  { nome: 'Esmeralda', hex: '#10B981' },
  { nome: 'Dourado', hex: '#E0A526' },
  { nome: 'Rosa', hex: '#EC4899' },
  { nome: 'Vermelho', hex: '#EF4444' },
  { nome: 'Ciano', hex: '#06B6D4' },
];
// fundo, cartao, campo, elevado, elevado-sobre, fundo-chat
const CHAVES_DO_FUNDO = ['fundo', 'cartao', 'campo', 'elevado', 'elevado-sobre', 'fundo-chat'];
export const FUNDOS = {
  Grafite: ['#0B0B10', '#13131A', '#0D0D13', '#1B1B25', '#262633', '#0A0A0F'],
  Preto: ['#000000', '#0C0C0E', '#050506', '#16161A', '#212127', '#050506'],
  'Azul-noite': ['#070B14', '#0D1322', '#080C18', '#151D33', '#1F2A47', '#060A12'],
  Vinho: ['#110A0D', '#1A1014', '#0E080A', '#25161C', '#321F27', '#0D0709'],
  Floresta: ['#090E0C', '#101915', '#0A110E', '#182620', '#22362D', '#080D0B'],
};

const PADRAO = {
  tema: { acento: ACENTOS[0].hex, fundo: 'Grafite' },
  streamerbot: { url: STREAMERBOT_URL, senha: STREAMERBOT_SENHA },
  obs: { url: OBS_URL, senha: OBS_SENHA },
  momentos: { pasta: '', tituloDeClipe: false }, // pasta vazia = a Clipes ao lado do dock
};

// Mistura a e b (arrays [r, g, b]) na proporção k de b.
const misturar = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgbDe = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const cssRgb = rgb => rgb.join(', ');

// Lê a configuração salva por cima do padrão (seção por seção, então uma seção nova nunca some).
export function lerConfig() {
  const salvo = ler('config', {});
  return Object.fromEntries(Object.keys(PADRAO).map(k => [k, { ...PADRAO[k], ...(salvo[k] || {}) }]));
}

export function gravarSecao(secao, valores) {
  gravar('config', { ...ler('config', {}), [secao]: valores });
}

// Aplica acento e fundo escolhidos nas variáveis de CSS (o fundo do chat acompanha o conjunto de fundo).
export function aplicarTema({ acento, fundo }) {
  const raiz = document.documentElement.style;
  const cor = rgbDe(/^#[0-9a-f]{6}$/i.test(acento) ? acento : ACENTOS[0].hex);
  raiz.setProperty('--acento', `rgb(${cssRgb(cor)})`);
  raiz.setProperty('--acento-claro', `rgb(${cssRgb(misturar(cor, [255, 255, 255], 0.35))})`);
  raiz.setProperty('--acento-rgb', cssRgb(cor));
  // texto sobre o acento: escuro nos acentos claros (dourado), branco nos demais
  const luz = (0.299 * cor[0] + 0.587 * cor[1] + 0.114 * cor[2]) / 255;
  raiz.setProperty('--acento-texto', luz > 0.6 ? '#14110a' : '#ffffff');
  const cores = FUNDOS[fundo] || FUNDOS.Grafite;
  CHAVES_DO_FUNDO.forEach((chave, i) => raiz.setProperty(`--${chave}`, cores[i].toLowerCase()));
}

// Pasta Clipes ao lado do dock (no instalado, %LOCALAPPDATA%\LiveHelm\Clipes; no modo manual, a pasta acima de dist). Vazia
// se o dock não veio de um arquivo.
export function pastaPadraoDosClipes() {
  if (location.protocol !== 'file:') return '';
  try {
    const partes = decodeURIComponent(location.pathname).replace(/^\//, '').split('/');
    partes.pop();
    if (partes.length && partes[partes.length - 1].toLowerCase() === 'dist') partes.pop();
    return `${partes.join('\\')}\\Clipes`;
  } catch (_) {
    return '';
  }
}
