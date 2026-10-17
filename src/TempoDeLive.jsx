// O tempo de live ao lado do símbolo de uma plataforma, no alto do dock: conta desde o início que a plataforma informou ou, sem ele, desde o
// início da transmissão no OBS; fora do ar fica em 00:00. Tem o próprio relógio de 1 s pra não refazer o dock inteiro a cada segundo.
import { useEffect, useState } from 'react';
import { duracaoCurta } from './lives.js';

export default function TempoDeLive({ inicioMs, noAr }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (!noAr || !inicioMs) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [noAr, inicioMs]);
  return <span className="plataforma-tempo">{duracaoCurta(noAr && inicioMs ? agora - inicioMs : 0)}</span>;
}
