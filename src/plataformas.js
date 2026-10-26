// Cor e ícone (caminho SVG em viewBox 24x24) de cada plataforma, pelo campo `type` das mensagens. Sem ícone,
// a plataforma aparece pelo nome, em texto.
export const PLATAFORMAS = {
  twitch: { nome: 'Twitch', cor: '#9146ff', icone: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z' },
  youtube: { nome: 'YouTube', cor: '#ff3b3b', icone: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
  // Doações em Pix: o alerta do LivePix entra como uma plataforma só para ter a cor (o azul do degradê do logo, #4DC4EB) e o símbolo (os três traços do logo, de custom_logo.svg do site do
  // LivePix, reduzidos para a caixa de 24). Não é uma plataforma de chat.
  livepix: { nome: 'LivePix', cor: '#4dc4eb', icone: 'M9.35 23.92C6.87 23.92 4.49 22.93 2.74 21.18C0.99 19.42 0 17.04 0 14.56V5.83C0 5.44 0 4.62 1.98 4.62C3.96 4.62 3.96 5.41 3.96 5.83V14.56C3.96 15.27 4.1 15.97 4.37 16.63C4.64 17.28 5.04 17.88 5.54 18.38C6.04 18.88 6.63 19.27 7.28 19.55C7.94 19.82 8.64 19.96 9.35 19.96H18.07C18.46 19.96 19.28 19.96 19.28 21.94C19.28 23.92 18.46 23.92 18.07 23.92H9.35Z M14.59 0C17.07 0 19.45 0.99 21.2 2.74C22.95 4.5 23.94 6.88 23.94 9.36V18.09C23.94 18.48 23.94 19.29 21.96 19.29C19.98 19.29 19.98 18.51 19.98 18.09V9.36C19.98 8.65 19.84 7.95 19.57 7.29C19.3 6.64 18.9 6.04 18.4 5.54C17.9 5.04 17.31 4.64 16.65 4.37C16 4.1 15.3 3.96 14.59 3.96H5.86C5.47 3.96 4.66 3.96 4.66 1.98C4.66 0 5.47 0 5.86 0L14.59 0Z M15.34 8H8.57C8.26 8 8.01 8.26 8.01 8.57V15.34C8.01 15.65 8.26 15.91 8.57 15.91H15.34C15.65 15.91 15.91 15.65 15.91 15.34V8.57C15.91 8.26 15.65 8 15.34 8Z' },
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
