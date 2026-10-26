// Chat e alertas das três plataformas num feed só, com moderação (apagar, silenciar, banir), caixa de envio e os extras:
// busca e filtro por usuário, mensagens fixadas e lista de silenciados e banidos (com desfazer). Os eventos
// vêm do Streamer.bot (streamerbot.js) e as ações saem pela ação `Painel: Chat` (acoes.js). Mensagens apagadas ou de quem
// foi punido ficam riscadas; o feed guarda no máximo MAX_ITENS linhas.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { assinarStreamerbot } from './streamerbot.js';
import { passaNaAba } from './alertas.js';
import { lerConfig } from './configuracoes.js';
import { plataformaDe } from './plataformas.js';
import { decidirResgate, executarChat, responderMensagem, temControlesAgora, NOME_DA_PLATAFORMA, PLATAFORMAS_DO_DOCK } from './acoes.js';
import { ler, gravar } from './armazenamento.js';
import FilaDeResgates from './FilaDeResgates.jsx';
import PerfilCard from './PerfilCard.jsx';
import { IconePlataforma, Traco } from './Icones.jsx';
import { PopupPunicoes } from './Listas.jsx';
import { registrar } from './punicoes.js';
import { lembrarResgate, mensagemRepeteResgate, mesmoTextoDoResgate } from './resgates.js';
import { copiarTexto, corLegivel, duracao, hora, partesDaMensagem, simplificar } from './texto.js';

const MAX_ITENS = 400;
const MAX_FIXADAS = 3;
const STATUS_MS = 9000;
const PERTO_DO_FIM_PX = 24;   // até essa distância do fim da lista ela segue as mensagens novas
const SILENCIO_RAPIDO_S = 300; // o silêncio do botão da linha
const COMANDOS = 'Comandos: /ban nome · /timeout nome segundos · /limpar (só Twitch) · /limpardock (só o chat daqui)';

const ABAS = [
  { id: 'tudo', dica: 'Tudo: mostra as mensagens de todas as plataformas e os alertas principais (seguidor, sub, presente, apoio e raid), e envia para as ativas no alto', icone: 'globo' },
  { id: 'twitch', dica: 'Só a Twitch: mostra as mensagens e os alertas principais dela, e envia só para ela' },
  { id: 'kick', dica: 'Só a Kick: mostra as mensagens e os alertas principais dela, e envia só para ela' },
  { id: 'youtube', dica: 'Só o YouTube: mostra as mensagens e os alertas principais dele, e envia só para ele' },
  { id: 'alertas', dica: 'Todos os alertas de todas as plataformas, inclusive anúncio, resgates, hype train, votações e previsões', texto: 'Alertas' },
];

// Abas ligadas nas configurações (config.chat): a fila de resgates da Twitch e só as mensagens retidas pelo AutoMod.
const ABA_RESGATES = { id: 'resgates', dica: 'Fila de resgates de pontos da Twitch, com Cumprir e Reembolsar', texto: 'Resgates', marca: 'twitch' };
const ABA_AUTOMOD = { id: 'automod', dica: 'Só as mensagens que o AutoMod da Twitch reteve, com Permitir e Negar', texto: 'AutoMod' };
const MAX_FILA = 60;
// A fila fica guardada: recarregar o dock não perde os resgates que ainda esperam. Um "enviando" que ficou pelo caminho volta a pendente.
const lerFila = () => {
  const f = ler('filaDeResgates', []);
  return Array.isArray(f) ? f.filter(i => i && i.uid && i.nome).map(i => (i.estado === 'enviando' ? { ...i, estado: 'pendente' } : i)).slice(-MAX_FILA) : [];
};

// Comandos da caixa: devolve { verbo, args, plataformas } (plataformas que aceitam) ou { erro }.
function interpretarComando(texto) {
  const partes = texto.slice(1).split(/\s+/).filter(Boolean);
  const palavra = (partes[0] || '').toLowerCase();
  const nome = (partes[1] || '').replace(/^@/, '');
  switch (palavra) {
    case 'ban':
    case 'banir':
      return nome ? { verbo: 'banir', args: { usuario: nome }, plataformas: PLATAFORMAS_DO_DOCK } : { erro: 'Use /ban nome' };
    case 'timeout':
    case 'silenciar': {
      if (!nome) return { erro: 'Use /timeout nome segundos' };
      const s = parseInt(partes[2], 10);
      return { verbo: 'silenciar', args: { usuario: nome, segundos: s > 0 ? s : 600 }, plataformas: PLATAFORMAS_DO_DOCK };
    }
    case 'limpar':
    case 'clear':
      return { verbo: 'limpar', args: {}, plataformas: ['twitch'] };
    default:
      return { erro: 'Comando desconhecido. ' + COMANDOS };
  }
}

