// Estado das lives de cada plataforma, montado dos eventos do Streamer.bot (espectadores, início e fim da transmissão), e a saúde da
// transmissão lida do OBS. Sem React nem DOM.

const IDADE_MAXIMA_MS = 5 * 60 * 1000; // um número de espectadores mais velho que isso não conta (a plataforma parou de avisar)

export const estadoInicialDasLives = () => ({
  twitch: { aoVivo: false, inicioMs: null, espectadores: null, quandoMs: 0 },
  kick: { aoVivo: false, inicioMs: null, espectadores: null, quandoMs: 0 },
  youtube: { aoVivo: false, inicioMs: null, espectadores: null, quandoMs: 0 },
});

// Aplica um evento 'espectadores' ou 'transmissao' (streamerbot.js) ao estado; qualquer outro devolve o mesmo estado.
export function aplicarEventoDeLive(estado, ev, agora = Date.now()) {
  const atual = estado[ev.plataforma];
  if (!atual) return estado;
  if (ev.tipo === 'espectadores') {
    // um aviso de espectadores quer dizer que a plataforma está no ar; o início só muda se o evento o trouxer
    return { ...estado, [ev.plataforma]: { ...atual, aoVivo: true, espectadores: ev.quantidade, quandoMs: agora, inicioMs: ev.inicioMs ?? atual.inicioMs } };
  }
  if (ev.tipo === 'transmissao') {
    return ev.aoVivo
      ? { ...estado, [ev.plataforma]: { ...atual, aoVivo: true, inicioMs: ev.inicioMs ?? atual.inicioMs, quandoMs: agora } }
      : { ...estado, [ev.plataforma]: { aoVivo: false, inicioMs: null, espectadores: null, quandoMs: 0 } };
  }
  return estado;
}

// A plataforma está no ar: o último aviso (espectadores ou início) é recente.
export const estaNoAr = (lv, agora = Date.now()) => lv.aoVivo && agora - lv.quandoMs <= IDADE_MAXIMA_MS;

// O que o OBS diz da transmissão: 'no-ar' (a principal ou algum destino do multistream), 'parada' ou 'desconhecida' (sem leitura do OBS). O OBS
// é quem sabe quando a live acabou: as plataformas nem sempre avisam (a Kick e o YouTube às vezes não, e cada uma no seu tempo), então uma leitura
// 'parada' vale mais que o último aviso delas.
export function estadoDoObs(saude) {
  if (!saude || !saude.conectado) return 'desconhecida';
  return saude.ativo || saude.principalAtiva ? 'no-ar' : 'parada';
}

// Soma dos espectadores das plataformas no ar, e o que cada uma tem. `total` é null enquanto nenhuma informou.
export function totalDeEspectadores(estado, agora = Date.now()) {
  const porPlataforma = {};
  let total = null;
  for (const [id, lv] of Object.entries(estado)) {
    if (!estaNoAr(lv, agora) || lv.espectadores === null) continue;
    porPlataforma[id] = lv.espectadores;
    total = (total ?? 0) + lv.espectadores;
  }
  return { total, porPlataforma };
}

