// A linha de saúde do OBS, logo abaixo dos botões de plataforma no alto do dock: fps, CPU e upload em letra pequena, "Live On" ou "Live Off" e, ao
// lado dele, o que está errado na transmissão (rede instável ou ruim, encoder pulando quadros, OBS travando) em texto curto. A linha tem sempre uma
// linha só de altura (o texto corta com "…" quando falta espaço, o completo fica na dica): quando a live trava o aviso surge e some sem empurrar o
// chat e os painéis de baixo, que dariam a impressão de uma mensagem nova. Os dados vêm do App (obsSaude.js).
import { problemasDaTransmissao } from './lives.js';

const mbps = kbps => `${(kbps / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} Mb/s`;

export default function SaudeDoObs({ saude }) {
  const conectado = Boolean(saude && saude.conectado);
  if (!conectado) {
    return <div className="saude-obs saude-obs-parada" id="saude-do-obs" title={saude && saude.erro ? saude.erro : 'OBS sem conexão. Confira o endereço e a senha nas configurações.'}>OBS sem conexão. Confira o endereço e a senha nas configurações.</div>;
  }
  const noAr = saude.ativo;
  const problemas = noAr ? problemasDaTransmissao(saude) : [];
  const nivel = !noAr ? 'parada' : problemas.some(p => p.nivel === 'ruim') ? 'ruim' : problemas.length ? 'atencao' : 'ok';
  const detalheDoUpload = noAr
    ? `Upload de um destino${saude.destinos > 1 ? `, e são ${saude.destinos} no ar` : ''} · congestionamento ${saude.congestao === null ? 'n/d' : `${Math.round(saude.congestao * 100)}%`}`
    : 'Sem transmissão no OBS';
  const dicaDaQualidade = !noAr ? 'Nenhuma transmissão no ar no OBS.' : problemas.length === 0 ? 'No ar e sem nenhum problema de internet, quadros pulados ou travamento nos últimos segundos.' : problemas.map(p => `${p.texto}. ${p.dica}`).join(' ');
  return (
    <div className="saude-obs" id="saude-do-obs">
      <span title="Quadros por segundo do OBS">{saude.fps !== null ? Math.round(saude.fps) : '–'} fps</span>
      <span title="Uso de CPU do OBS">CPU {saude.cpu !== null ? Math.round(saude.cpu) : '–'}%</span>
      <span className={`ms-${nivel}`} title={detalheDoUpload}>↑ {mbps(noAr && saude.kbps !== null ? saude.kbps : 0)}{noAr && saude.destinos > 1 ? ` ×${saude.destinos}` : ''}</span>
      <span className={`ms-${nivel}`} id="qualidade-da-live" title={dicaDaQualidade}>● {noAr ? 'Live On' : 'Live Off'}</span>
      {problemas.length > 0 && (
        <span className={`saude-aviso ms-${nivel}`} id="aviso-da-live" title={dicaDaQualidade}>{problemas.map(p => p.curto || p.texto).join(' · ')}</span>
      )}
    </div>
  );
}
