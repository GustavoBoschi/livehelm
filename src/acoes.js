// Conversa do Dock com o Streamer.bot: as ações do Painel (título e categoria, chat e moderação) por DoAction. Os
// nomes das ações e os argumentos (acao, plataforma, usuario...) são os da ação `Painel: Chat` (código em
// acoes-streamerbot/Painel-Chat.cs): mudou lá, mude aqui.
import { pedirStreamerbot } from './streamerbot.js';
import { aguardarLeitura, respostaDoYoutube, respostaDosControles } from './tagsLista.js';
import { lerConfig } from './configuracoes.js';
import { tituloDoYoutube, variantesDeCategoria, categoriaDoYoutube, descricaoDoYoutube, tagsDoYoutube } from './titulos.js';
import { ler, gravar } from './armazenamento.js';

export const PLATAFORMAS_DO_DOCK = ['twitch', 'kick', 'youtube'];
export const NOME_DA_PLATAFORMA = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };
const ACAO_DA_LIVE = { twitch: 'Painel: Twitch', kick: 'Painel: Kick', youtube: 'Painel: YouTube' };
// A ação que envia, apaga, silencia e bane; o primeiro nome que existir vale.
export const ACOES_DO_CHAT = ['Painel: Chat', 'Painel: Enviar mensagem'];
const ROTULO_DO_VERBO = { enviar: 'Enviar', silenciar: 'Silenciar', banir: 'Banir' };
const ACAO_TAGS = 'Painel: Tags';
const VARIAVEL_DE_TAGS = 'painelTags'; // global não persistente que a Painel: Tags escreve ao ler as tags do canal
const ACAO_MOMENTOS = 'Painel: Momentos';
const ACAO_SEM_CATEGORIA = 'Painel: Sem Categoria'; // opcional (Painel-SemCategoria.cs): tira a categoria da Twitch
const VARIAVEL_DO_YOUTUBE = 'painelYoutube'; // global não persistente com o resultado da Painel: YouTube (Painel-YouTube.cs)
const ACAO_ANUNCIO = 'Painel: Anuncio'; // sem acento de propósito: o nome tem que ser idêntico nos dois lados
const ACAO_CONTROLES = 'Painel: Controles'; // Painel-Controles.cs: modos do chat da Twitch e clipe
const VARIAVEL_DOS_CONTROLES = 'painelControles'; // global não persistente com o resultado da Painel: Controles
const CONFIRMACAO_MS = 3500; // quanto esperar o aviso que confirma o título e a categoria (a Kick nunca confirma: o resultado sai depois disso)

let acoes = null; // ações do Streamer.bot ([{ id, name }]); null = ainda não carregou
const achar = nome => (acoes || []).find(a => a.name === nome) || null;

// Compara sem diferenciar maiúsculas, acentos, espaços e símbolos.
export const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Lê as ações do Streamer.bot e devolve os nomes (null se não deu).
export async function carregarAcoes() {
  const r = await pedirStreamerbot({ request: 'GetActions' });
  if (r.status !== 'ok') return null;
  acoes = Array.isArray(r.actions) ? r.actions : [];
  return acoes.map(a => a.name);
}

// Plataformas conectadas no Streamer.bot ([] se a consulta falhou).
export async function lerConectadas() {
  const r = await pedirStreamerbot({ request: 'GetBroadcaster' });
  return r.status === 'ok' && Array.isArray(r.connected) ? r.connected.map(c => String(c).toLowerCase()) : [];
}

// Nomes das ações da Live que o Streamer.bot não tem, pras plataformas pedidas.
export const acoesQueFaltam = (plataformas, nomes) => plataformas.map(p => ACAO_DA_LIVE[p]).filter(n => !(nomes || []).includes(n));
// As ações do Streamer.bot que existem só pras tags e pra marcação de momentos.
export const temAcaoDeTags = nomes => (nomes || []).includes(ACAO_TAGS);
export const temAcaoDeMomentos = nomes => (nomes || []).includes(ACAO_MOMENTOS);
export const NOME_DA_ACAO_DE_TAGS = ACAO_TAGS;
export const NOME_DA_ACAO_DE_MOMENTOS = ACAO_MOMENTOS;
export const temAcaoDeAnuncio = nomes => (nomes || []).includes(ACAO_ANUNCIO);
export const NOME_DA_ACAO_DE_ANUNCIO = ACAO_ANUNCIO;
export const temAcaoDeControles = nomes => (nomes || []).includes(ACAO_CONTROLES);
export const NOME_DA_ACAO_DE_CONTROLES = ACAO_CONTROLES;
export const NOME_DA_ACAO_DO_YOUTUBE = ACAO_DA_LIVE.youtube;
export const temAcaoSemCategoria = nomes => (nomes || []).includes(ACAO_SEM_CATEGORIA);
export const NOME_DA_ACAO_SEM_CATEGORIA = ACAO_SEM_CATEGORIA;

