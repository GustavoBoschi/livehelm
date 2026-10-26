// "Verificar configuração" (Configurações): monta a lista de ✓, ! e ✕ do que está ligado, cada linha com o que fazer. Só funções puras: quem junta os fatos (a lista de
// ações, o OBS, a versão do código das ações) é o verificar.js. nivel: 0 = ok, 1 = aviso, 2 = erro.

const NOME_DA_PLATAFORMA = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };
const AJUDA_DA_ACAO = 'Crie a ação com esse nome exato (o dock compara letra por letra) e cole o código, se ela tiver: docs/INSTRUCOES.md, seção 3.';

// As ações que cada coisa ligada precisa: [nome, nível se faltar, para quê].
export function acoesNecessarias({ config, ativas }) {
  const lista = [];
  for (const p of ['twitch', 'kick', 'youtube']) if (ativas[p]) lista.push([`Painel: ${NOME_DA_PLATAFORMA[p]}`, 2, `título e categoria ${p === 'youtube' ? 'no' : 'na'} ${NOME_DA_PLATAFORMA[p]}`]);
  lista.push(['Painel: Chat', 2, 'enviar e moderar o chat']);
  lista.push(['Painel: Tags', 1, 'tags da Twitch e a leitura do título e da categoria atuais']);
  lista.push(['Painel: Momentos', 1, 'marcação de momentos']);
  if (config.anuncio.ligado) lista.push(['Painel: Anuncio', 2, 'o botão Adiar 5 min do aviso de anúncio']);
  // Responder e ver o perfil funcionam sem ela (a resposta sai com @nome e o cartão mostra o que o chat entrega); com ela a resposta é ligada à mensagem e o perfil traz a conta da Twitch.
  const usaControles = config.modosDoChat.ligado || config.clipe.ligado || config.chat.resgates;
  if (usaControles) lista.push(['Painel: Controles', 2, 'modos do chat, clipe e a fila de resgates']);
  return { lista, usaControles };
}

// f = { streamerbot: { conectado, recusa }, nomes (ou null), ativas, conectadas, config, controles: { achou, versao } | null, youtube: { achou, versao } | null,
// obs: { ok, versao, erro, micOk, micErro } | null }
export function montarVerificacao(f) {
  const linhas = [];
  const ponha = (id, nivel, texto, ajuda = '') => linhas.push({ id, nivel, texto, ajuda });

  if (f.streamerbot.recusa) ponha('streamerbot', 2, `O Streamer.bot recusou a conexão (${f.streamerbot.recusa})`, 'Confira a senha em Configurações > Streamer.bot.');
  else if (!f.streamerbot.conectado) ponha('streamerbot', 2, 'O Streamer.bot está desconectado', 'Abra o Streamer.bot, ligue o WebSocket Server (Servers/Clients) e confira o endereço e a senha em Configurações > Streamer.bot.');
  else ponha('streamerbot', 0, 'Streamer.bot conectado');

  if (f.streamerbot.conectado && !f.streamerbot.recusa) {
    for (const p of ['twitch', 'kick', 'youtube']) {
      if (f.ativas[p] && !f.conectadas.includes(p)) ponha(`plataforma-${p}`, 1, `${NOME_DA_PLATAFORMA[p]}: ligada no alto, mas sem conexão no Streamer.bot`, `Conecte a conta da ${NOME_DA_PLATAFORMA[p]} em Platforms, no Streamer.bot (ou desligue a ${NOME_DA_PLATAFORMA[p]} no alto do dock).`);
    }
    if (!f.nomes) {
      ponha('acoes', 1, 'Ainda não li a lista de ações do Streamer.bot', 'Espere alguns segundos e verifique de novo.');
    } else {
      const { lista, usaControles } = acoesNecessarias(f);
      const faltam = lista.filter(([nome]) => !f.nomes.includes(nome));
      for (const [nome, nivel, paraQue] of faltam) ponha(`acao-${nome}`, nivel, `Falta a ação “${nome}” (${paraQue})`, AJUDA_DA_ACAO);
      if (faltam.length === 0) ponha('acoes', 0, `As ${lista.length} ações que você usa existem`);
      if (usaControles && f.nomes.includes('Painel: Controles') && f.controles) {
        if (!f.controles.achou) ponha('controles', 1, 'A ação Painel: Controles não respondeu', 'Confira se o código compilou (Save and Compile) e se a ação tem a sub-ação Execute C# Code com o conteúdo de Painel-Controles.cs.');
        else if (f.controles.versao < 2) ponha('controles', 2, 'O código da ação Painel: Controles está antigo', 'Cole de novo o conteúdo de Painel-Controles.cs na ação (resgates, resposta e perfil precisam da versão nova).');
        else ponha('controles', 0, 'O código de Painel: Controles está na versão certa');
      }
      if (f.nomes.includes('Painel: YouTube') && f.youtube) {
        const precisaDaVersao2 = f.config.youtubeInfo.ligado;
        if (!f.youtube.achou) ponha('youtube', 1, 'A ação Painel: YouTube não respondeu', 'Confira se o código compilou e é o de Painel-YouTube.cs.');
        else if (f.youtube.versao < 2 && precisaDaVersao2) ponha('youtube', 2, 'O código da ação Painel: YouTube está antigo (tags e descrição precisam da versão 3)', 'Cole de novo o conteúdo de Painel-YouTube.cs na ação.');
        else if (f.youtube.versao < 4) ponha('youtube', 1, 'O código da ação Painel: YouTube está antigo (a versão 4 não reclama da categoria que a live já tem e avisa se o título ficou com %tituloLive%)', 'Cole de novo o conteúdo de Painel-YouTube.cs na ação e confira que ela NÃO tem a sub-ação antiga YouTube > Set Title (só a de código).');
        else ponha('youtube', 0, 'O código de Painel: YouTube está na versão certa');
      }
    }
  }

  if (f.obs) {
    if (f.obs.ok) ponha('obs', 0, `OBS conectado${f.obs.versao ? ` (versão ${f.obs.versao})` : ''}`);
    else ponha('obs', 2, `O OBS não respondeu (${f.obs.erro || 'sem motivo'})`, 'No OBS, ligue o servidor WebSocket (Ferramentas > Configurações do servidor WebSocket) e confira o endereço e a senha em Configurações > OBS.');
    if (f.config.mic.ligado) {
      if (!f.config.mic.entrada.trim()) ponha('mic', 1, 'O mudo do microfone está ligado, mas falta escolher a entrada', 'Em Configurações > Mudo do microfone, use Listar as entradas do OBS e escolha o seu microfone.');
      else if (f.obs.ok && f.obs.micOk) ponha('mic', 0, `Microfone “${f.config.mic.entrada.trim()}” encontrado no OBS`);
      else if (f.obs.ok) ponha('mic', 2, `Não achei a entrada “${f.config.mic.entrada.trim()}” no OBS`, 'Escolha o microfone de novo em Configurações > Mudo do microfone (Listar as entradas do OBS): o nome precisa ser igual ao do OBS.');
    }
  }
  if (linhas.every(l => l.nivel === 0)) linhas.push({ id: 'tudo', nivel: 0, texto: 'Tudo certo com o que está ligado.', ajuda: '' });
  return linhas;
}
