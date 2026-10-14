// Preferências do Dock no armazenamento do navegador do OBS (por dock). Qualquer falha (armazenamento bloqueado, JSON
// quebrado) devolve o padrão: o Dock funciona sem lembrar de nada.
const PREFIXO = 'livehelm.';

export function ler(chave, padrao) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto === null ? padrao : JSON.parse(bruto);
  } catch (_) {
    return padrao;
  }
}

export function gravar(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch (_) { /* sem armazenamento: só não lembra */ }
}
