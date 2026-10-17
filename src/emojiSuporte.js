// Descobre se o sistema sabe desenhar um emoji: no Windows 10 os mais novos viram um quadradinho vazio, e as bandeiras viram duas letras. O
// emoji é desenhado num canvas e comparado com o desenho de um caractere que não existe; sequências quebradas (que viram vários emojis) saem
// pela largura. Sem canvas, tudo conta como suportado.
const TAM = 28;
const cache = new Map();
let pronto = false;
let ctx = null;
let tofu = null;
let larguraBase = 0;

function desenhar(texto) {
  ctx.clearRect(0, 0, TAM * 2, TAM);
  ctx.fillStyle = '#000';
  ctx.fillText(texto, 2, 2);
  return ctx.getImageData(0, 0, TAM * 2, TAM).data;
}

function preparar() {
  if (pronto) return Boolean(ctx);
  pronto = true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = TAM * 2;
    canvas.height = TAM;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.font = `${TAM - 8}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textBaseline = 'top';
    tofu = desenhar('\u{10FFFE}');
    larguraBase = ctx.measureText('😀').width;
  } catch (_) {
    ctx = null;
  }
  return Boolean(ctx);
}

const iguais = (a, b) => {
  let diferentes = 0;
  for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 40) diferentes++;
  return diferentes < 6;
};
const temCor = dados => {
  for (let i = 0; i < dados.length; i += 4) if (dados[i + 3] > 0 && (Math.abs(dados[i] - dados[i + 1]) > 10 || Math.abs(dados[i + 1] - dados[i + 2]) > 10)) return true;
  return false;
};
const ehBandeiraDePais = emoji => /^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(emoji);

export function emojiSuportado(emoji) {
  if (cache.has(emoji)) return cache.get(emoji);
  let ok = true;
  if (preparar()) {
    const dados = desenhar(emoji);
    ok = ctx.measureText(emoji).width <= larguraBase * 1.35 && !iguais(dados, tofu) && (!ehBandeiraDePais(emoji) || temCor(dados));
  }
  cache.set(emoji, ok);
  return ok;
}
