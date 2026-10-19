// Conversa do Dock com o Streamer.bot: as ações do Painel (título e categoria, chat e moderação) por DoAction. Os
// nomes das ações e os argumentos (acao, plataforma, usuario...) são os da ação `Painel: Chat` (código em
// acoes-streamerbot/Painel-Chat.cs): mudou lá, mude aqui.
import { pedirStreamerbot } from './streamerbot.js';
import { aguardarLeitura, respostaDoYoutube } from './tagsLista.js';
import { lerConfig } from './configuracoes.js';
import { tituloDoYoutube, variantesDeCategoria } from './titulos.js';
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
export const temAcaoDeAnuncio = nomes => (nomes || []).includes(ACAO_ANUNCIO);
export const NOME_DA_ACAO_DE_ANUNCIO = ACAO_ANUNCIO;
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
export const aoAplicarPendenteDoYoutube = ouvinte => { ouvintesDoPendente.add(ouvinte); return () => ouvintesDoPendente.delete(ouvinte); };
export const pendenteDoYoutubeAgora = () => pendenteDoYoutube;
function guardarPendenteDoYoutube(valor) {
  pendenteDoYoutube = valor;
  gravar('youtubePendente', valor);
}

// Chamada quando o YouTube avisa que a transmissão começou: se havia um título guardado, tenta aplicá-lo (a monitoração pode levar alguns
// segundos para começar, então tenta de novo até duas vezes) e entrega o resultado a quem estiver ouvindo (o painel Live).
export function youtubeComecou(atrasoMs = 4000, intervaloMs = 8000) {
  if (!pendenteDoYoutube) return;
  const tentar = async restantes => {
    const acao = achar(ACAO_DA_LIVE.youtube);
    if (!acao || !pendenteDoYoutube) return;
    const r = await atualizarYoutube(acao, pendenteDoYoutube.titulo, pendenteDoYoutube.categoria);
    if (r.semTransmissao && restantes > 0) { setTimeout(() => tentar(restantes - 1), intervaloMs); return; }
    const resultado = r.nivel === 0 ? { ...r, texto: `a live do YouTube começou: ${r.texto}` } : r;
    ouvintesDoPendente.forEach(f => f(resultado));
  };
  setTimeout(() => tentar(2), atrasoMs);
}

async function atualizarYoutube(acao, titulo, categoria) {
  const plataforma = 'youtube';
  const pedido = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const erro = await executar(acao, { tituloLive: titulo, categoriaLive: categoria, categoriaYoutube: lerConfig().youtube.categoria.trim(), pedido });
  if (erro) return { plataforma, nivel: 2, categoriaOk: true, texto: `o Streamer.bot recusou o pedido (${erro}). Confira se a ação “${ACAO_DA_LIVE.youtube}” está ativa e se o YouTube está conectado nele` };
  const r = await aguardarLeitura(() => pedirStreamerbot({ request: 'GetGlobal', variable: VARIAVEL_DO_YOUTUBE, persisted: false }), pedido, { limiteMs: 4000, interpretar: respostaDoYoutube });
  if (!r) {
    return { plataforma, nivel: 1, categoriaOk: true, texto: 'título enviado, mas o YouTube não confirmou: se ele não mudar, cole o código de Painel-YouTube.cs na ação “Painel: YouTube” (ele mostra o motivo aqui e nos logs do Streamer.bot)' };
  }
  if (!r.ok && r.semTransmissao) {
    guardarPendenteDoYoutube({ titulo, categoria });
    return { plataforma, nivel: 1, categoriaOk: true, semTransmissao: true, texto: 'o YouTube ainda não tem uma transmissão que o Streamer.bot monitore (crie ou agende a live no YouTube Studio): guardei o título e aplico quando a live do YouTube começar' };
  }
  if (!r.ok) return { plataforma, nivel: 2, categoriaOk: true, texto: r.erro || 'o YouTube não aceitou a mudança' };
  guardarPendenteDoYoutube(null);
  const partes = [titulo ? 'título atualizado' : 'nada para mudar no título'];
  if (r.categoria) partes.push(`categoria: ${r.categoria}`);
  if (r.avisos) partes.push(r.avisos);
  return { plataforma, nivel: r.avisos ? 1 : 0, categoriaOk: true, texto: partes.join(' · ') };
}