// null se deu certo; senão o motivo.
async function executar(acao, args) {
  const r = await pedirStreamerbot({ request: 'DoAction', action: { id: acao.id, name: acao.name }, args });
  return r.status === 'ok' ? null : (r.error || 'falhou');
}

// verbo = enviar, apagar, silenciar, banir ou limpar. Se existir a ação própria da plataforma (por exemplo
// "Painel: Banir Kick", só com a sub-ação nativa), ela vale; senão a Painel: Chat.
export async function executarChat(verbo, args) {
  if (!acoes) return 'Streamer.bot desconectado';
  let acao = null;
  const rotulo = ROTULO_DO_VERBO[verbo];
  if (rotulo && args.plataforma) acao = achar(`Painel: ${rotulo} ${NOME_DA_PLATAFORMA[args.plataforma]}`);
  if (!acao) acao = ACOES_DO_CHAT.map(achar).find(Boolean) || null;
  if (!acao) return `falta a ação “${ACOES_DO_CHAT[0]}” no Streamer.bot (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”)`;
  return executar(acao, { ...args, acao: verbo });
}

// ---- Título e categoria ----

const esperando = new Map(); // plataforma -> resolve do aviso que confirma a mudança

// Chamada pela página com cada evento 'atualizacao' (StreamUpdate da Twitch, ChannelUpdate da Kick).
export function notificarAtualizacao(evento) {
  const resolve = esperando.get(evento.plataforma);
  if (resolve) resolve(evento);
}

function aguardarAtualizacao(plataforma) {
  let temporizador;
  const promessa = new Promise(resolve => {
    temporizador = setTimeout(() => { esperando.delete(plataforma); resolve(null); }, CONFIRMACAO_MS);
    esperando.set(plataforma, evento => { clearTimeout(temporizador); esperando.delete(plataforma); resolve(evento); });
  });
  return { promessa, cancelar() { clearTimeout(temporizador); esperando.delete(plataforma); } };
}

// Na Kick o nome da categoria precisa ser o dela ("Baldur's Gate 3", com apóstrofo): quando uma grafia funciona, o dock a lembra pra próxima vez.
const apelidosDeCategoria = plataforma => ler('apelidosDeCategoria', {})[plataforma] || {};
const apelidoDaCategoria = (plataforma, nome) => apelidosDeCategoria(plataforma)[normalizar(nome)] || '';
function lembrarApelido(plataforma, nome, usado) {
  const todos = ler('apelidosDeCategoria', {});
  gravar('apelidosDeCategoria', { ...todos, [plataforma]: { ...(todos[plataforma] || {}), [normalizar(nome)]: usado } });
}

// O YouTube não avisa o Streamer.bot da mudança (não há evento), então a confirmação vem da própria ação: o código novo de `Painel: YouTube`
// (Painel-YouTube.cs) escreve o resultado numa variável global e o dock o lê. Sem esse código (a ação nativa, só com sub-ações), não há
// resposta, e o texto diz como conseguir o motivo quando o título não muda.
// O YouTube só muda o título de uma transmissão que existe e que o Streamer.bot monitora (a live criada ou no ar). Sem ela não há o que mudar:
// o dock guarda o título (e a categoria) e os aplica sozinho quando a live do YouTube começar (youtubeComecou, chamada pelo App).
let pendenteDoYoutube = ler('youtubePendente', null); // { titulo, categoria } ou null
const ouvintesDoPendente = new Set();
// Tags e descrição do YouTube que ficaram esperando a live abrir: { tags, trocarTags, descricao, trocarDescricao } ou null (youtubeComecou os aplica).
let infoPendenteDoYoutube = ler('youtubeInfoPendente', null);
const ouvintesDaInfo = new Set();
export const aoAplicarInfoPendenteDoYoutube = ouvinte => { ouvintesDaInfo.add(ouvinte); return () => ouvintesDaInfo.delete(ouvinte); };
export const infoPendenteDoYoutubeAgora = () => infoPendenteDoYoutube;
function guardarInfoPendenteDoYoutube(valor) {
  infoPendenteDoYoutube = valor;
  gravar('youtubeInfoPendente', valor);
}
export const aoAplicarPendenteDoYoutube = ouvinte => { ouvintesDoPendente.add(ouvinte); return () => ouvintesDoPendente.delete(ouvinte); };
export const pendenteDoYoutubeAgora = () => pendenteDoYoutube;
function guardarPendenteDoYoutube(valor) {
  pendenteDoYoutube = valor;
  gravar('youtubePendente', valor);
}

