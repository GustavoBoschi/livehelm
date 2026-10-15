// LiveHelm: título e categoria, tags da Twitch, marcação de momentos, enquetes e previsões e chat com moderação dentro do OBS, como dock de navegador (Docks >
// Custom Browser Docks, endereço file:///.../livehelm.html). Cada plataforma ativa no alto vale para atualizar a live e para
// enviar mensagens; o d20 ao lado delas liga ou desliga todas de uma vez (brilha quando todas estão ligadas), e a bolinha azul
// abre a lista de painéis para mostrar ou esconder cada um. A bolinha de estado abre as configurações (tema, conexões e
// marcação de momentos). A conexão com o Streamer.bot é a de streamerbot.js (endereço e senha das configurações ou de config.js;
// ?streamerbot= e ?sbsenha= na URL valem no lugar).
import { useEffect, useState } from 'react';
import { assinarStreamerbot } from './streamerbot.js';
import { PLATAFORMAS } from './plataformas.js';
import { carregarAcoes, lerConectadas, notificarAtualizacao, NOME_DA_PLATAFORMA, PLATAFORMAS_DO_DOCK } from './acoes.js';
import { ler, gravar } from './armazenamento.js';
import { D20Ambar, IconePlataforma } from './Icones.jsx';
import LivePanel from './LivePanel.jsx';
import Tags from './Tags.jsx';
import ChatPanel from './ChatPanel.jsx';
import Interacoes from './Interacoes.jsx';
import Momentos from './Momentos.jsx';
import Configuracoes from './Configuracoes.jsx';
import AvisoAnuncio from './AvisoAnuncio.jsx';

const ATUALIZACAO_MS = 15000; // de quanto em quanto tempo relê as ações e as plataformas conectadas
const PAINEIS = [
  { id: 'live', nome: 'Live', dica: 'Título e categoria' },
  { id: 'tags', nome: 'Tags da Twitch', dica: 'Tags (#) da live, só na Twitch' },
  { id: 'momentos', nome: 'Momentos', dica: 'Marcação de momentos da live' },
  { id: 'inter', nome: 'Enquetes e previsões', dica: 'Enquetes e previsões da Twitch' },
  { id: 'chat', nome: 'Chat', dica: 'Chat e moderação' },
];

