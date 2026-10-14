// Funções puras de texto do chat: hora, duração, busca sem acento, cor legível, partes da mensagem e cópia.

export const hora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const horaDe = ms => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const duracao = s => (s >= 3600 ? `${Math.floor(s / 3600)} h` : s >= 60 ? `${Math.floor(s / 60)} min` : `${s} s`);

// Sem acento e sem maiúsculas; a pontuação fica (a busca por "?" acha as perguntas).
export const simplificar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Cor do nome mais clara quando é escura demais pro fundo do chat.
export function corLegivel(cor) {
  const m = /^#([0-9a-f]{6})$/i.exec(cor || '');
  if (!m) return '#cfcbe0';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 >= 0.35) return cor;
  const mix = v => Math.round(v + (255 - v) * 0.55);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// O texto vem como HTML (emotes são <img>): mantém só texto e imagens https.
export function partesDaMensagem(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const partes = [];
  const visita = no => {
    if (no.nodeType === 3) { if (no.textContent) partes.push({ texto: no.textContent }); return; }
    if (no.nodeName === 'IMG') {
      const src = no.getAttribute('src') || '';
      if (/^https:\/\//i.test(src)) partes.push({ emote: src, alt: no.getAttribute('alt') || '' });
      return;
    }
    no.childNodes.forEach(visita);
  };
  doc.body.childNodes.forEach(visita);
  return partes;
}

// Copia sem pedir permissão (a API de área de transferência pode ser negada no navegador do OBS).
export function copiarTexto(texto) {
  const campo = document.createElement('textarea');
  campo.value = texto;
  campo.style.position = 'fixed';
  campo.style.opacity = '0';
  document.body.appendChild(campo);
  campo.select();
  try { document.execCommand('copy'); } catch (_) { /* sem área de transferência */ }
  document.body.removeChild(campo);
}