// Chamada quando o YouTube avisa que a transmissão começou: se havia um título guardado, tenta aplicá-lo (a monitoração pode levar alguns
// segundos para começar, então tenta de novo até duas vezes) e entrega o resultado a quem estiver ouvindo (o painel Live).
export function youtubeComecou(atrasoMs = 4000, intervaloMs = 8000) {
  if (!pendenteDoYoutube && !infoPendenteDoYoutube) return;
  const tentar = async restantes => {
    const acao = achar(ACAO_DA_LIVE.youtube);
    if (!acao) return;
    let refazer = false;
    if (pendenteDoYoutube) {
      const r = await atualizarYoutube(acao, pendenteDoYoutube.titulo, pendenteDoYoutube.categoria, pendenteDoYoutube.categoriaYoutube);
      if (r.semTransmissao && restantes > 0) refazer = true;
      else ouvintesDoPendente.forEach(f => f(r.nivel === 0 ? { ...r, texto: 'atualizado ao abrir a live' } : r));
    }
    if (infoPendenteDoYoutube) {
      const r = await enviarInfoDoYoutube(acao, infoPendenteDoYoutube);
      if (r.semTransmissao && restantes > 0) refazer = true;
      else ouvintesDaInfo.forEach(f => f(r.nivel === 0 ? { ...r, texto: `${r.texto} ao abrir a live` } : r));
    }
    if (refazer) setTimeout(() => tentar(restantes - 1), intervaloMs);
  };
  setTimeout(() => tentar(2), atrasoMs);
}

// `forcada`: a categoria do YouTube de uma predefinição de live (vazia = as regras das configurações decidem).
async function atualizarYoutube(acao, titulo, categoria, forcada = '') {
  const plataforma = 'youtube';
  const pedido = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  // A categoria do YouTube segue o que a live é (regras nas configurações: "Just Chatting" vira People & Blogs); sem regra, a padrão (Gaming).
  const { youtube } = lerConfig();
  const escolhida = categoriaDoYoutube({ categoria, titulo, regras: youtube.regras });
  const categoriaYoutube = forcada.trim() || escolhida.categoria;
  const regra = Boolean(forcada.trim()) || escolhida.regra;
  const erro = await executar(acao, { tituloLive: titulo, categoriaLive: categoria, categoriaYoutube, pedido });
  if (erro) return { plataforma, nivel: 2, categoriaOk: true, texto: `recusou o pedido (${curto(erro, 30)})` };
  // O código novo da ação espera um instante antes da categoria e tenta de novo uma vez, então a resposta pode levar uns 5 s.
  const r = await aguardarLeitura(() => pedirStreamerbot({ request: 'GetGlobal', variable: VARIAVEL_DO_YOUTUBE, persisted: false }), pedido, { limiteMs: 8000, interpretar: respostaDoYoutube });
  if (!r) {
    return { plataforma, nivel: 1, categoriaOk: true, texto: 'enviado (sem confirmação)' };
  }
  if (!r.ok && r.semTransmissao) {
    guardarPendenteDoYoutube({ titulo, categoria, categoriaYoutube: forcada });
    return { plataforma, nivel: 1, categoriaOk: true, semTransmissao: true, texto: 'sem live aberta (aplico ao abrir)' };
  }
  if (!r.ok) return { plataforma, nivel: 2, categoriaOk: true, texto: curto(r.erro) || 'não aceitou' };
  guardarPendenteDoYoutube(null);
  // Quando uma regra escolheu a categoria, o resultado diz qual (a padrão não precisa: é a de sempre).
  return { plataforma, nivel: r.avisos ? 1 : 0, categoriaOk: true, texto: r.avisos ? 'título ok, categoria recusada' : regra && categoriaYoutube ? `atualizado (${curto(categoriaYoutube, 24)})` : 'atualizado' };
}

