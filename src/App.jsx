// LiveHelm: título e categoria, tags da Twitch, marcação de momentos, enquetes e previsões e chat com moderação dentro do OBS, como dock de navegador (Docks >
// Custom Browser Docks, endereço file:///.../livehelm.html). Cada plataforma ativa no alto vale para atualizar a live e para
// enviar mensagens; o d20 ao lado delas liga ou desliga todas de uma vez (brilha quando todas estão ligadas), e a bolinha azul
// abre a lista de painéis para mostrar ou esconder cada um. A bolinha de estado abre as configurações (tema, conexões e
// marcação de momentos). A conexão com o Streamer.bot é a de streamerbot.js (endereço e senha das configurações ou de config.js;
// ?streamerbot= e ?sbsenha= na URL valem no lugar).
import { useEffect, useRef, useState } from 'react';
import { assinarStreamerbot } from './streamerbot.js';
import { PLATAFORMAS } from './plataformas.js';
import { carregarAcoes, lerConectadas, notificarAtualizacao, youtubeComecou, NOME_DA_PLATAFORMA, PLATAFORMAS_DO_DOCK } from './acoes.js';
import { ler, gravar } from './armazenamento.js';
import { D20Ambar, IconePlataforma } from './Icones.jsx';
import LivePanel from './LivePanel.jsx';
import Tags from './Tags.jsx';
import ChatPanel from './ChatPanel.jsx';
import Interacoes from './Interacoes.jsx';
import Momentos from './Momentos.jsx';
import Configuracoes from './Configuracoes.jsx';
import AvisoAnuncio from './AvisoAnuncio.jsx';
import PainelMultistream from './PainelMultistream.jsx';
import Predefinicoes from './Predefinicoes.jsx';
import ModosDoChat from './ModosDoChat.jsx';
import BotaoMic from './BotaoMic.jsx';
import SaudeDoObs from './SaudeDoObs.jsx';
import TempoDeLive from './TempoDeLive.jsx';
import { useSaudeDoObs } from './useSaudeDoObs.js';
import { lerConfig } from './configuracoes.js';
import { estadoInicialDasLives, aplicarEventoDeLive, totalDeEspectadores, estaNoAr, estadoDoObs } from './lives.js';

const ATUALIZACAO_MS = 15000; // de quanto em quanto tempo relê as ações e as plataformas conectadas
const PAINEIS = [
  { id: 'predefinicoes', nome: 'Predefinições', dica: 'Predefinições de live: título, categoria e tags num clique' },
  { id: 'live', nome: 'Live', dica: 'Título e categoria' },
  { id: 'tags', nome: 'Tags e descrição', dica: 'Tags (#) da Twitch e, se ligado nas configurações, tags e descrição do YouTube' },
  { id: 'momentos', nome: 'Momentos', dica: 'Marcação de momentos da live' },
  { id: 'modos', nome: 'Modos do chat', dica: 'Só emotes, modo lento, só seguidores e só inscritos (Twitch)' },
  { id: 'inter', nome: 'Enquetes e previsões', dica: 'Enquetes e previsões da Twitch' },
  { id: 'chat', nome: 'Chat', dica: 'Chat e moderação' },
  { id: 'saude', nome: 'Saúde do OBS', dica: 'fps, CPU e rede do OBS e o estado da live' },
  { id: 'multistream', nome: 'Painel de Multistream', dica: 'fps, CPU e rede do OBS e os botões Iniciar e Parar lives' },
];