export default function App() {
  const [conectado, setConectado] = useState(false);
  const [recusa, setRecusa] = useState(null);       // motivo, se o Streamer.bot recusou a conexão
  const [conectadas, setConectadas] = useState([]); // plataformas conectadas no Streamer.bot
  const [nomesDeAcoes, setNomesDeAcoes] = useState(null); // null = ainda não carregou
  const [ativas, setAtivas] = useState(() => ({ twitch: true, kick: true, youtube: true, ...ler('ativas', {}) }));

  useEffect(() => assinarStreamerbot(ev => {
    if (ev.tipo === 'conexao') {
      setConectado(ev.aberta);
      if (ev.aberta) setRecusa(null);
      else { setConectadas([]); setNomesDeAcoes(null); }
    } else if (ev.tipo === 'recusada') {
      setRecusa(ev.erro);
    } else if (ev.tipo === 'atualizacao') {
      notificarAtualizacao(ev);
    }
  }), []);

  useEffect(() => {
    if (!conectado) return undefined;
    let vivo = true;
    const atualizar = async () => {
      const [nomes, quem] = await Promise.all([carregarAcoes(), lerConectadas()]);
      if (!vivo) return;
      if (nomes) setNomesDeAcoes(nomes);
      setConectadas(quem);
    };
    atualizar();
    const intervalo = setInterval(atualizar, ATUALIZACAO_MS);
    return () => { vivo = false; clearInterval(intervalo); };
  }, [conectado]);

  const [menuPaineis, setMenuPaineis] = useState(false);
  const [paineis, setPaineis] = useState(() => ({ live: true, tags: true, momentos: true, inter: false, chat: true, ...ler('paineis', {}) }));
  const [configAberta, setConfigAberta] = useState(false);

  function alternarPainel(id) {
    const novos = { ...paineis, [id]: !paineis[id] };
    setPaineis(novos);
    gravar('paineis', novos);
  }
  // O d20 é a chave global das plataformas: com todas ligadas desliga todas, senão liga todas.
  function alternarTodas() {
    const todas = PLATAFORMAS_DO_DOCK.every(id => ativas[id]);
    const novas = Object.fromEntries(PLATAFORMAS_DO_DOCK.map(id => [id, !todas]));
    setAtivas(novas);
    gravar('ativas', novas);
  }
  const todasAtivas = PLATAFORMAS_DO_DOCK.every(id => ativas[id]);

  useEffect(() => {
    if (!menuPaineis) return undefined;
    const fecha = () => setMenuPaineis(false);
    const tecla = e => { if (e.key === 'Escape') fecha(); };
    window.addEventListener('click', fecha);
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('click', fecha); window.removeEventListener('keydown', tecla); };
  }, [menuPaineis]);

  function alternar(id) {
    const novas = { ...ativas, [id]: !ativas[id] };
    setAtivas(novas);
    gravar('ativas', novas);
  }

  // Bolinha de estado: verde = Streamer.bot e todas as plataformas ativas conectados; amarelo = falta alguma plataforma ativa;
  // vermelho = sem Streamer.bot (ou ele recusou a conexão).
  const ativasLista = PLATAFORMAS_DO_DOCK.filter(id => ativas[id]);
  const faltando = ativasLista.filter(id => !conectadas.includes(id));
  const estado = !conectado || recusa ? 'vermelho' : faltando.length > 0 ? 'amarelo' : 'verde';
  const dicaDoEstado = !conectado || recusa
    ? `Streamer.bot ${recusa ? `recusou a conexão (${recusa})` : 'desconectado'}`
    : faltando.length > 0 ? `Streamer.bot conectado · sem conexão: ${faltando.map(id => NOME_DA_PLATAFORMA[id]).join(', ')}` : 'Streamer.bot e plataformas conectados';

  const aviso = recusa
    ? `O Streamer.bot recusou a conexão (${recusa}). Confira a senha nas configurações (bolinha de estado).`
    : !conectado ? 'Streamer.bot desconectado: abra-o e ligue o WebSocket Server.' : null;

  return (
    <div id="dock">
      <header className="barra">
        <button type="button" id="plataformas-todas" className={`global${todasAtivas ? ' global-ligado' : ''}`} aria-pressed={todasAtivas}
                title={todasAtivas ? 'Desativar todas as plataformas' : 'Ativar todas as plataformas'} onClick={alternarTodas}>
          <D20Ambar aceso={todasAtivas} largura={19} />
        </button>
        <div className="plataformas" role="group" aria-label="Plataformas ativas">
          {PLATAFORMAS_DO_DOCK.map(id => {
            const ligada = conectadas.includes(id);
            return (
              <button key={id} type="button" id={`plataforma-${id}`} className={`plataforma${ativas[id] ? ' plataforma-ativa' : ''}`} aria-pressed={!!ativas[id]}
                      style={{ '--cor-plataforma': PLATAFORMAS[id].cor }}
                      title={`${NOME_DA_PLATAFORMA[id]} · ${ligada ? 'conectada' : 'sem conexão'} · ${ativas[id] ? 'ativa: vale para atualizar a live e enviar mensagens' : 'desligada'}`}
                      onClick={() => alternar(id)}>
                <IconePlataforma id={id} tamanho={12} />
                <span className={`ponto${ligada ? ' ponto-ligado' : ''}`} />
              </button>
            );
          })}
        </div>
        <button type="button" id="paineis-botao" className="bolinha-paineis" aria-expanded={menuPaineis} title="Painéis: mostrar ou esconder" aria-label="Painéis"
                onClick={e => { e.stopPropagation(); setMenuPaineis(a => !a); }} />
        <button type="button" className={`estado estado-${estado}`} id="estado-conexao" title={`${dicaDoEstado} · clique para abrir as configurações`} aria-label="Configurações"
                aria-pressed={configAberta} onClick={() => { setMenuPaineis(false); setConfigAberta(a => !a); }} />
        {menuPaineis && (
          <div className="menu-paineis" id="menu-paineis" role="menu" onClick={e => e.stopPropagation()}>
            {PAINEIS.map(p => (
              <label key={p.id} className="painel-opcao" title={p.dica}>
                <input type="checkbox" id={`painel-chave-${p.id}`} checked={!!paineis[p.id]} onChange={() => alternarPainel(p.id)} />
                {p.nome}
              </label>
            ))}
          </div>
        )}
      </header>
      {aviso && <p className="aviso aviso-faixa" id="aviso-conexao">{aviso}</p>}
      <AvisoAnuncio nomesDeAcoes={nomesDeAcoes} />
      {configAberta ? <Configuracoes conectado={conectado} recusa={recusa} onVoltar={() => setConfigAberta(false)} /> : (
        <>
          {paineis.live && <LivePanel ativas={ativas} conectado={conectado} nomesDeAcoes={nomesDeAcoes} />}
          {paineis.tags && <Tags ativas={ativas} conectado={conectado} nomesDeAcoes={nomesDeAcoes} />}
          {paineis.momentos && <Momentos conectado={conectado} nomesDeAcoes={nomesDeAcoes} />}
          {paineis.inter && <Interacoes ativas={ativas} conectado={conectado} />}
        </>
      )}
      {paineis.chat && <ChatPanel ativas={ativas} conectado={conectado} oculto={configAberta} />}
    </div>
  );
}
