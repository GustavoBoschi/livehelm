// Aviso de anúncio da Twitch: o que o dock sabe do próximo anúncio e quando mostrar o pop-up. Sem React nem DOM.
//
// O Streamer.bot avisa uma vez por minuto nos 5 minutos antes do anúncio (alerta `upcoming_ad`, com `anuncio`: hora, duração e
// adiamentos restantes). O dock guarda o último aviso e mostra o pop-up quando faltam `antecedenciaS` segundos. "Adiar" pede à
// Twitch (pela ação `Painel: Anúncio`) que empurre o anúncio 5 minutos; "Deixar rodar" dispensa o aviso deste anúncio.
//
// O estado é { quandoMs, duracaoS, adiamentos, dispensado }: hora do anúncio (ms desde 1970), duração (s) e adiamentos que ainda
// restam (nulos quando o evento não diz), e se o aviso já foi dispensado.

export const ANTECEDENCIA_PADRAO_S = 30;
export const ADIAMENTO_MS = 5 * 60 * 1000; // o adiamento da Twitch empurra o anúncio em 5 minutos
const DEPOIS_DE_COMECAR_S = 3;              // o aviso fica na tela esse tempo depois da hora do anúncio
const MARGEM_MESMO_ANUNCIO_MS = 45 * 1000;  // avisos com horas mais próximas que isso são do mesmo anúncio

export const mesmoAnuncio = (a, b) => Math.abs(a.quandoMs - b.quandoMs) < MARGEM_MESMO_ANUNCIO_MS;

// Junta um aviso novo ao que já se sabe. Um anúncio diferente do guardado (por exemplo, depois de adiar) volta a poder avisar;
// o mesmo anúncio mantém o "dispensado".
export function comAviso(atual, aviso) {
  const dispensado = !!atual && mesmoAnuncio(atual, aviso) && atual.dispensado;
  return { quandoMs: aviso.quandoMs, duracaoS: aviso.duracaoS ?? null, adiamentos: aviso.adiamentos ?? null, dispensado };
}

export const dispensar = anuncio => ({ ...anuncio, dispensado: true });

// Depois de pedir o adiamento: o anúncio vai 5 minutos pra frente e gasta um adiamento. O aviso volta quando chegar a hora de novo.
export const adiado = anuncio => ({
  ...anuncio,
  quandoMs: anuncio.quandoMs + ADIAMENTO_MS,
  adiamentos: anuncio.adiamentos === null ? null : Math.max(0, anuncio.adiamentos - 1),
  dispensado: false,
});

export const segundosAte = (anuncio, agora) => Math.ceil((anuncio.quandoMs - agora) / 1000);

// true enquanto o pop-up deve estar na tela: dentro da antecedência e até 3 s depois de o anúncio começar.
export function deveMostrar(anuncio, agora, antecedenciaS) {
  if (!anuncio || anuncio.dispensado) return false;
  const s = segundosAte(anuncio, agora);
  return s <= antecedenciaS && s > -DEPOIS_DE_COMECAR_S;
}

// 75 -> "1:15"; tempo negativo vira "0:00".
export function contagem(segundos) {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
