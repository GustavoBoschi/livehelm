// Junta os fatos da "Verificar configuração" (a lista de ações, as plataformas conectadas, o OBS e a versão do código das ações) e entrega a lista pronta (verificacao.js).
import { lerConectadas, carregarAcoes, versaoDoCodigoDosControles, versaoDoCodigoDoYoutube } from './acoes.js';
import { verificarObs } from './obsSaude.js';
import { acoesNecessarias, montarVerificacao } from './verificacao.js';

export async function verificarConfiguracao({ config, conectado, recusa, ativas }) {
  const streamerbot = { conectado, recusa };
  let nomes = null;
  let conectadas = [];
  let controles = null;
  let youtube = null;
  if (conectado && !recusa) {
    [nomes, conectadas] = await Promise.all([carregarAcoes(), lerConectadas()]);
    const { usaControles } = acoesNecessarias({ config, ativas });
    // O código das ações só é perguntado para o que está ligado (e só se a ação existir).
    const [c, y] = await Promise.all([
      usaControles && nomes && nomes.includes('Painel: Controles') ? versaoDoCodigoDosControles() : null,
      nomes && nomes.includes('Painel: YouTube') ? versaoDoCodigoDoYoutube() : null,
    ]);
    controles = c;
    youtube = y;
  }
  const obs = await verificarObs({ ...config.obs, mic: config.mic.ligado ? config.mic.entrada.trim() : '' });
  return montarVerificacao({ streamerbot, nomes, ativas, conectadas, config, controles, youtube, obs });
}
