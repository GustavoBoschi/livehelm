// Cor e ícone (caminho SVG em viewBox 24x24) de cada plataforma, pelo campo `type` das mensagens. Sem ícone,
// a plataforma aparece pelo nome, em texto.
export const PLATAFORMAS = {
  twitch: { nome: 'Twitch', cor: '#9146ff', icone: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z' },
  youtube: { nome: 'YouTube', cor: '#ff3b3b', icone: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
  kick: { nome: 'Kick', cor: '#53fc18', icone: 'M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z' },
  tiktok: { nome: 'TikTok', cor: '#25f4ee' },
  facebook: { nome: 'Facebook', cor: '#4a8cff' },
  trovo: { nome: 'Trovo', cor: '#19d66b' },
};

// Plataforma de uma mensagem; as desconhecidas aparecem pelo nome que veio na mensagem.
export function plataformaDe(tipo) {
  const chave = String(tipo || '').toLowerCase();
  return PLATAFORMAS[chave] || { nome: String(tipo || ''), cor: '#8a8a99' };
}