// ---- Tags e descrição do YouTube (painel Tags, quando ligado nas configurações) ----
// A mesma ação `Painel: YouTube` (Painel-YouTube.cs, versão 2): `acao: 'ler'` devolve o que a transmissão tem; sem ela, `tagsAcao` (definir ou limpar) e
// `descricaoDefinir` mexem só no que foi pedido. O YouTube só muda uma transmissão que existe e que o Streamer.bot monitora: sem ela, o pedido fica guardado e é
// aplicado quando a live abrir (como o título).
const pedidoNovo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const FALTA_ACAO_DO_YOUTUBE = `falta a ação “${ACAO_DA_LIVE.youtube}” (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”)`;
const CODIGO_ANTIGO_DO_YOUTUBE = 'atualize o código da ação Painel: YouTube (Painel-YouTube.cs): o atual não mexe em tags nem em descrição';

// Lê as tags e a descrição que a transmissão do YouTube tem agora. Devolve { ok, tags, descricao, titulo, categoria } ou { ok: false, erro, semTransmissao? }.
export async function lerInfoDoYoutube() {
  const acao = achar(ACAO_DA_LIVE.youtube);
  if (!acao) return { ok: false, erro: FALTA_ACAO_DO_YOUTUBE };
  const pedido = pedidoNovo();
  const erro = await executar(acao, { acao: 'ler', pedido });
  if (erro) return { ok: false, erro: `recusou o pedido (${curto(erro, 30)})` };
  const r = await aguardarLeitura(() => pedirStreamerbot({ request: 'GetGlobal', variable: VARIAVEL_DO_YOUTUBE, persisted: false }), pedido, { limiteMs: 3000, interpretar: respostaDoYoutube });
  if (!r) return { ok: false, erro: 'sem resposta da ação (cole o código novo de Painel-YouTube.cs no Streamer.bot)' };
  if (!r.ok && r.semTransmissao) return { ok: false, semTransmissao: true, erro: 'sem live do YouTube aberta' };
  if (!r.ok) return { ok: false, erro: curto(r.erro) || 'não aceitou' };
  if (r.versao < 2) return { ok: false, erro: CODIGO_ANTIGO_DO_YOUTUBE };
  return { ok: true, tags: r.tags, descricao: r.descricao, titulo: r.titulo, categoria: r.categoria, categoriaId: r.categoriaId };
}

// Manda o que mudou (info: { tags, trocarTags, descricao, trocarDescricao }, já limpo). Devolve { plataforma, nivel, texto, semTransmissao? }.
async function enviarInfoDoYoutube(acao, info) {
  const plataforma = 'youtube';
  const args = { pedido: pedidoNovo(), tituloLive: '', categoriaYoutube: '' };
  if (info.trocarDescricao) { args.descricaoDefinir = 'true'; args.descricaoLive = info.descricao; }
  if (info.trocarTags) { args.tagsAcao = info.tags.length ? 'definir' : 'limpar'; args.tagsYoutube = info.tags.join('|'); }
  const erro = await executar(acao, args);
  if (erro) return { plataforma, nivel: 2, texto: `recusou o pedido (${curto(erro, 30)})` };
  const r = await aguardarLeitura(() => pedirStreamerbot({ request: 'GetGlobal', variable: VARIAVEL_DO_YOUTUBE, persisted: false }), args.pedido, { limiteMs: 4000, interpretar: respostaDoYoutube });
  if (!r) return { plataforma, nivel: 1, texto: 'enviado (sem confirmação)' };
  if (!r.ok && r.semTransmissao) {
    guardarInfoPendenteDoYoutube(info);
    return { plataforma, nivel: 1, semTransmissao: true, texto: 'sem live aberta (aplico ao abrir)' };
  }
  if (!r.ok) return { plataforma, nivel: 2, texto: curto(r.erro) || 'não aceitou' };
  if (r.versao < 2) return { plataforma, nivel: 2, texto: CODIGO_ANTIGO_DO_YOUTUBE };
  guardarInfoPendenteDoYoutube(null);
  const recusadas = [info.trocarTags && !r.tagsOk && 'tags', info.trocarDescricao && !r.descricaoOk && 'descrição'].filter(Boolean);
  if (recusadas.length) return { plataforma, nivel: 2, texto: `${recusadas.join(' e ')} recusada${recusadas.length > 1 || recusadas[0] === 'tags' ? 's' : ''}` };
  if (info.trocarTags && info.tags.length === 0 && !info.trocarDescricao) return { plataforma, nivel: 0, texto: 'tags removidas' };
  const feitas = [info.trocarTags && 'tags', info.trocarDescricao && 'descrição'].filter(Boolean);
  const plural = feitas.length > 1 || feitas[0] === 'tags';
  // Código versão 3: a ação relê a transmissão depois de aplicar. Se ela ainda mostra o valor antigo, o pedido foi aceito mas não dá para ter certeza (a cópia que o Streamer.bot guarda pode estar velha).
  const naoConfere = [info.trocarTags && r.tagsConferem === false && 'tags', info.trocarDescricao && r.descricaoConfere === false && 'descrição'].filter(Boolean);
  if (naoConfere.length) return { plataforma, nivel: 1, texto: `${feitas.join(' e ')} enviada${plural ? 's' : ''}, mas a transmissão ainda mostra ${naoConfere.length > 1 ? 'os valores antigos' : naoConfere[0] === 'tags' ? 'as tags antigas' : 'a descrição antiga'}: confira no YouTube Studio` };
  return { plataforma, nivel: 0, texto: `${feitas.join(' e ')} atualizada${plural ? 's' : ''}` };
}

