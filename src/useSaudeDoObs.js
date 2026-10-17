// Mantém a leitura contínua do OBS (obsSaude.js) enquanto `ligado`: devolve a última saúde ({ conectado, ativo, ms, fps... }) ou null.
import { useEffect, useState } from 'react';
import { observarSaudeDoObs } from './obsSaude.js';

export function useSaudeDoObs(ligado, url, senha) {
  const [saude, setSaude] = useState(null);
  useEffect(() => {
    if (!ligado) { setSaude(null); return undefined; }
    return observarSaudeDoObs({ url, senha }, setSaude);
  }, [ligado, url, senha]);
  return saude;
}
