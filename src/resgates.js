// O texto que um resgate de pontos já mostra não pode aparecer de novo como mensagem do chat: a "Mensagem em destaque" da Twitch, por exemplo, chega
// duas vezes (uma como resgate, com o texto, e outra como a mensagem do chat, igualzinha). O resgate fica e a mensagem repetida some. Sem React nem
// DOM: o ChatPanel guarda os resgates recentes e pergunta aqui.

export const JANELA_DO_RESGATE_MS = 15000; // a mensagem e o resgate chegam quase juntos, em qualquer ordem

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Os dois são do mesmo autor, na mesma plataforma, com o mesmo texto (ignorando maiúsculas, acentos e espaços) e chegaram com poucos segundos de
// diferença. Cada lado é { plataforma, nome, texto, quando } (quando em ms).
export function mesmoTextoDoResgate(a, b) {
  if (!a || !b || !a.texto || !b.texto) return false;
  if (a.plataforma !== b.plataforma || semAcento(a.nome) !== semAcento(b.nome)) return false;
  if (Math.abs(a.quando - b.quando) > JANELA_DO_RESGATE_MS) return false;
  return semAcento(a.texto) === semAcento(b.texto);
}

// Guarda um resgate (com texto) na lista, sem os que já passaram da janela.
export function lembrarResgate(lista, resgate, agora = Date.now()) {
  if (!resgate || !resgate.texto) return lista;
  return [...lista.filter(r => agora - r.quando <= JANELA_DO_RESGATE_MS), { ...resgate, quando: resgate.quando ?? agora }].slice(-20);
}

// A mensagem do chat repete o texto de um resgate recente?
export function mensagemRepeteResgate(lista, mensagem, agora = Date.now()) {
  return lista.some(r => mesmoTextoDoResgate(r, { ...mensagem, quando: mensagem.quando ?? agora }));
}
