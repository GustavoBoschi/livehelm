// Conversa do Dock com o Streamer.bot: as ações do Painel (título e categoria, chat e moderação) por DoAction. Os
// nomes das ações e os argumentos (acao, plataforma, usuario...) são os da ação `Painel: Chat` (código em
// acoes-streamerbot/Painel-Chat.cs): mudou lá, mude aqui.
import { pedirStreamerbot } from './streamerbot.js';
import { aguardarLeitura } from './tagsLista.js';

export const PLATAFORMAS_DO_DOCK = ['twitch', 'kick', 'youtube'];
export const NOME_DA_PLATAFORMA = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };
const ACAO_DA_LIVE = { twitch: 'Painel: Twitch', kick: 'Painel: Kick', youtube: 'Painel: YouTube' };
// A ação que envia, apaga, silencia e bane; o primeiro nome que existir vale.
export const ACOES_DO_CHAT = ['Painel: Chat', 'Painel: Enviar mensagem'];
const ROTULO_DO_VERBO = { enviar: 'Enviar', silenciar: 'Silenciar', banir: 'Banir' };
const ACAO_TAGS = 'Painel: Tags';
const VARIAVEL_DE_TAGS = 'painelTags'; // global não persistente que a Painel: Tags escreve ao ler as tags do canal
const ACAO_MOMENTOS = 'Painel: Momentos';
const CONFIRMACAO_MS = 7000; // quanto esperar o aviso que confirma o título e a categoria

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
  if (!acao) return `falta a ação “${ACOES_DO_CHAT[0]}” no Streamer.bot (README.md, “Ações no Streamer.bot”)`;
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

// Atualiza título e categoria numa plataforma. Devolve { plataforma, nivel, texto, categoriaFeita }: nivel 0 = ok,
// 1 = aviso (ficou diferente do digitado ou sem confirmação), 2 = erro. O YouTube só muda o título.
export async function atualizarLive(plataforma, titulo, categoria) {
  const nomeDaAcao = ACAO_DA_LIVE[plataforma];
  const acao = achar(nomeDaAcao);
  if (!acao) return { plataforma, nivel: 2, texto: `falta a ação “${nomeDaAcao}”` };

  const confirmacao = plataforma === 'youtube' ? null : aguardarAtualizacao(plataforma);
  const erro = await executar(acao, { tituloLive: titulo, categoriaLive: categoria });
  if (erro) {
    if (confirmacao) confirmacao.cancelar();
    return { plataforma, nivel: 2, texto: erro };
  }
  if (!confirmacao) return { plataforma, nivel: 0, texto: 'título enviado' };

  const feito = await confirmacao.promessa;
  if (!feito) return { plataforma, nivel: 1, texto: 'enviado, sem confirmação (a categoria pode não existir ou já estava assim)' };
  const base = { plataforma, categoriaFeita: feito.categoria };
  if (categoria && normalizar(feito.categoria) !== normalizar(categoria)) return { ...base, nivel: 1, texto: `categoria ficou “${feito.categoria}”` };
  if (titulo && normalizar(feito.titulo) !== normalizar(titulo)) return { ...base, nivel: 1, texto: `título ficou “${feito.titulo}”` };
  return { ...base, nivel: 0, texto: feito.categoria || 'ok' };
}

// ---- Tags (#) e momentos ----

// Troca as tags da Twitch pela lista (já limpa por limparTags); lista vazia tira todas. Mesmo formato de resultado de
// atualizarLive.
export async function definirTags(tags) {
  const acao = achar(ACAO_TAGS);
  if (!acao) return { plataforma: 'twitch', nivel: 2, texto: `falta a ação “${ACAO_TAGS}”` };
  const erro = await executar(acao, { acao: tags.length ? 'definir' : 'limpar', tagsLive: tags.join('|') });
  if (erro) return { plataforma: 'twitch', nivel: 2, texto: erro };
  return { plataforma: 'twitch', nivel: 0, texto: tags.length ? `tags enviadas (${tags.length})` : 'tags removidas' };
}

// Lê as tags que o canal tem agora na Twitch. A ação `Painel: Tags` (acao = ler) as anota na variável global
// VARIAVEL_DE_TAGS, junto do `pedido`, e o dock a lê pelo WebSocket. Devolve { ok, tags, erro }.
export async function lerTags() {
  const acao = achar(ACAO_TAGS);
  if (!acao) return { ok: false, tags: [], erro: `falta a ação “${ACAO_TAGS}”` };
  const pedido = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const erro = await executar(acao, { acao: 'ler', pedido });
  if (erro) return { ok: false, tags: [], erro };
  const leitura = await aguardarLeitura(() => pedirStreamerbot({ request: 'GetGlobal', variable: VARIAVEL_DE_TAGS, persisted: false }), pedido);
  return leitura || { ok: false, tags: [], erro: 'sem resposta da ação (cole o código novo de Painel-Tags.cs no Streamer.bot)' };
}

// Pede ao Streamer.bot que acrescente a linha no arquivo de clipes (args: linha, arquivo, pasta). null se deu certo.
export async function registrarMomento(args) {
  const acao = achar(ACAO_MOMENTOS);
  if (!acao) return `falta a ação “${ACAO_MOMENTOS}” no Streamer.bot (README.md, “Ações no Streamer.bot”)`;
  return executar(acao, args);
}