// Rótulo pequeno antes do nome. O resgate de pontos fica sem rótulo: "Fulano resgatou X · 500 pontos" já diz o que é.
const ROTULO_DO_ALERTA = {
  new_follower: 'Seguidor', new_subscriber: 'Sub', resub: 'Resub', subscription_gift: 'Sub de presente', sponsorship: 'Membro',
  membermilestone: 'Membro', giftpurchase: 'Presente', giftredemption: 'Presente', cheer: 'Bits', gift: 'Presente',
  jeweldonation: 'Joias', hype_chat: 'Hype Chat', superchat: 'Superchat', supersticker: 'Super Sticker', raid: 'Raid',
  hype_train: 'Hype train', poll: 'Votação', prediction: 'Previsão', upcoming_ad: 'Anúncio', livepix: 'LivePix',
};

const mesmoUsuario = (item, nome, plataforma) => item.tipo === 'chat' && item.plataforma === plataforma && item.nome.toLowerCase() === String(nome).toLowerCase();

// memo: uma linha só refaz quando o seu item muda (as atualizações mantêm a identidade das demais).
const STATUS_DA_RETIDA = { permitida: 'permitida', negada: 'negada', expirada: 'expirou sem resposta' };

const Linha = memo(function Linha({ item, aoMenu, aoRapida, aoRetida, aoResponder }) {
  const plat = plataformaDe(item.plataforma);
  if (item.tipo === 'retida') {
    return (
      <div className="linha linha-retida" id={`retida-${item.msgId}`} style={{ '--cor-plataforma': plat.cor }}>
        <span className="hora">{item.hora}</span>
        <span className="marca-plataforma"><IconePlataforma id={item.plataforma} /></span>
        <div className="conteudo">
          <span className="alerta-rotulo">Retida pelo AutoMod</span>
          <b className="nome">{item.nome}</b>
          <span className="dois-pontos">: </span>
          <span className="texto">{item.texto}</span>
          {item.motivo && <span className="alerta-detalhe">{item.motivo}</span>}
          {item.status === 'pendente' || item.status === 'enviando' ? (
            <span className="retida-botoes">
              <button type="button" className="retida-permitir" disabled={item.status === 'enviando'} onClick={() => aoRetida('permitir', item)}>Permitir</button>
              <button type="button" className="retida-negar" disabled={item.status === 'enviando'} onClick={() => aoRetida('negar', item)}>Negar</button>
            </span>
          ) : <span className="retida-status">{STATUS_DA_RETIDA[item.status]}</span>}
        </div>
      </div>
    );
  }
  if (item.tipo === 'alerta') {
    return (
      <div className={`linha linha-alerta${item.evento === 'reward' ? ' linha-resgate' : item.evento === 'livepix' ? ' linha-livepix' : ''}`} style={{ '--cor-plataforma': plat.cor }}>
        <span className="hora">{item.hora}</span>
        <span className="marca-plataforma"><IconePlataforma id={item.plataforma} /></span>
        <div className="conteudo">
          {item.rotulo && <span className="alerta-rotulo">{item.rotulo}</span>}
          <b>{item.nome}</b>
          {item.detalhe && <span className="alerta-detalhe">{item.detalhe}</span>}
          {item.mensagem && <span className="alerta-mensagem">{item.mensagem}</span>}
        </div>
      </div>
    );
  }
  const insignias = (item.insignias || []).filter(b => b && b.src && /^https:\/\//i.test(b.src));
  return (
    <div className={`linha${item.apagada ? ' linha-apagada' : ''}${item.primeira ? ' linha-primeira' : ''}`} style={{ '--cor-plataforma': plat.cor }}
         onContextMenu={e => { e.preventDefault(); aoMenu(e, item); }}>
      <span className="hora">{item.hora}</span>
      <span className="marca-plataforma"><IconePlataforma id={item.plataforma} /></span>
      <div className="conteudo">
        {insignias.map((b, i) => <img key={i} className="insignia" src={b.src} alt="" />)}
        <b className="nome" style={{ color: corLegivel(item.cor) }}>{item.nome}</b>
        {item.primeira && <span className="etiqueta-primeira">primeira mensagem</span>}
        <span className="dois-pontos">: </span>
        <span className="texto">
          {partesDaMensagem(item.html).map((p, i) => (p.emote ? <img key={i} className="emote" src={p.emote} alt={p.alt} /> : <span key={i}>{p.texto}</span>))}
        </span>
      </div>
      <div className="rapidas">
        <button type="button" title="Banir" onClick={() => aoRapida('banir', item)}><Traco nome="banir" /></button>
        <button type="button" title="Silenciar 5 min" onClick={() => aoRapida('silenciar', item)}><Traco nome="tempo" /></button>
        {item.plataforma !== 'youtube' && <button type="button" title="Apagar mensagem" onClick={() => aoRapida('apagar', item)}><Traco nome="lixeira" /></button>}
        {aoResponder && <button type="button" title="Responder" onClick={() => aoResponder(item)}><Traco nome="responder" /></button>}
        <button type="button" title="Mais opções" onClick={e => aoMenu(e, item)}><Traco nome="mais" /></button>
      </div>
    </div>
  );
});

// `oculto`: o painel fica montado, só escondido, com as configurações abertas (o feed não se perde) e relê as escolhas de alertas ao voltar.
export default function ChatPanel({ ativas, conectado, oculto = false }) {
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState('tudo');
  const [novas, setNovas] = useState(0);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [status, setStatus] = useState(null);       // { texto, erro }
  const [menu, setMenu] = useState(null);           // { item, x, y }
  const [confirmacao, setConfirmacao] = useState(null); // { texto, aoConfirmar }
  const [busca, setBusca] = useState('');
  const [barraAberta, setBarraAberta] = useState(false);
  const [usuarioFiltro, setUsuarioFiltro] = useState(null); // { plataforma, nome (minúsculo), exibir }
  const [fixadas, setFixadas] = useState([]);
  const [punicoes, setPunicoes] = useState([]);
  const [popupAberto, setPopupAberto] = useState(false);
  const [fila, setFila] = useState(lerFila);          // fila de resgates da Twitch (aba Resgates)
  const [respondendo, setRespondendo] = useState(null); // { plataforma, msgId, nome, trecho }: a mensagem que a caixa vai responder
  const [perfil, setPerfil] = useState(null);         // a mensagem de quem o cartão de perfil mostra
  const [agora, setAgora] = useState(() => Date.now()); // relê quem já saiu do silêncio quando o popup abre
  const lista = useRef(null);
  const seguindo = useRef(true);
  const itensRef = useRef(itens);
  const passaRef = useRef(null);
  const escolhas = useMemo(() => lerConfig().alertasNoChat.escolhas, [oculto]);
  const chatExtra = useMemo(() => lerConfig().chat, [oculto]); // abas e ações do chat ligadas nas configurações
  const temporizadorStatus = useRef(null);
  const contador = useRef(0);
  const resgatesRecentes = useRef([]); // resgates com texto dos últimos segundos (resgates.js): a mensagem igual do chat não entra de novo
  itensRef.current = itens;

  const termo = simplificar(busca.trim());
  const passaNaBusca = useCallback(item => {
    if (usuarioFiltro && !(item.plataforma === usuarioFiltro.plataforma && String(item.nome).toLowerCase() === usuarioFiltro.nome)) return false;
    if (!termo) return true;
    return simplificar(item.tipo === 'alerta' ? `${item.rotulo} ${item.nome} ${item.detalhe} ${item.mensagem || ''}` : `${item.nome} ${item.texto}`).includes(termo);
  }, [usuarioFiltro, termo]);
  passaRef.current = item => passaNaAba(item, filtro, escolhas) && passaNaBusca(item);

  const avisar = useCallback((t, erro = true) => {
    setStatus({ texto: t, erro });
    clearTimeout(temporizadorStatus.current);
    temporizadorStatus.current = setTimeout(() => setStatus(null), STATUS_MS);
  }, []);

  // Anota um silêncio ou banimento (feito pelo dock ou avisado pela plataforma).
  const registrarPunicao = useCallback(nova => {
    const achaUsuario = (plataforma, nome) => {
      const ultimo = [...itensRef.current].reverse().find(i => mesmoUsuario(i, nome, plataforma));
      return ultimo ? { login: ultimo.login, userId: ultimo.userId } : null;
    };
    setPunicoes(l => registrar(l, nova, Date.now(), achaUsuario));
  }, []);

  // ---- Eventos do Streamer.bot ----

  useEffect(() => {
    const acrescenta = (anteriores, novos) => [...anteriores, ...novos].slice(-MAX_ITENS);
    const contaNovas = novos => {
      if (seguindo.current) return;
      const n = novos.filter(i => passaRef.current(i)).length;
      if (n) setNovas(v => v + n);
    };
    // `evento` é o tipo do alerta (valor de `event` em streamerbot.js); os avisos de moderação do dock (banido, silenciado e chat
    // limpo) usam 'moderacao'. Quais tipos aparecem na aba Tudo: alertas.js.
    const alertaDaPlataforma = (plataforma, nome, rotulo, detalhe = '', evento = 'moderacao', mensagem = '') => ({
      uid: ++contador.current, tipo: 'alerta', plataforma, nome, rotulo, detalhe, mensagem, evento, hora: hora(),
    });

    return assinarStreamerbot(ev => {
      switch (ev.tipo) {
        case 'chat': {
          const m = ev.mensagem;
          // A mensagem em destaque (e a de recompensa com texto) já aparece como resgate, com o texto: não repete.
          if (mensagemRepeteResgate(resgatesRecentes.current, { plataforma: m.type, nome: m.chatname, texto: m.chattexto || '' })) break;
          const item = {
            uid: ++contador.current, criadoEm: Date.now(), tipo: 'chat', plataforma: m.type, msgId: m.id, userId: m.userid, login: m.username, nome: m.chatname,
            cor: m.nameColor, avatar: m.chatimg || '', html: m.chatmessage, texto: m.chattexto || '', insignias: m.chatbadges || [], hora: hora(), apagada: false, primeira: !!m.primeira,
          };
          setItens(a => acrescenta(a, [item]));
          contaNovas([item]);
          break;
        }
        case 'alerta': {
          const a = ev.alerta;
          const rotulo = a.rotulo || ROTULO_DO_ALERTA[a.event] || '';
          const nome = a.principal || a.chatname;
          const detalhe = [a.destaque, a.detalhe].filter(Boolean).join(' · ');
          const item = alertaDaPlataforma(a.type, nome, rotulo, detalhe, a.event, a.mensagem || '');
          if (a.type === 'twitch' && a.event === 'reward' && a.resgate) {
            // Os resgates da Twitch (recompensa personalizada) entram na fila da aba Resgates; os que se completam sozinhos ficam como "automático".
            const entrada = { uid: `r${Date.now().toString(36)}-${++contador.current}`, redemptionId: a.resgate.id, rewardId: a.resgate.rewardId, nome: a.chatname, detalhe: a.detalhe || '', texto: a.mensagem || '', hora: hora(), estado: a.resgate.automatico ? 'automatico' : !a.resgate.id || !a.resgate.rewardId ? 'semid' : 'pendente' };
            setFila(l => [...l, entrada].slice(-MAX_FILA));
          }
          if (a.event === 'reward' && a.mensagem) {
            // Se a mensagem do chat chegou antes do resgate, ela sai da lista (o resgate fica com o texto).
            const resgate = { plataforma: a.type, nome: a.chatname, texto: a.mensagem };
            resgatesRecentes.current = lembrarResgate(resgatesRecentes.current, resgate);
            setItens(l => l.filter(i => !(i.tipo === 'chat' && mesmoTextoDoResgate({ ...resgate, quando: Date.now() }, { plataforma: i.plataforma, nome: i.nome, texto: i.texto, quando: i.criadoEm || 0 }))));
          }
          setItens(l => acrescenta(l, [item]));
          contaNovas([item]);
          break;
        }
        case 'apagar':
          setItens(l => l.map(i => {
            const alvo = ev.id !== undefined ? i.tipo === 'chat' && String(i.msgId) === String(ev.id) : mesmoUsuario(i, ev.chatname, ev.plataforma);
            return alvo && !i.apagada ? { ...i, apagada: true } : i;
          }));
          break;
        case 'apagarUsuario': {
          const banido = ev.punicao === 'banido';
          const item = alertaDaPlataforma(ev.plataforma, ev.chatname, banido ? 'Banido' : 'Silenciado', ev.segundos ? duracao(ev.segundos) : '');
          setItens(l => acrescenta(l.map(i => (mesmoUsuario(i, ev.chatname, ev.plataforma) && !i.apagada ? { ...i, apagada: true } : i)), [item]));
          contaNovas([item]);
          registrarPunicao({ plataforma: ev.plataforma, nome: ev.chatname, banido, segundos: ev.segundos || 0, login: ev.login, userId: ev.userid });
          break;
        }
        case 'retida': {
          const item = { uid: ++contador.current, tipo: 'retida', plataforma: ev.plataforma, msgId: ev.id, nome: ev.nome, texto: ev.texto, motivo: ev.motivo, status: 'pendente', hora: hora() };
          setItens(l => acrescenta(l, [item]));
          contaNovas([item]);
          break;
        }
        case 'retidaAtualizada':
          setItens(l => l.map(i => (i.tipo === 'retida' && String(i.msgId) === String(ev.id) ? { ...i, status: ev.status } : i)));
          break;
        case 'limpar': {
          const item = alertaDaPlataforma(ev.plataforma, '', 'Chat limpo');
          setItens(l => acrescenta(l.map(i => (i.tipo === 'chat' && (!ev.plataforma || i.plataforma === ev.plataforma) && !i.apagada ? { ...i, apagada: true } : i)), [item]));
          break;
        }
        default:
      }
    });
  }, [registrarPunicao]);

  // A fila de resgates fica guardada; e uma aba desligada nas configurações não pode continuar escolhida.
  useEffect(() => { gravar('filaDeResgates', fila.slice(-MAX_FILA)); }, [fila]);
  useEffect(() => {
    if ((filtro === 'resgates' && !chatExtra.resgates) || (filtro === 'automod' && !chatExtra.automod)) setFiltro('tudo');
  }, [filtro, chatExtra]);

  // ---- Rolagem ----

  const visiveis = useMemo(() => itens.filter(i => passaNaAba(i, filtro, escolhas) && passaNaBusca(i)), [itens, filtro, escolhas, passaNaBusca]);

  useLayoutEffect(() => {
    const el = lista.current;
    if (el && seguindo.current) el.scrollTop = el.scrollHeight;
  }, [visiveis, filtro, oculto, fila]);

  function aoRolar() {
    const el = lista.current;
    seguindo.current = el.scrollHeight - el.scrollTop - el.clientHeight <= PERTO_DO_FIM_PX;
    if (seguindo.current) setNovas(0);
  }
  function irParaOFim() {
    seguindo.current = true;
    setNovas(0);
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }
  // Tudo e Alertas são abas sozinhas (clicar de novo na ativa volta para Tudo). As plataformas se somam: cada clique marca ou desmarca uma, e as
  // marcadas formam a lista que vê o chat e recebe o que for enviado; desmarcar a última volta para Tudo.
  function trocarFiltro(id) {
    setFiltro(atual => {
      if (!PLATAFORMAS_DO_DOCK.includes(id)) return id === atual ? 'tudo' : id;
      const marcadas = Array.isArray(atual) ? atual : [];
      if (!marcadas.includes(id)) return [...marcadas, id];
      return marcadas.length === 1 ? 'tudo' : marcadas.filter(p => p !== id);
    });
    seguindo.current = true;
    setNovas(0);
  }

  // ---- Busca e filtro por usuário ----

  const abrirBusca = useCallback(() => {
    setBarraAberta(true);
    setTimeout(() => { const c = document.getElementById('campo-busca'); if (c) { c.focus(); c.select(); } }, 0);
  }, []);
  function fecharBusca() {
    setBusca('');
    setUsuarioFiltro(null);
    setBarraAberta(false);
    seguindo.current = true;
  }
  function verSoEsteUsuario(item) {
    setMenu(null);
    setUsuarioFiltro({ plataforma: item.plataforma, nome: String(item.nome).toLowerCase(), exibir: item.nome });
    setBarraAberta(true);
    seguindo.current = true;
  }
  useEffect(() => {
    const tecla = e => { if (!oculto && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); abrirBusca(); } };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abrirBusca, oculto]);

  // ---- Fixadas ----

  function fixar(item) {
    setMenu(null);
    setFixadas(l => (l.some(f => f.plataforma === item.plataforma && f.nome === item.nome && f.texto === item.texto)
      ? l : [...l, { uid: ++contador.current, plataforma: item.plataforma, nome: item.nome, texto: item.texto }].slice(-MAX_FIXADAS)));
  }

  // ---- Moderação ----

  async function moderar(verbo, item, segundos = 0) {
    const infinitivo = { apagar: 'apagar', silenciar: 'silenciar', banir: 'banir' }[verbo];
    const erro = await executarChat(verbo, { plataforma: item.plataforma, usuario: item.login || item.nome, usuarioId: item.userId, mensagemId: item.msgId, segundos });
    if (erro) { avisar(`Não consegui ${infinitivo}: ${erro}`); return; }
    if (verbo === 'apagar') setItens(l => l.map(i => (i.uid === item.uid ? { ...i, apagada: true } : i)));
    else registrarPunicao({ plataforma: item.plataforma, nome: item.nome, banido: verbo === 'banir', segundos, login: item.login, userId: item.userId });
  }
  // Banir pede confirmação dentro da página (não dá pra contar com a janela de confirmar do navegador no OBS).
  function pedirBanir(item) {
    setMenu(null);
    setConfirmacao({ texto: `Banir ${item.nome} (${NOME_DA_PLATAFORMA[item.plataforma] || item.plataforma})?`, aoConfirmar: () => moderar('banir', item) });
  }
  // Permitir ou negar uma mensagem retida pelo AutoMod: a ação do Streamer.bot responde se aceitou; o evento de atualização confirma depois.
  async function moderarRetida(verbo, item) {
    const mudar = status => setItens(l => l.map(i => (i.uid === item.uid ? { ...i, status } : i)));
    mudar('enviando');
    const erro = await executarChat(verbo, { plataforma: 'twitch', mensagemId: item.msgId });
    if (erro) { mudar('pendente'); avisar(erro); return; }
    mudar(verbo === 'permitir' ? 'permitida' : 'negada');
  }

  // Cumpre ou reembolsa um resgate da fila (ação Painel: Controles). Se a Twitch ou o código da ação recusar, o item volta a pendente com o motivo.
  async function decidirResgateDaFila(item, decisao) {
    const mudar = parte => setFila(l => l.map(i => (i.uid === item.uid ? { ...i, ...parte } : i)));
    mudar({ estado: 'enviando', erro: '' });
    const r = await decidirResgate({ rewardId: item.rewardId, redemptionId: item.redemptionId, decisao });
    if (r.nivel === 2) mudar({ estado: 'pendente', erro: /desconhecida|atualize/i.test(r.texto) ? 'Cole de novo o código de Painel-Controles.cs na ação Painel: Controles.' : r.texto });
    else mudar({ estado: decisao === 'cumprir' ? 'cumprido' : 'reembolsado', erro: r.nivel === 1 ? '(sem confirmação)' : '' });
  }

  // A caixa passa a responder a essa mensagem (na Twitch e na Kick é resposta de verdade; no YouTube, que não tem, sai com @nome).
  function iniciarResposta(item) {
    setMenu(null);
    setPerfil(null);
    setRespondendo({ plataforma: item.plataforma, msgId: item.msgId, nome: item.nome, trecho: String(item.texto || '').slice(0, 70) });
    setTimeout(() => document.getElementById('caixa-mensagem')?.focus(), 0);
  }
  function mostrarPerfil(item) {
    setMenu(null);
    setPopupAberto(false);
    setPerfil(item);
  }

  function acaoRapida(verbo, item) {
    if (verbo === 'banir') pedirBanir(item);
    else if (verbo === 'silenciar') moderar('silenciar', item, SILENCIO_RAPIDO_S);
    else moderar('apagar', item);
  }

  // Pede ao Streamer.bot para liberar o usuário (verbo reverter da ação Painel: Chat). A ação responde ok mesmo com código
  // antigo, então o item fica na lista marcado com a hora do pedido, e dá pra tentar de novo.
  async function reverter(p) {
    const erro = await executarChat('reverter', { plataforma: p.plataforma, usuario: p.login || p.nome, usuarioId: p.userId || '' });
    if (erro) { avisar(`Não consegui reverter: ${erro}`); return; }
    setPunicoes(l => l.map(x => (x.id === p.id ? { ...x, pedido: Date.now() } : x)));
    avisar(`Pedi ao Streamer.bot para liberar ${p.nome}. Se nada mudar, atualize o código da ação Painel: Chat (docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”).`, false);
  }
  function alternarPopup(e) {
    e.stopPropagation();
    setAgora(Date.now());
    setPopupAberto(a => !a);
  }

  const abrirMenu = useCallback((e, item) => {
    e.stopPropagation();
    setPopupAberto(false);
    setPerfil(null);
    setMenu({ item, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 340) });
  }, []);
  useEffect(() => {
    if (!menu && !popupAberto && !perfil) return undefined;
    const fecha = () => { setMenu(null); setPopupAberto(false); setPerfil(null); };
    const tecla = e => { if (e.key === 'Escape') fecha(); };
    window.addEventListener('click', fecha);
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('click', fecha); window.removeEventListener('keydown', tecla); };
  }, [menu, popupAberto, perfil]);

  function mencionar(nome) {
    setTexto(t => `${t} @${nome} `.trimStart());
    document.getElementById('caixa-mensagem')?.focus();
  }

  // ---- Envio ----

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    // /limpardock: esvazia só a lista de mensagens do LiveHelm; nada é apagado nas plataformas.
    if (/^\/(limpardock|limparlocal)\s*$/i.test(t)) {
      setItens([]);
      setNovas(0);
      setTexto('');
      avisar('Chat do LiveHelm limpo (nada foi apagado nas plataformas)', false);
      return;
    }
    // Respondendo a uma mensagem: sai só para a plataforma dela (comando com / continua sendo comando).
    if (respondendo && !t.startsWith('/')) {
      const alvo = respondendo;
      setEnviando(true);
      // Com a ação Painel: Controles a resposta fica ligada à mensagem (Twitch e Kick); sem ela, vale o jeito mais simples: a mensagem sai para a plataforma com @nome.
      let r;
      if (temControlesAgora()) r = await responderMensagem({ plataforma: alvo.plataforma, mensagemId: alvo.msgId, mensagem: t, usuario: alvo.nome });
      else {
        const erro = await executarChat('enviar', { plataforma: alvo.plataforma, mensagem: `@${alvo.nome} ${t}` });
        r = erro ? { nivel: 2, texto: erro } : { nivel: 1, texto: 'enviada com @nome (a resposta ligada à mensagem precisa da ação Painel: Controles)' };
      }
      setEnviando(false);
      if (r.nivel === 2) { avisar(`Não respondi: ${r.texto}`); return; }
      setTexto('');
      setRespondendo(null);
      avisar(r.nivel === 1 ? `Resposta a ${alvo.nome} ${r.texto}` : `Resposta enviada a ${alvo.nome}`, false);
      return;
    }
    let destinos = Array.isArray(filtro) ? filtro : PLATAFORMAS_DO_DOCK.filter(p => ativas[p]);
    if (destinos.length === 0) { avisar('Ative uma plataforma no alto ou escolha a aba de uma delas.'); return; }
    let verbo = 'enviar';
    let base = { mensagem: t };
    if (t.startsWith('/')) {
      const c = interpretarComando(t);
      if (c.erro) { avisar(c.erro); return; }
      verbo = c.verbo;
      base = c.args;
      destinos = destinos.filter(p => c.plataformas.includes(p));
      if (destinos.length === 0) { avisar('Nenhuma das plataformas escolhidas aceita esse comando.'); return; }
    }
    setEnviando(true);
    const erros = [];
    for (const p of destinos) {
      const erro = await executarChat(verbo, { ...base, plataforma: p });
      if (erro) erros.push(`${NOME_DA_PLATAFORMA[p]}: ${erro}`);
      else if (verbo === 'banir' || verbo === 'silenciar') registrarPunicao({ plataforma: p, nome: base.usuario, banido: verbo === 'banir', segundos: base.segundos || 0 });
    }
    setEnviando(false);
    if (erros.length === 0) {
      setTexto('');
      if (verbo !== 'enviar') avisar(`Comando enviado: ${t} (${destinos.map(p => NOME_DA_PLATAFORMA[p]).join(', ')})`, false);
    } else {
      avisar(`Não enviei — ${[...new Set(erros)].join('; ')}`);
    }
  }

  const pendentesDaFila = fila.filter(i => i.estado === 'pendente' || i.estado === 'enviando').length;
  const pendentesDoAutomod = itens.filter(i => i.tipo === 'retida' && (i.status === 'pendente' || i.status === 'enviando')).length;
  const abas = [...ABAS, ...(chatExtra.resgates ? [{ ...ABA_RESGATES, contagem: pendentesDaFila }] : []), ...(chatExtra.automod ? [{ ...ABA_AUTOMOD, contagem: pendentesDoAutomod }] : [])];
  const placeholder = respondendo ? `Responder a ${respondendo.nome} (${NOME_DA_PLATAFORMA[respondendo.plataforma] || respondendo.plataforma})` : Array.isArray(filtro) ? `Mensagem para ${filtro.map(p => NOME_DA_PLATAFORMA[p]).join(' e ')}` : 'Mensagem';
  const vazio = visiveis.length === 0;
  const marcada = id => (Array.isArray(filtro) ? filtro.includes(id) : filtro === id);

  return (
    <section className="cartao chat" id="painel-chat" style={oculto ? { display: 'none' } : undefined}>
      <div className={`abas${chatExtra.resgates || chatExtra.automod ? ' abas-compactas' : ''}`} role="tablist">
        {abas.map(a => {
          const plat = PLATAFORMAS_DO_DOCK.includes(a.id) ? plataformaDe(a.id) : null;
          return (
            <button key={a.id} type="button" role="tab" aria-selected={marcada(a.id)} title={plat ? `${a.dica}: clique em mais de uma para ver e falar em várias` : a.dica} id={`aba-${a.id}`}
                    className={`aba${marcada(a.id) ? ' aba-ativa' : ''}`} style={plat ? { '--cor-aba': plat.cor } : undefined} onClick={() => trocarFiltro(a.id)}>
              {a.icone && <Traco nome={a.icone} />}
              {plat && <IconePlataforma id={a.id} tamanho={13} />}
              {a.marca && <IconePlataforma id={a.marca} tamanho={13} />}
              {a.texto}
              {a.contagem > 0 && <span className="contador" id={`contador-${a.id}`}>{a.contagem}</span>}
            </button>
          );
        })}
        <span className="espaco" />
        <button type="button" id="botao-busca" className="aba aba-icone" title="Buscar no chat (Ctrl+F)" aria-label="Buscar no chat" onClick={() => (barraAberta ? fecharBusca() : abrirBusca())}><Traco nome="lupa" /></button>
        <button type="button" id="botao-punicoes" className="aba aba-icone" title="Silenciados e banidos desta sessão" aria-label="Silenciados e banidos" onClick={alternarPopup}>
          <Traco nome="banir" />{punicoes.length > 0 && <span className="contador contador-neutro">{punicoes.length}</span>}
        </button>
      </div>

      {popupAberto && <PopupPunicoes punicoes={punicoes} agora={agora} aoReverter={reverter} />}

      {barraAberta && (
        <div className="barra-busca" id="barra-busca">
          <input id="campo-busca" type="text" value={busca} placeholder="Buscar por nome ou texto" spellCheck={false}
                 onChange={e => { setBusca(e.target.value); seguindo.current = true; }} onKeyDown={e => { if (e.key === 'Escape') fecharBusca(); }} />
          {usuarioFiltro && (
            <span className="chip-usuario" id="chip-usuario">
              {usuarioFiltro.exibir}
              <button type="button" title="Ver todos de novo" aria-label="Ver todos de novo" onClick={() => setUsuarioFiltro(null)}>✕</button>
            </span>
          )}
          <button type="button" className="link" onClick={fecharBusca} title="Fecha a busca e limpa os filtros (Esc)">Fechar</button>
        </div>
      )}

      {fixadas.length > 0 && (
        <div className="fixadas" id="fixadas">
          {fixadas.map(f => (
            <div key={f.uid} className="fixada">
              <Traco nome="fixar" tamanho={13} />
              <span className="fixada-texto" title={f.texto}><b>{f.nome}</b>: {f.texto}</span>
              <button type="button" title="Desafixar" aria-label="Desafixar" onClick={() => setFixadas(l => l.filter(x => x.uid !== f.uid))}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="lista-chat" ref={lista} onScroll={aoRolar} id="lista-chat">
        {filtro === 'resgates' ? <FilaDeResgates fila={fila} aoDecidir={decidirResgateDaFila} conectado={conectado} semAcao={!temControlesAgora()} /> : <>
          {vazio && <p className="vazio">{!conectado ? 'As mensagens aparecem aqui quando o Streamer.bot estiver conectado.' : termo || usuarioFiltro ? 'Nenhuma mensagem encontrada.' : filtro === 'automod' ? 'Nenhuma mensagem retida pelo AutoMod.' : 'Nenhuma mensagem ainda.'}</p>}
          {visiveis.map(i => <Linha key={i.uid} item={i} aoMenu={abrirMenu} aoRapida={acaoRapida} aoRetida={moderarRetida} aoResponder={i.tipo === 'chat' ? iniciarResposta : undefined} />)}
        </>}
      </div>
      {novas > 0 && <button type="button" className="novas primario" onClick={irParaOFim}>{novas === 1 ? '1 nova ↓' : `${novas} novas ↓`}</button>}

      {menu && (
        <div className="menu" style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()} role="menu">
          <button type="button" role="menuitem" id="menu-responder" onClick={() => iniciarResposta(menu.item)}>Responder</button>
          <button type="button" role="menuitem" id="menu-perfil" onClick={() => mostrarPerfil(menu.item)}>Ver perfil</button>
          <hr />
          <button type="button" role="menuitem" onClick={() => { mencionar(menu.item.nome); setMenu(null); }}>Mencionar</button>
          <button type="button" role="menuitem" onClick={() => { copiarTexto(`${menu.item.nome}: ${menu.item.texto}`); setMenu(null); }}>Copiar mensagem</button>
          <hr />
          <button type="button" role="menuitem" onClick={() => fixar(menu.item)}>Fixar mensagem</button>
          <button type="button" role="menuitem" onClick={() => verSoEsteUsuario(menu.item)}>Ver só este usuário</button>
          <hr />
          <button type="button" role="menuitem" disabled={menu.item.plataforma === 'youtube'} title={menu.item.plataforma === 'youtube' ? 'O YouTube não permite apagar mensagens por aqui' : undefined}
                  onClick={() => { moderar('apagar', menu.item); setMenu(null); }}>Apagar mensagem</button>
          <button type="button" role="menuitem" onClick={() => { moderar('silenciar', menu.item, 60); setMenu(null); }}>Silenciar por 1 minuto</button>
          <button type="button" role="menuitem" onClick={() => { moderar('silenciar', menu.item, 600); setMenu(null); }}>Silenciar por 10 minutos</button>
          <button type="button" role="menuitem" className="perigo" onClick={() => pedirBanir(menu.item)}>Banir</button>
        </div>
      )}

      {confirmacao && (
        <div className="confirmacao" id="confirmacao">
          <span>{confirmacao.texto}</span>
          <button type="button" className="perigo" onClick={() => { const f = confirmacao.aoConfirmar; setConfirmacao(null); f(); }}>Sim</button>
          <button type="button" onClick={() => setConfirmacao(null)}>Não</button>
        </div>
      )}
      {status && <p className={`status${status.erro ? ' status-erro' : ''}`} id="status-chat">{status.texto}</p>}

      {perfil && <PerfilCard item={perfil} itens={itens} punicoes={punicoes} aoFechar={() => setPerfil(null)} aoResponder={() => iniciarResposta(perfil)}
                             aoVerSo={() => { verSoEsteUsuario(perfil); setPerfil(null); }} />}
      {respondendo && (
        <div className="respondendo" id="respondendo">
          <Traco nome="responder" tamanho={13} />
          <span className="respondendo-texto" title={respondendo.trecho}>Respondendo a <b>{respondendo.nome}</b>{respondendo.trecho ? `: ${respondendo.trecho}` : ''}{respondendo.plataforma === 'youtube' ? ' (no YouTube sai com @nome)' : ''}</span>
          <button type="button" title="Cancelar a resposta (Esc)" aria-label="Cancelar a resposta" onClick={() => setRespondendo(null)}>✕</button>
        </div>
      )}
      <div className="envio">
        <input id="caixa-mensagem" type="text" value={texto} placeholder={placeholder} title={COMANDOS} spellCheck
               onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') enviar(); else if (e.key === 'Escape' && respondendo) setRespondendo(null); }} />
        <button type="button" id="botao-enviar" disabled={enviando || !conectado} onClick={enviar}>Enviar</button>
      </div>
    </section>
  );
}