// Aplica as tags e a descrição (do que a pessoa escreveu no painel Tags). `trocarTags` e `trocarDescricao` dizem o que mudou de verdade. O texto passa pelas
// regras do YouTube (sem < nem >, até 500 letras de tags e 5000 de descrição) e o resultado avisa quando foi ajustado.
export async function aplicarInfoDoYoutube({ tags, trocarTags, descricao, trocarDescricao }) {
  const acao = achar(ACAO_DA_LIVE.youtube);
  if (!acao) return { plataforma: 'youtube', nivel: 2, texto: FALTA_ACAO_DO_YOUTUBE };
  const t = tagsDoYoutube(tags);
  const d = descricaoDoYoutube(descricao);
  const r = await enviarInfoDoYoutube(acao, { tags: t.tags, trocarTags, descricao: d.texto, trocarDescricao });
  const ajustes = [...(trocarTags ? t.ajustes : []), ...(trocarDescricao ? d.ajustes : [])];
  if (r.nivel < 2 && ajustes.length) return { ...r, nivel: Math.max(r.nivel, 1), texto: `${r.texto} (texto ajustado)`, ajustes };
  return { ...r, ajustes };
}

// Corta o motivo que o Streamer.bot manda (pode ser longo) para caber numa linha curta do resultado.
export const curto = (t, max = 40) => {
  const s = String(t || '').split('(')[0].trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

// Uma tentativa de mudar título e categoria numa plataforma. Devolve { plataforma, nivel, texto, categoriaFeita, categoriaOk }. Os textos são curtos
// de propósito (uma linha no resultado do painel Live).
async function tentarAtualizar(plataforma, acao, titulo, categoria, categoriaYoutube = '') {
  const querTitulo = Boolean(titulo);
  const querCategoria = Boolean(categoria) && plataforma !== 'youtube';
  if (plataforma === 'youtube') return atualizarYoutube(acao, titulo, categoria, categoriaYoutube);
  const confirmacao = aguardarAtualizacao(plataforma);
  const erro = await executar(acao, { tituloLive: titulo, categoriaLive: categoria });
  if (erro) {
    confirmacao.cancelar();
    return { plataforma, nivel: 2, categoriaOk: false, texto: `recusou o pedido (${curto(erro, 30)})` };
  }

  const feito = await confirmacao.promessa;
  if (!feito) {
    // Nenhum aviso chegou: a Kick nunca confirma e a Twitch pode não avisar se nada mudou. O pedido foi aceito, então vale como feito, só sem
    // confirmação (amarelo) — e não há por que tentar outra grafia da categoria, que só vale quando a plataforma responde com outra.
    return { plataforma, nivel: 1, categoriaOk: true, texto: plataforma === 'kick' ? 'alterado (sem confirmação)' : 'enviado (sem confirmação)' };
  }
  // O evento da plataforma às vezes vem sem o título ou a categoria: vazio é "não informado", não "ficou diferente".
  const partes = [];
  let categoriaOk = true;
  if (querTitulo && feito.titulo && normalizar(feito.titulo) !== normalizar(titulo)) partes.push({ nivel: 1, texto: 'título ajustado' });
  if (querCategoria && feito.categoria && normalizar(feito.categoria) !== normalizar(categoria)) {
    categoriaOk = false;
    partes.push({ nivel: 1, texto: `categoria ficou “${feito.categoria}”` });
  }
  if (partes.length === 0) partes.push({ nivel: 0, texto: 'atualizado' });
  return { plataforma, categoriaFeita: feito.categoria, categoriaOk, nivel: Math.max(...partes.map(p => p.nivel)), texto: partes.map(p => p.texto).join(' · ') };
}

// Atualiza título e categoria numa plataforma. Devolve { plataforma, nivel, texto, categoriaFeita }: nivel 0 = ok, 1 = aviso (ficou diferente do
// digitado ou sem confirmação), 2 = erro, sempre com um texto curto. O YouTube só muda o título, sem < nem > (ele os recusa) e com até 100
// caracteres. Na Kick, se ela responder com outra categoria, o dock tenta outras grafias (apóstrofo) e lembra a que funcionou.
// `categoriaYoutube` (opcional): a categoria do YouTube de uma predefinição de live; vazia, as regras das configurações decidem.
export async function atualizarLive(plataforma, titulo, categoria, categoriaYoutube = '') {
  const nomeDaAcao = ACAO_DA_LIVE[plataforma];
  const acao = achar(nomeDaAcao);
  if (!acao) return { plataforma, nivel: 2, texto: `falta a ação “${nomeDaAcao}”` };

  let tituloEnviado = titulo;
  let ajustes = [];
  if (plataforma === 'youtube' && titulo) ({ texto: tituloEnviado, ajustes } = tituloDoYoutube(titulo));
  const querTitulo = Boolean(tituloEnviado);
  const querCategoria = Boolean(categoria) && plataforma !== 'youtube';
  if (!querTitulo && !querCategoria) {
    return { plataforma, nivel: 1, texto: plataforma === 'youtube' ? 'preencha o título' : 'preencha título ou categoria' };
  }

  const nomes = plataforma === 'kick' && querCategoria
    ? [...new Set([apelidoDaCategoria('kick', categoria) || categoria, categoria, ...variantesDeCategoria(categoria)])]
    : [categoria];
  let r = null;
  const tentadas = [];
  for (const nome of nomes) {
    r = await tentarAtualizar(plataforma, acao, tituloEnviado, nome, categoriaYoutube);
    tentadas.push(nome);
    if (r.categoriaOk || r.nivel === 2) break;
  }
  if (plataforma === 'kick' && querCategoria && r.categoriaOk && tentadas.length > 1) {
    const usado = tentadas[tentadas.length - 1];
    lembrarApelido('kick', categoria, usado);
    r = { ...r, texto: r.nivel === 0 ? `atualizado (grafia “${usado}”)` : `${r.texto} (grafia “${usado}”)` };
  } else if (plataforma === 'kick' && tentadas.length > 1 && !r.categoriaOk && r.nivel < 2) {
    r = { ...r, texto: `${r.texto} (tentei outras grafias)` };
  }
  if (ajustes.length > 0) r = { ...r, nivel: Math.max(r.nivel, 1), texto: r.nivel === 0 ? 'atualizado (título ajustado)' : `${r.texto} · título ajustado` };
  return r;
}

// Tira a categoria do canal na Twitch pela ação opcional `Painel: Sem Categoria` (Painel-SemCategoria.cs). null se o Streamer.bot
// aceitou o pedido; ele não diz se a Twitch concordou.
export async function tirarCategoriaDaTwitch() {
  const acao = achar(ACAO_SEM_CATEGORIA);
  if (!acao) return `falta a ação “${ACAO_SEM_CATEGORIA}”`;
  return executar(acao, {});
}

// ---- Controles da Twitch (modos do chat e clipe) ----

// Um pedido à ação `Painel: Controles` (acao = modo_chat ou clipe): a ação escreve o resultado numa variável global, junto do `pedido`, e o dock o lê.
// Devolve { nivel, texto, url? } no formato dos outros resultados; sem resposta em 4 s o pedido vale como enviado, sem confirmação (amarelo).
async function pedirControle(args) {
  const acao = achar(ACAO_CONTROLES);
  if (!acao) return { nivel: 2, texto: `falta a ação “${ACAO_CONTROLES}” (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”)` };
  const pedido = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const erro = await executar(acao, { ...args, pedido });
  if (erro) return { nivel: 2, texto: `recusou o pedido (${curto(erro, 30)})` };
  const r = await aguardarLeitura(() => pedirStreamerbot({ request: 'GetGlobal', variable: VARIAVEL_DOS_CONTROLES, persisted: false }), pedido, { limiteMs: 4000, interpretar: respostaDosControles });
  if (!r) return { nivel: 1, texto: 'enviado (sem confirmação)' };
  if (!r.ok) return { nivel: 2, texto: curto(r.erro) || 'não aceitou' };
  return { nivel: 0, texto: 'ok', url: r.url, versao: r.versao, perfil: r.perfil };
}

// A ação `Painel: Controles` existe agora? (o ChatPanel não recebe a lista de ações)
export const temControlesAgora = () => Boolean(achar(ACAO_CONTROLES));

// Cumpre ou reembolsa um resgate de pontos da Twitch que está na fila (aba Resgates). Devolve { nivel, texto }.
export async function decidirResgate({ rewardId, redemptionId, decisao }) {
  const r = await pedirControle({ acao: 'resgate', decisao, rewardId, redemptionId });
  if (r.nivel === 0 && r.versao < 2) return { nivel: 2, texto: 'atualize o código da ação Painel: Controles (Painel-Controles.cs)' };
  return r.nivel === 0 ? { ...r, texto: decisao === 'cumprir' ? 'cumprido' : 'reembolsado' } : r;
}

// Responde a uma mensagem do chat: resposta de verdade na Twitch e na Kick; no YouTube, que não tem, a mensagem sai com @nome. Devolve { nivel, texto }.
export async function responderMensagem({ plataforma, mensagemId, mensagem, usuario }) {
  const r = await pedirControle({ acao: 'responder', plataforma, mensagemId: String(mensagemId || ''), mensagem, usuario: String(usuario || '') });
  if (r.nivel === 0 && r.versao < 2) return { nivel: 2, texto: 'atualize o código da ação Painel: Controles (Painel-Controles.cs)' };
  return r.nivel === 0 ? { ...r, texto: 'resposta enviada' } : r;
}

// O perfil de quem escreve na Twitch (idade da conta, se segue, se é sub, mod ou VIP...). Devolve { nivel, texto, perfil }.
export async function perfilDaTwitch(usuarioId) {
  const r = await pedirControle({ acao: 'perfil_twitch', usuarioId: String(usuarioId || '') });
  if (r.nivel === 0 && r.versao < 2) return { nivel: 2, texto: 'atualize o código da ação Painel: Controles (Painel-Controles.cs)' };
  if (r.nivel === 0 && !r.perfil) return { nivel: 2, texto: 'a Twitch não devolveu o perfil' };
  return r;
}

// Em que versão está o código de uma ação (Painel: Controles e Painel: YouTube), para a verificação da configuração. Devolve { achou, versao, erro? }: `achou` é
// falso se a ação não existe ou não respondeu.
export async function versaoDoCodigoDosControles() {
  if (!achar(ACAO_CONTROLES)) return { achou: false, versao: 0 };
  const r = await pedirControle({ acao: 'ping' });
  return r.nivel === 2 || r.nivel === 1 && !r.versao ? { achou: false, versao: 0, erro: r.texto } : { achou: true, versao: r.versao || 1 };
}
export async function versaoDoCodigoDoYoutube() {
  const acao = achar(ACAO_DA_LIVE.youtube);
  if (!acao) return { achou: false, versao: 0 };
  const pedido = pedidoNovo();
  const erro = await executar(acao, { acao: 'ler', pedido });
  if (erro) return { achou: false, versao: 0, erro };
  const r = await aguardarLeitura(() => pedirStreamerbot({ request: 'GetGlobal', variable: VARIAVEL_DO_YOUTUBE, persisted: false }), pedido, { limiteMs: 3000, interpretar: respostaDoYoutube });
  return r ? { achou: true, versao: r.versao } : { achou: false, versao: 0, erro: 'sem resposta' };
}

// Os modos do chat da Twitch (o Streamer.bot não tem estes controles na Kick nem no YouTube).
export const MODOS_DO_CHAT = [
  { id: 'emotes', rotulo: 'Só emotes', dica: 'Só emotes: o chat só aceita emotes' },
  { id: 'lento', rotulo: 'Modo lento', dica: 'Modo lento: cada pessoa espera alguns segundos entre as mensagens' },
  { id: 'seguidores', rotulo: 'Só seguidores', dica: 'Só seguidores: só quem segue o canal escreve' },
  { id: 'inscritos', rotulo: 'Só inscritos', dica: 'Só inscritos: só quem é sub escreve' },
];

// Liga ou desliga um modo. `segundos` vale para o modo lento (3 a 120) e `minutos` para só seguidores (0 = todos os seguidores).
export async function definirModoDoChat(modo, ligar, { segundos = 30, minutos = 0 } = {}) {
  const r = await pedirControle({ acao: 'modo_chat', modo, ligar: ligar ? 'true' : 'false', segundos: String(segundos), minutos: String(minutos) });
  return r.nivel === 0 ? { ...r, texto: ligar ? 'ligado' : 'desligado' } : r;
}

// Cria um clipe da live da Twitch (título vazio = o título da live). Devolve { nivel, texto, url? }.
export async function criarClipe({ titulo = '', duracao = 30 } = {}) {
  const r = await pedirControle({ acao: 'clipe', titulo, duracao: String(duracao) });
  return r.nivel === 0 ? { ...r, texto: 'clipe criado' } : r;
}

// ---- Tags (#) e momentos ----

// Troca as tags da Twitch pela lista (já limpa por limparTags); lista vazia tira todas. Mesmo formato de resultado de
// atualizarLive.
export async function definirTags(tags) {
  const acao = achar(ACAO_TAGS);
  if (!acao) return { plataforma: 'twitch', nivel: 2, texto: `falta a ação “${ACAO_TAGS}” (o nome precisa ser exatamente igual)` };
  const erro = await executar(acao, { acao: tags.length ? 'definir' : 'limpar', tagsLive: tags.join('|') });
  if (erro) return { plataforma: 'twitch', nivel: 2, texto: erro };
  return { plataforma: 'twitch', nivel: 0, texto: tags.length ? `tags enviadas (${tags.length})` : 'tags removidas' };
}

// Lê o que o canal tem agora: as tags, o título e a categoria da Twitch (e, de reserva, os do YouTube) e se a conta é afiliada. A ação
// `Painel: Tags` (acao = ler) anota tudo na variável global VARIAVEL_DE_TAGS, junto do `pedido`, e o dock a lê pelo WebSocket. A resposta
// fica única: os dois painéis que a pedem (Tags e Live) no mesmo instante dividem uma só leitura, porque a variável é uma só e a segunda
// ação apagaria a resposta da primeira. Devolve { ok, tags, erro, titulo, categoria, afiliado, parceiro, youtube }.
const ESQUECER_LEITURA_MS = 4000;
let leituraDoCanal = null; // { promessa, quando }
export function lerCanal() {
  if (leituraDoCanal && Date.now() - leituraDoCanal.quando < ESQUECER_LEITURA_MS) return leituraDoCanal.promessa;
  const promessa = (async () => {
    const acao = achar(ACAO_TAGS);
    if (!acao) return { ok: false, tags: [], erro: `falta a ação “${ACAO_TAGS}” (o nome precisa ser exatamente igual)` };
    const pedido = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const erro = await executar(acao, { acao: 'ler', pedido });
    if (erro) return { ok: false, tags: [], erro };
    const leitura = await aguardarLeitura(() => pedirStreamerbot({ request: 'GetGlobal', variable: VARIAVEL_DE_TAGS, persisted: false }), pedido);
    return leitura || { ok: false, tags: [], erro: 'sem resposta da ação (cole o código novo de Painel-Tags.cs no Streamer.bot)' };
  })();
  leituraDoCanal = { promessa, quando: Date.now() };
  promessa.then(r => {
    if (r.ok) ultimaLeituraDoCanal = r;
    else if (leituraDoCanal && leituraDoCanal.promessa === promessa) leituraDoCanal = null;
  });
  return promessa;
}
export const lerTags = lerCanal;
// A última leitura do canal que deu certo (ou null): as configurações a usam pra dizer se a conta da Twitch tem resgates de pontos.
let ultimaLeituraDoCanal = null;
export const canalLido = () => ultimaLeituraDoCanal;

// Pede à Twitch que adie o próximo anúncio em 5 minutos, pela ação `Painel: Anuncio` (só tem a sub-ação Twitch > Ads > Snooze Next
// Ad, sem argumentos). null se o pedido foi aceito pelo Streamer.bot, que não diz se a Twitch concordou (acabaram os adiamentos, por
// exemplo): quem mostra o resultado é o próximo aviso de anúncio.
export async function adiarAnuncio() {
  const acao = achar(ACAO_ANUNCIO);
  if (!acao) return `falta a ação “${ACAO_ANUNCIO}” no Streamer.bot (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Painel: Anuncio”)`;
  return executar(acao, {});
}

// Pede ao Streamer.bot que acrescente a linha no arquivo de clipes (args: linha, arquivo, pasta). null se deu certo.
export async function registrarMomento(args) {
  const acao = achar(ACAO_MOMENTOS);
  if (!acao) return `falta a ação “${ACAO_MOMENTOS}” no Streamer.bot (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”)`;
  return executar(acao, args);
}
