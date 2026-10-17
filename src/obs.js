// Tempo da transmissão no OBS, lido do obs-websocket (v5) na hora de marcar um momento: abre uma conexão, autentica,
// pergunta e fecha. Vale o tempo da transmissão; sem transmissão, o da gravação.
import { sha256Base64 } from './sha256.js';

const LIMITE_MS = 5000;

// Devolve { ok: true, ms, origem: 'transmissão' | 'gravação' } ou { ok: false, erro }.
export function tempoDoOBS({ url, senha }) {
  return new Promise(resolve => {
    let ws;
    let resolvido = false;
    const terminar = resultado => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(limite);
      try { ws.close(); } catch (_) { /* já fechada */ }
      resolve(resultado);
    };
    const limite = setTimeout(() => terminar({ ok: false, erro: 'o OBS não respondeu (confira o endereço e se o servidor WebSocket está ligado)' }), LIMITE_MS);
    try { ws = new WebSocket(url); } catch (_) { terminar({ ok: false, erro: 'endereço do OBS inválido' }); return; }
    const pedir = tipo => ws.send(JSON.stringify({ op: 6, d: { requestType: tipo, requestId: tipo } }));
    ws.onerror = () => terminar({ ok: false, erro: 'não consegui falar com o OBS (servidor WebSocket desligado?)' });
    ws.onclose = () => terminar({ ok: false, erro: 'o OBS fechou a conexão' });
    ws.onmessage = async ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (m.op === 0) {
        const identificar = { rpcVersion: 1, eventSubscriptions: 0 };
        const a = m.d && m.d.authentication;
        if (a) {
          if (!senha) { terminar({ ok: false, erro: 'o OBS pede senha: coloque a do servidor WebSocket nas configurações' }); return; }
          const segredo = await sha256Base64(senha + a.salt);
          identificar.authentication = await sha256Base64(segredo + a.challenge);
        }
        ws.send(JSON.stringify({ op: 1, d: identificar }));
      } else if (m.op === 2) {
        pedir('GetStreamStatus');
      } else if (m.op === 7 && m.d.requestType === 'GetStreamStatus') {
        const status = m.d.responseData;
        if (status && status.outputActive) terminar({ ok: true, ms: status.outputDuration || 0, origem: 'transmissão' });
        else pedir('GetRecordStatus');
      } else if (m.op === 7 && m.d.requestType === 'GetRecordStatus') {
        const r = m.d.responseData;
        if (r && r.outputActive) terminar({ ok: true, ms: r.outputDuration || 0, origem: 'gravação' });
        else terminar({ ok: false, erro: 'o OBS não está transmitindo nem gravando' });
      }
    };
  });
}

// 3725000 -> "01:02:05"
export function formatarTempo(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const dois = n => String(n).padStart(2, '0');
  return `${dois(Math.floor(s / 3600))}:${dois(Math.floor((s % 3600) / 60))}:${dois(s % 60)}`;
}
