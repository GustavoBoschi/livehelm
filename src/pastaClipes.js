// Regra da pasta dos arquivos de clipes, a mesma que a ação `Painel: Momentos` aplica no C#: vazia (a ação usa a pasta padrão dela)
// ou um caminho local com letra de unidade, sem ".." e sem caminho de rede. O pedido chega pelo WebSocket do Streamer.bot, então a ação
// não pode gravar onde o pedido mandar.
export function pastaDeClipesValida(pasta) {
  if (pasta === '') return true;
  if (!/^[A-Za-z]:[\\/]/.test(pasta)) return false;
  return !pasta.split(/[\\/]/).includes('..');
}