export default function App() {
  const [conectado, setConectado] = useState(false);
  const [recusa, setRecusa] = useState(null);       // motivo, se o Streamer.bot recusou a conexão
  const [conectadas, setConectadas] = useState([]); // plataformas conectadas no Streamer.bot
  const [nomesDeAcoes, setNomesDeAcoes] = useState(null); // null = ainda não carregou
  const [ativas, setAtivas] = useState(() => ({ twitch: true, kick: true, youtube: true, ...ler('ativas', {}) }));
  const config = lerConfig(); // relida a cada desenho: ao voltar das configurações já vale o que foi mudado
  const micAtivo = config.mic.ligado && Boolean(config.mic.entrada.trim());
  const saude = useSaudeDoObs(config.saude.ligada || config.multistream.ligado || micAtivo, config.obs.url, config.obs.senha, micAtivo ? config.mic.entrada.trim() : ''); // a leitura do OBS vale pra linha de saúde, pros botões e pro tempo
  const [lives, setLives] = useState(estadoInicialDasLives); // espectadores e início da live de cada plataforma (lives.js)
  const [agora, setAgora] = useState(Date.now());
  const estadoObsAnterior = useRef(null);

  useEffect(() => assinarStreamerbot(ev => {
    if (ev.tipo === 'conexao') {
      setConectado(ev.aberta);
      if (ev.aberta) setRecusa(null);
      else { setConectadas([]); setNomesDeAcoes(null); }
    } else if (ev.tipo === 'recusada') {
      setRecusa(ev.erro);
    } else if (ev.tipo === 'atualizacao') {
      notificarAtualizacao(ev);
    } else if (ev.tipo === 'espectadores' || ev.tipo === 'transmissao') {
      setLives(estado => aplicarEventoDeLive(estado, ev));
      if (ev.tipo === 'transmissao' && ev.plataforma === 'youtube' && ev.aoVivo) youtubeComecou(); // aplica o título que ficou esperando a live
    }
  }), []);

  // o total de espectadores deixa de contar quem parou de avisar
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

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

  // Quando o OBS começa ou para de transmitir, o estado das plataformas recomeça do zero: assim um início de live antigo não aparece na próxima.
  const obsAgora = estadoDoObs(saude);
  useEffect(() => {
    if (obsAgora === 'desconhecida') return;
    if (estadoObsAnterior.current !== null && estadoObsAnterior.current !== obsAgora) setLives(estadoInicialDasLives());
    estadoObsAnterior.current = obsAgora;
  }, [obsAgora]);

  const [menuPaineis, setMenuPaineis] = useState(false);
  const [paineis, setPaineis] = useState(() => ({ predefinicoes: true, live: true, tags: true, momentos: true, modos: true, inter: false, chat: true, saude: true, multistream: true, ...ler('paineis', {}) }));
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

  // O OBS manda no "no ar": com a leitura dele parada, nenhuma plataforma conta tempo nem espectadores, mesmo que o último aviso dela seja recente
  // (a Kick e o YouTube nem sempre avisam o fim). Sem leitura do OBS, vale o que as plataformas avisaram.
  const estadoObs = estadoDoObs(saude);
  const obsParado = estadoObs === 'parada';
  const espectadores = obsParado ? { total: null, porPlataforma: {} } : totalDeEspectadores(lives, agora);
  const linhasDeEspectadores = PLATAFORMAS_DO_DOCK.filter(id => espectadores.porPlataforma[id] !== undefined);
  // O tempo de cada plataforma. A Twitch sai pelo botão nativo do OBS: vale o início da transmissão principal e, de reserva, o que a própria
  // Twitch informou e o tempo dos destinos do multistream. YouTube e Kick (destinos do multistream): o início que informam e, de reserva, o dos
  // destinos e o da principal (todos começam juntos).
  const obsLigado = Boolean(saude && saude.conectado);
  const inicioPrincipalMs = obsLigado && saude.principalAtiva ? saude.lidoEm - saude.msPrincipal : null;
  const inicioDestinosMs = obsLigado && saude.msDestinos > 0 ? saude.lidoEm - saude.msDestinos : null;
  // O YouTube e a Kick só avisam no começo e a cada mudança: quem abriu o dock com a live já no ar pode não receber aviso nenhum, então os
  // destinos do multistream que estão no ar no OBS também valem como "no ar".
  const tempoDaPlataforma = id => (obsParado ? { noAr: false, inicioMs: null } : id === 'twitch'
    ? { noAr: Boolean(inicioPrincipalMs) || estaNoAr(lives.twitch, agora), inicioMs: inicioPrincipalMs || lives.twitch.inicioMs || inicioDestinosMs }
    : { noAr: estaNoAr(lives[id], agora) || Boolean(inicioDestinosMs), inicioMs: lives[id].inicioMs || inicioDestinosMs || inicioPrincipalMs });

  const aviso = recusa
    ? `O Streamer.bot recusou a conexão (${recusa}). Confira a senha nas configurações (bolinha de estado).`
    : !conectado ? 'Streamer.bot desconectado: abra-o e ligue o WebSocket Server.' : null;

  return (
    <div id="dock">
      <header className={`barra${micAtivo ? ' barra-com-mic' : ''}`}>
        <button type="button" id="plataformas-todas" className={`global${todasAtivas ? ' global-ligado' : ''}`} aria-pressed={todasAtivas}
                title={todasAtivas ? 'Desativar todas as plataformas' : 'Ativar todas as plataformas'} onClick={alternarTodas}>
          <D20Ambar aceso={todasAtivas} largura={19} />
        </button>
        <div className="plataformas" role="group" aria-label="Plataformas ativas">
          {PLATAFORMAS_DO_DOCK.map(id => {
            const ligada = conectadas.includes(id);
            const tempo = tempoDaPlataforma(id);
            return (
              <button key={id} type="button" id={`plataforma-${id}`} className={`plataforma${ativas[id] ? ' plataforma-ativa' : ''}`} aria-pressed={!!ativas[id]}
                      style={{ '--cor-plataforma': PLATAFORMAS[id].cor }}
                      title={`${NOME_DA_PLATAFORMA[id]} · ${ligada ? 'conectada' : 'sem conexão'} · ${ativas[id] ? 'ativa: vale para atualizar a live e enviar mensagens' : 'desligada'}`}
                      onClick={() => alternar(id)}>
                <IconePlataforma id={id} tamanho={12} />
                <TempoDeLive inicioMs={tempo.inicioMs} noAr={tempo.noAr} />
                <span className={`ponto${ligada ? ' ponto-ligado' : ''}`} />
              </button>
            );
          })}
        </div>
        <span className="espectadores" id="espectadores-total" tabIndex={0}>
          👁 {espectadores.total ?? 0}
          {linhasDeEspectadores.length > 0 && (
            <span className="espectadores-detalhe" id="espectadores-detalhe">
              {linhasDeEspectadores.map(id => (
                <span key={id} className="espectadores-linha" style={{ '--cor-plataforma': PLATAFORMAS[id].cor }}>
                  <IconePlataforma id={id} tamanho={14} />{espectadores.porPlataforma[id]}
                </span>
              ))}
            </span>
          )}
        </span>
        {micAtivo && <BotaoMic saude={saude} obs={config.obs} entrada={config.mic.entrada.trim()} />}
        <button type="button" id="paineis-botao" className="bolinha-paineis" aria-expanded={menuPaineis} title="Painéis: mostrar ou esconder" aria-label="Painéis"
                onClick={e => { e.stopPropagation(); setMenuPaineis(a => !a); }} />
        <button type="button" className={`estado estado-${estado}`} id="estado-conexao" title={`${dicaDoEstado} · clique para abrir as configurações`} aria-label="Configurações"
                aria-pressed={configAberta} onClick={() => { setMenuPaineis(false); setConfigAberta(a => !a); }} />
        {menuPaineis && (
          <div className="menu-paineis" id="menu-paineis" role="menu" onClick={e => e.stopPropagation()}>
            {PAINEIS.filter(p => (p.id !== 'multistream' || config.multistream.ligado) && (p.id !== 'saude' || config.saude.ligada)
              && (p.id !== 'predefinicoes' || config.presets.ligado) && (p.id !== 'modos' || config.modosDoChat.ligado)).map(p => (
              <label key={p.id} className="painel-opcao" title={p.dica}>
                <input type="checkbox" id={`painel-chave-${p.id}`} checked={!!paineis[p.id]} onChange={() => alternarPainel(p.id)} />
                {p.nome}
              </label>
            ))}
          </div>
        )}
      </header>
      {config.saude.ligada && paineis.saude && <SaudeDoObs saude={saude} />}
      {aviso && <p className="aviso aviso-faixa" id="aviso-conexao">{aviso}</p>}
      <AvisoAnuncio nomesDeAcoes={nomesDeAcoes} />
      {configAberta ? <Configuracoes conectado={conectado} recusa={recusa} onVoltar={() => setConfigAberta(false)} /> : (
        <>
          {config.presets.ligado && paineis.predefinicoes && <Predefinicoes ativas={ativas} conectado={conectado} nomesDeAcoes={nomesDeAcoes} />}
          {paineis.live && <LivePanel ativas={ativas} conectado={conectado} nomesDeAcoes={nomesDeAcoes} />}
          {paineis.tags && <Tags ativas={ativas} conectado={conectado} nomesDeAcoes={nomesDeAcoes} />}
          {paineis.momentos && <Momentos conectado={conectado} nomesDeAcoes={nomesDeAcoes} ativas={ativas} />}
          {config.modosDoChat.ligado && paineis.modos && <ModosDoChat ativas={ativas} conectado={conectado} nomesDeAcoes={nomesDeAcoes} />}
          {paineis.inter && <Interacoes ativas={ativas} conectado={conectado} />}
        </>
      )}
      {paineis.chat && <ChatPanel ativas={ativas} conectado={conectado} oculto={configAberta} />}
      {!configAberta && config.multistream.ligado && paineis.multistream && <PainelMultistream saude={saude} obs={config.obs} />}
    </div>
  );
}