// "1:02:05" ou "05:09": tempo da live sem os zeros à esquerda das horas.
export function duracaoCurta(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const dois = n => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${dois(Math.floor((s % 3600) / 60))}:${dois(s % 60)}` : `${dois(Math.floor(s / 60))}:${dois(s % 60)}`;
}

// Quanto tempo a plataforma está no ar: pelo início que ela informou; sem ele, pelo tempo da transmissão do OBS (`desdeObsMs`, a duração
// que o OBS informa); sem nenhum dos dois, null.
export function tempoNoAr(lv, desdeObsMs, agora = Date.now()) {
  if (lv.inicioMs) return Math.max(0, agora - lv.inicioMs);
  return desdeObsMs ?? null;
}

// Saúde da transmissão a partir de duas amostras do OBS ({ bytes, quadros, perdidos, ms }): kbps de upload e % de quadros perdidos
// no intervalo. null enquanto só há uma amostra.
export function saudeDeAmostras(antes, depois) {
  if (!antes || !depois || depois.ms <= antes.ms) return null;
  const kbps = Math.max(0, ((depois.bytes - antes.bytes) * 8) / (depois.ms - antes.ms));
  const quadros = depois.quadros - antes.quadros;
  const perdidos = depois.perdidos - antes.perdidos;
  return { kbps: Math.round(kbps), perdaPct: quadros > 0 ? Math.max(0, (perdidos / quadros) * 100) : 0 };
}

// Quebra de quadros e travamentos a partir de duas leituras de GetStats do OBS ({ renderPulados, renderTotal, encoderPulados, encoderTotal }):
// % de quadros que a renderização do OBS deixou de desenhar (OBS travando) e % que o encoder pulou (encoder sobrecarregado) no intervalo.
export function qualidadeDeQuadros(antes, depois) {
  if (!antes || !depois) return null;
  const pct = (pulados, total) => (total > 0 ? Math.max(0, (pulados / total) * 100) : 0);
  return {
    renderPct: pct(depois.renderPulados - antes.renderPulados, depois.renderTotal - antes.renderTotal),
    encoderPct: pct(depois.encoderPulados - antes.encoderPulados, depois.encoderTotal - antes.encoderTotal),
  };
}

// O que mostrar na linha de qualidade, em ordem de gravidade: [{ nivel: 'atencao' | 'ruim', texto }]. Vazio = tudo certo.
// Entram a rede (congestionamento e reconexão), os quadros que o encoder pulou, a renderização do OBS e o tempo de renderização por quadro. Os
// textos são para quem não é técnico: dizem o que está acontecendo, sem nome de componente.
export function problemasDaTransmissao({ congestao, reconectando, renderPct, encoderPct, fps, msPorQuadro }) {
  const p = [];
  if (reconectando) {
    p.push({ nivel: 'ruim', texto: 'Reconectando com a plataforma…', curto: 'reconectando…', dica: 'A conexão com a plataforma caiu e o OBS está tentando voltar. Enquanto isso, quem assiste vê a live parada ou cortada.' });
  } else if (congestao >= 0.3) {
    p.push({ nivel: 'ruim', texto: 'A internet está ruim e a live pode estar falhando', curto: 'internet ruim', dica: 'O OBS não consegue enviar o vídeo na velocidade em que ele é gerado e está descartando quadros. Quem assiste vê travadas e pulos, mesmo que o seu PC esteja bem.' });
  } else if (congestao >= 0.05) {
    p.push({ nivel: 'atencao', texto: 'A internet está oscilando um pouco', curto: 'internet oscilando', dica: 'O envio está um pouco atrasado em relação ao vídeo. Pode aparecer algum engasgo para quem assiste, mas ainda não é grave.' });
  }
  if (encoderPct >= 3) {
    p.push({ nivel: 'ruim', texto: 'O PC não está dando conta de codificar o vídeo', curto: 'PC não codifica', dica: 'A placa de vídeo ou o processador não está conseguindo codificar todos os quadros, e eles estão sendo pulados. A live trava para quem assiste mesmo com internet boa.' });
  } else if (encoderPct >= 0.5) {
    p.push({ nivel: 'atencao', texto: 'O PC teve dificuldade de codificar o vídeo', curto: 'PC engasgou ao codificar', dica: 'Alguns quadros deixaram de ser codificados nos últimos segundos. Foi rápido, mas vale ficar de olho.' });
  }
  if (renderPct >= 3) {
    p.push({ nivel: 'ruim', texto: 'O OBS está travando: o PC está sobrecarregado', curto: 'OBS travando', dica: 'O OBS não consegue desenhar todos os quadros (jogo pesado, capturas demais, placa de vídeo no limite). O vídeo da live e da gravação fica travando.' });
  } else if (renderPct >= 0.5) {
    p.push({ nivel: 'atencao', texto: 'O OBS deu uma engasgada', curto: 'OBS engasgou', dica: 'O OBS pulou alguns quadros nos últimos segundos: uma travadinha rápida no vídeo, como quando o jogo pesa por um instante.' });
  }
  if (fps && msPorQuadro && msPorQuadro > (1000 / fps) * 0.9) {
    p.push({ nivel: 'atencao', texto: 'O OBS está no limite para desenhar cada quadro', curto: 'OBS no limite', dica: 'Cada quadro está levando quase todo o tempo que o OBS tem para desenhá-lo. Qualquer pico a mais vai causar quadros pulados.' });
  }
  return p.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'ruim' ? -1 : 1));
}