// Uma tentativa de mudar título e categoria numa plataforma. Devolve { plataforma, nivel, texto, categoriaFeita, categoriaOk }.
async function tentarAtualizar(plataforma, acao, titulo, categoria) {
  const nomeDaAcao = ACAO_DA_LIVE[plataforma];
  const querTitulo = Boolean(titulo);
  const querCategoria = Boolean(categoria) && plataforma !== 'youtube';
  if (plataforma === 'youtube') return atualizarYoutube(acao, titulo, categoria);
  const confirmacao = aguardarAtualizacao(plataforma);
  const erro = await executar(acao, { tituloLive: titulo, categoriaLive: categoria });
  if (erro) {
    if (confirmacao) confirmacao.cancelar();
    return { plataforma, nivel: 2, categoriaOk: false, texto: `o Streamer.bot recusou o pedido (${erro}). Confira se a ação “${nomeDaAcao}” está ativa e se a ${NOME_DA_PLATAFORMA[plataforma]} está conectada nele` };
  }

  const feito = await confirmacao.promessa;
  if (!feito) {
    const enviados = [querTitulo && 'título', querCategoria && 'categoria'].filter(Boolean).join(' e ');
    return { plataforma, nivel: 1, categoriaOk: false, texto: `${enviados} enviado${querTitulo && querCategoria ? 's' : ''}, mas a ${NOME_DA_PLATAFORMA[plataforma]} não confirmou em ${CONFIRMACAO_MS / 1000} s: a categoria pode não existir, o valor já podia estar igual ou a ação do Streamer.bot falhou` };
  }
  // O evento da plataforma às vezes vem sem o título ou a categoria: vazio é "não informado", não "ficou diferente".
  const partes = [];
  let categoriaOk = true;
  if (querTitulo) {
    if (!feito.titulo) partes.push({ nivel: 1, texto: 'título enviado (a plataforma não informou o que ficou)' });
    else if (normalizar(feito.titulo) === normalizar(titulo)) partes.push({ nivel: 0, texto: 'título atualizado' });
    else partes.push({ nivel: 1, texto: `título ficou “${feito.titulo}” (você pediu “${titulo}”: a plataforma ajustou o texto)` });
  }
  if (querCategoria) {
    if (!feito.categoria) { categoriaOk = false; partes.push({ nivel: 1, texto: 'categoria enviada (a plataforma não informou qual ficou)' }); }
    else if (normalizar(feito.categoria) === normalizar(categoria)) partes.push({ nivel: 0, texto: `categoria atualizada: ${feito.categoria}` });
    else { categoriaOk = false; partes.push({ nivel: 1, texto: `categoria ficou “${feito.categoria}” (você pediu “${categoria}”: ela não foi achada e a plataforma escolheu outra)` }); }
  }
  return { plataforma, categoriaFeita: feito.categoria, categoriaOk, nivel: Math.max(...partes.map(p => p.nivel)), texto: partes.map(p => p.texto).join(' · ') };
}

// Atualiza título e categoria numa plataforma. Devolve { plataforma, nivel, texto, categoriaFeita }: nivel 0 = ok, 1 = aviso (ficou
// diferente do digitado ou sem confirmação), 2 = erro. O texto diz o que aconteceu com cada um dos dois (título e categoria) e, se algo
// não saiu como pedido, o motivo provável. O YouTube só muda o título, sem < nem > (ele os recusa) e com até 100 caracteres: o que o dock
// ajusta vai no texto. Na Kick, se a categoria não for aceita, o dock tenta outras grafias (apóstrofo) e lembra a que funcionou.
export async function atualizarLive(plataforma, titulo, categoria) {
  const nomeDaAcao = ACAO_DA_LIVE[plataforma];
  const acao = achar(nomeDaAcao);
  if (!acao) return { plataforma, nivel: 2, texto: `falta a ação “${nomeDaAcao}” no Streamer.bot (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”)` };

  let tituloEnviado = titulo;
  let ajustes = [];
  if (plataforma === 'youtube' && titulo) ({ texto: tituloEnviado, ajustes } = tituloDoYoutube(titulo));
  const querTitulo = Boolean(tituloEnviado);
  const querCategoria = Boolean(categoria) && plataforma !== 'youtube';
  if (!querTitulo && !querCategoria) {
    return { plataforma, nivel: 1, texto: plataforma === 'youtube' ? 'nada enviado: preencha o título (o YouTube só muda o título)' : 'nada enviado: preencha o título e/ou a categoria' };
  }

  const nomes = plataforma === 'kick' && querCategoria
    ? [...new Set([apelidoDaCategoria('kick', categoria) || categoria, categoria, ...variantesDeCategoria(categoria)])]
    : [categoria];
  let r = null;
  const tentadas = [];
  for (const nome of nomes) {
    r = await tentarAtualizar(plataforma, acao, tituloEnviado, nome);
    tentadas.push(nome);
    if (r.categoriaOk || r.nivel === 2) break;
  }
  if (plataforma === 'kick' && querCategoria && r.categoriaOk && tentadas.length > 1) {
    const usado = tentadas[tentadas.length - 1];
    lembrarApelido('kick', categoria, usado);
    r = { ...r, texto: `${r.texto} (a Kick só aceitou “${usado}”; vou usar essa grafia daqui pra frente)` };
  } else if (plataforma === 'kick' && tentadas.length > 1 && !r.categoriaOk && r.nivel < 2) {
    r = { ...r, texto: `${r.texto} (tentei também: ${tentadas.slice(1).map(n => `“${n}”`).join(', ')})` };
  }
  if (ajustes.length > 0) r = { ...r, nivel: Math.max(r.nivel, 1), texto: `${r.texto} · ajustei o título para o YouTube: ${ajustes.join('; ')}` };
  return r;
}

// Tira a categoria do canal na Twitch pela ação opcional `Painel: Sem Categoria` (Painel-SemCategoria.cs). null se o Streamer.bot
// aceitou o pedido; ele não diz se a Twitch concordou.
export async function tirarCategoriaDaTwitch() {
  const acao = achar(ACAO_SEM_CATEGORIA);
  if (!acao) return `falta a ação “${ACAO_SEM_CATEGORIA}” no Streamer.bot (o nome precisa ser exatamente igual)`;
  return executar(acao, {});
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
