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
