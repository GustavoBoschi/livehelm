// Configurações do dock, abertas pela bolinha de estado: aparência (acento e fundo), a conexão com o
// Streamer.bot, a conexão com o OBS (o tempo da Marcação de momentos) e a própria marcação. Cada seção grava na hora, menos as
// conexões, que têm Salvar. Novas opções entram como novas seções.
import { useState } from 'react';
import { ACENTOS, FUNDOS, aplicarTema, gravarSecao, lerConfig, pastaPadraoDosClipes } from './configuracoes.js';
import { reconectarStreamerbot } from './streamerbot.js';
import { tempoDoOBS, formatarTempo } from './obs.js';
import { listarEntradasDoObs } from './obsSaude.js';
import { ler, gravar } from './armazenamento.js';
import { CATEGORIAS_DO_YOUTUBE, REGRAS_PADRAO_DO_YOUTUBE } from './titulos.js';
import { testarAvisoDeAnuncio } from './AvisoAnuncio.jsx';
import { NOME_DA_ACAO_DE_ANUNCIO, canalLido } from './acoes.js';
import { ALERTAS_NO_CHAT_GERAL, TIPOS_DE_ALERTA, apareceNoChatGeral } from './alertas.js';

export default function Configuracoes({ conectado, recusa, onVoltar }) {
  const [config, setConfig] = useState(lerConfig);
  const [sb, setSb] = useState(config.streamerbot);
  const [obs, setObs] = useState(config.obs);
  const [testeObs, setTesteObs] = useState(null); // { nivel, texto }
  const [testando, setTestando] = useState(false);
  const [entradas, setEntradas] = useState(null);    // as entradas do OBS listadas para escolher o microfone ({ nome, tipo }); null = ainda não listadas
  const [listando, setListando] = useState(false);
  const [erroEntradas, setErroEntradas] = useState('');
  const [alertasAbertos, setAlertasAbertos] = useState(() => ler('configAlertasAberto', false)); // a lista de alertas é comprida: vem recolhida
  const padraoDaPasta = pastaPadraoDosClipes();
  const canal = canalLido();
  const semPontosDeCanal = canal && canal.afiliado === false && canal.parceiro === false; // sem afiliação não existem resgates de pontos do canal

  function mudarTema(parte) {
    const tema = { ...config.tema, ...parte };
    aplicarTema(tema);
    gravarSecao('tema', tema);
    setConfig({ ...config, tema });
  }
  function mudarMomentos(parte) {
    const momentos = { ...config.momentos, ...parte };
    gravarSecao('momentos', momentos);
    setConfig({ ...config, momentos });
  }
  // Guarda só o que difere do padrão, então um tipo novo de alerta segue o padrão sem o usuário fazer nada.
  function mudarAlerta(id, ligado) {
    const escolhas = { ...config.alertasNoChat.escolhas };
    if (ligado === ALERTAS_NO_CHAT_GERAL.has(id)) delete escolhas[id];
    else escolhas[id] = ligado;
    const alertasNoChat = { ...config.alertasNoChat, escolhas };
    gravarSecao('alertasNoChat', alertasNoChat);
    setConfig({ ...config, alertasNoChat });
  }
  function voltarAoPadraoDosAlertas() {
    const alertasNoChat = { ...config.alertasNoChat, escolhas: {} };
    gravarSecao('alertasNoChat', alertasNoChat);
    setConfig({ ...config, alertasNoChat });
  }
  function mudarAnuncio(parte) {
    const anuncio = { ...config.anuncio, ...parte };
    gravarSecao('anuncio', anuncio);
    setConfig({ ...config, anuncio });
  }
  function mudarYoutube(parte) {
    const youtube = { ...config.youtube, ...parte };
    gravarSecao('youtube', youtube);
    setConfig({ ...config, youtube });
  }
  // As regras da categoria do YouTube: cada linha tem as palavras que a identificam e a categoria, escolhida numa lista (nunca digitada).
  const mudarRegra = (i, parte) => mudarYoutube({ regras: config.youtube.regras.map((r, j) => (j === i ? { ...r, ...parte } : r)) });
  const apagarRegra = i => mudarYoutube({ regras: config.youtube.regras.filter((_, j) => j !== i) });
  const novaRegra = () => mudarYoutube({ regras: [...config.youtube.regras, { palavras: '', categoria: 'Entertainment' }] });
  const regrasDeFabrica = () => mudarYoutube({ regras: REGRAS_PADRAO_DO_YOUTUBE.map(r => ({ ...r })) });
  function mudarSaude(parte) {
    const saude = { ...config.saude, ...parte };
    gravarSecao('saude', saude);
    setConfig({ ...config, saude });
  }
  // Painéis e botões novos (predefinições, modos do chat, clipe e microfone): cada um tem a sua seção e vem desligado.
  function mudarSecao(secao, parte) {
    const valores = { ...config[secao], ...parte };
    gravarSecao(secao, valores);
    setConfig({ ...config, [secao]: valores });
  }
  async function listarEntradas() {
    setListando(true);
    setErroEntradas('');
    const r = await listarEntradasDoObs(salvarObs());
    if (r.ok) setEntradas(r.entradas);
    else setErroEntradas(r.erro);
    setListando(false);
  }
  function alternarAlertas() {
    gravar('configAlertasAberto', !alertasAbertos);
    setAlertasAbertos(!alertasAbertos);
  }
  const todosOsAlertas = TIPOS_DE_ALERTA.flatMap(g => g.itens);
  const alertasNaAbaTudo = todosOsAlertas.filter(i => apareceNoChatGeral(i.id, config.alertasNoChat.escolhas)).length;
  function mudarMultistream(parte) {
    const multistream = { ...config.multistream, ...parte };
    gravarSecao('multistream', multistream);
    setConfig({ ...config, multistream });
  }
  function salvarStreamerbot() {
    const valores = { url: sb.url.trim() || config.streamerbot.url, senha: sb.senha };
    gravarSecao('streamerbot', valores);
    setConfig({ ...config, streamerbot: valores });
    reconectarStreamerbot();
  }
  function salvarObs() {
    const valores = { url: obs.url.trim() || config.obs.url, senha: obs.senha };
    gravarSecao('obs', valores);
    setConfig({ ...config, obs: valores });
    return valores;
  }
  async function testarObs() {
    const valores = salvarObs();
    setTestando(true);
    setTesteObs(null);
    const r = await tempoDoOBS(valores);
    setTesteObs(r.ok ? { nivel: 0, texto: `OBS conectado: ${r.origem} em ${formatarTempo(r.ms)}` } : { nivel: 2, texto: r.erro });
    setTestando(false);
  }

  const estadoSb = recusa ? `recusou a conexão (${recusa})` : conectado ? 'conectado' : 'desconectado';
  const placar = ['✓', '!', '✕'];

  return (
    <section className="cartao configuracoes" id="painel-configuracoes">
      <div className="config-topo">
        <button type="button" className="link" id="config-voltar" onClick={onVoltar}>← Voltar</button>
        <span className="titulo-painel">Configurações</span>
      </div>

      <div className="config-secao">
        <h3>Aparência</h3>
        <div className="rotulo">Cor de destaque</div>
        <div className="amostras" role="group" aria-label="Cor de destaque">
          {ACENTOS.map(a => (
            <button key={a.hex} type="button" className={`amostra${config.tema.acento.toLowerCase() === a.hex.toLowerCase() ? ' amostra-ativa' : ''}`}
                    style={{ background: a.hex }} title={a.nome} aria-label={a.nome} aria-pressed={config.tema.acento.toLowerCase() === a.hex.toLowerCase()}
                    onClick={() => mudarTema({ acento: a.hex })} />
          ))}
        </div>
        <div className="rotulo">Fundo</div>
        <div className="amostras" role="group" aria-label="Fundo">
          {Object.keys(FUNDOS).map(nome => (
            <button key={nome} type="button" className={`amostra-fundo${config.tema.fundo === nome ? ' amostra-ativa' : ''}`}
                    style={{ background: FUNDOS[nome][1], borderColor: FUNDOS[nome][4] }} aria-pressed={config.tema.fundo === nome}
                    onClick={() => mudarTema({ fundo: nome })}>{nome}</button>
          ))}
        </div>
      </div>

      <div className="config-secao">
        <h3>Streamer.bot <span className={`estado-texto estado-texto-${conectado && !recusa ? 'ok' : 'erro'}`}>{estadoSb}</span></h3>
        <label className="rotulo" htmlFor="config-sb-url">Endereço do servidor WebSocket</label>
        <input id="config-sb-url" type="text" value={sb.url} spellCheck={false} placeholder="ws://127.0.0.1:8080" onChange={e => setSb({ ...sb, url: e.target.value })} />
        <label className="rotulo" htmlFor="config-sb-senha">Senha</label>
        <input id="config-sb-senha" type="password" value={sb.senha} autoComplete="off" onChange={e => setSb({ ...sb, senha: e.target.value })} />
        <button type="button" id="config-sb-salvar" className="primario" onClick={salvarStreamerbot}>Salvar e reconectar</button>
      </div>

      <div className="config-secao">
        <h3>OBS</h3>
        <label className="rotulo" htmlFor="config-obs-url">Endereço</label>
        <input id="config-obs-url" type="text" value={obs.url} spellCheck={false} placeholder="ws://127.0.0.1:4455" onChange={e => setObs({ ...obs, url: e.target.value })} />
        <label className="rotulo" htmlFor="config-obs-senha">Senha</label>
        <input id="config-obs-senha" type="password" value={obs.senha} autoComplete="off" onChange={e => setObs({ ...obs, senha: e.target.value })} />
        <button type="button" id="config-obs-testar" className="primario" disabled={testando} onClick={testarObs}>{testando ? 'Testando…' : 'Salvar e testar'}</button>
        {testeObs && <p className={`resultado-teste nivel-${testeObs.nivel}`} id="config-obs-resultado">{placar[testeObs.nivel]} {testeObs.texto}</p>}
      </div>

      <div className="config-secao">
        <h3>Marcação de momentos</h3>
        <label className="opcao-linha" htmlFor="config-titulo-clipe">
          <input id="config-titulo-clipe" type="checkbox" checked={config.momentos.tituloDeClipe} onChange={e => mudarMomentos({ tituloDeClipe: e.target.checked })} />
          Dar título a cada clipe
        </label>
        <label className="rotulo" htmlFor="config-pasta">Pasta dos arquivos de clipes</label>
        <input id="config-pasta" type="text" value={config.momentos.pasta} spellCheck={false} placeholder={padraoDaPasta || 'Documentos\\LiveHelm\\Clipes'}
               onChange={e => mudarMomentos({ pasta: e.target.value })} />
      </div>

      <div className="config-secao" id="config-alertas">
        <h3>
          <button type="button" id="config-alertas-recolher" className="config-recolher" aria-expanded={alertasAbertos} onClick={alternarAlertas}>
            <span className="seta">{alertasAbertos ? '▾' : '▸'}</span> Alertas no chat
          </button>
          {!alertasAbertos && <span className="resumo" id="config-alertas-resumo">{alertasNaAbaTudo} de {todosOsAlertas.length} na aba Tudo</span>}
        </h3>
        {alertasAbertos && <>
        <p className="dica">A aba <b>Alertas</b> mostra todos os alertas, sempre. Marque os que também devem aparecer na aba <b>Tudo</b> e nas abas de cada plataforma.</p>
        {semPontosDeCanal && <p className="dica" id="aviso-sem-afiliacao">O seu canal da Twitch ainda não é afiliado nem parceiro: a Twitch só libera os pontos do canal (e por isso os resgates e os alertas deles) para afiliados e parceiros.</p>}
        {TIPOS_DE_ALERTA.map(g => (
          <div key={g.grupo} className="alertas-grupo">
            <div className="rotulo">{g.grupo}</div>
            {g.itens.map(i => (
              <label key={i.id} className="opcao-linha" htmlFor={`config-alerta-${i.id}`}>
                <input id={`config-alerta-${i.id}`} type="checkbox" checked={apareceNoChatGeral(i.id, config.alertasNoChat.escolhas)} onChange={e => mudarAlerta(i.id, e.target.checked)} />
                {i.nome}
              </label>
            ))}
          </div>
        ))}
        <button type="button" id="config-alertas-padrao" className="link" onClick={voltarAoPadraoDosAlertas}>Voltar ao padrão</button>
        </>}
      </div>

      <div className="config-secao">
        <h3>YouTube</h3>
        <span className="rotulo">Trocar a categoria conforme a live</span>
        <div className="regras-youtube" id="regras-youtube">
          {config.youtube.regras.map((r, i) => (
            <div key={i} className={`regra-youtube${r.jogos ? ' regra-youtube-jogos' : ''}`}>
              <input type="text" className="regra-palavras" value={r.palavras} spellCheck={false} aria-label={r.jogos ? 'Nomes de jogos' : 'Palavras da regra'}
                     placeholder={r.jogos ? 'Qualquer jogo (ou nomes: Marvel Rivals, Minecraft…)' : 'Palavras: Just Chatting, Conversando…'}
                     onChange={e => mudarRegra(i, { palavras: e.target.value })} />
              <div className="regra-youtube-linha">
                <span className="regra-igual">=</span>
                <select value={r.categoria} aria-label="Categoria do YouTube" onChange={e => mudarRegra(i, { categoria: e.target.value })}>
                  {!CATEGORIAS_DO_YOUTUBE.some(c => c.nome === r.categoria) && <option value={r.categoria}>{r.categoria}</option>}
                  {CATEGORIAS_DO_YOUTUBE.map(c => <option key={c.nome} value={c.nome}>{c.rotulo}</option>)}
                </select>
                {!r.jogos && <button type="button" className="atalho-remove regra-apagar" onClick={() => apagarRegra(i)} title="Apagar esta regra" aria-label="Apagar esta regra">✕</button>}
              </div>
            </div>
          ))}
        </div>
        <div className="linha-botoes">
          <button type="button" className="link" id="regra-nova" onClick={novaRegra}>+ Nova regra</button>
          <button type="button" className="link" id="regras-padrao" onClick={regrasDeFabrica}>Voltar ao padrão</button>
        </div>
        <label className="opcao-linha" htmlFor="config-youtube-info-ligado">
          <input id="config-youtube-info-ligado" type="checkbox" checked={config.youtubeInfo.ligado} onChange={e => mudarSecao('youtubeInfo', { ligado: e.target.checked })} />
          Mostrar tags e descrição do YouTube no painel Tags
        </label>
      </div>

      <div className="config-secao">
        <h3>Predefinições de live</h3>
        <label className="opcao-linha" htmlFor="config-presets-ligado">
          <input id="config-presets-ligado" type="checkbox" checked={config.presets.ligado} onChange={e => mudarSecao('presets', { ligado: e.target.checked })} />
          Usar predefinições de live
        </label>
      </div>

      <div className="config-secao">
        <h3>Modos do chat (Twitch)</h3>
        <label className="opcao-linha" htmlFor="config-modos-ligado">
          <input id="config-modos-ligado" type="checkbox" checked={config.modosDoChat.ligado} onChange={e => mudarSecao('modosDoChat', { ligado: e.target.checked })} />
          Usar os modos do chat
        </label>
        <p className="dica">Mostra o painel <b>Modos do chat</b>, com só emotes, modo lento, só seguidores e só inscritos num toque.</p>
        {config.modosDoChat.ligado && <>
        <label className="rotulo" htmlFor="config-modos-lento">Tempo entre mensagens no modo lento</label>
        <select id="config-modos-lento" value={config.modosDoChat.lentoSegundos} onChange={e => mudarSecao('modosDoChat', { lentoSegundos: Number(e.target.value) })}>
          {[3, 5, 10, 15, 30, 60, 120].map(s => <option key={s} value={s}>{s} segundos</option>)}
        </select>
        <label className="rotulo" htmlFor="config-modos-seguidores">Só seguidores: seguindo há pelo menos</label>
        <select id="config-modos-seguidores" value={config.modosDoChat.seguidoresMinutos} onChange={e => mudarSecao('modosDoChat', { seguidoresMinutos: Number(e.target.value) })}>
          {[[0, 'qualquer tempo (todos os seguidores)'], [10, '10 minutos'], [30, '30 minutos'], [60, '1 hora'], [1440, '1 dia'], [10080, '1 semana'], [43200, '1 mês']].map(([m, t]) => <option key={m} value={m}>{t}</option>)}
        </select>
        </>}
      </div>

      <div className="config-secao">
        <h3>Clipe da Twitch</h3>
        <label className="opcao-linha" htmlFor="config-clipe-ligado">
          <input id="config-clipe-ligado" type="checkbox" checked={config.clipe.ligado} onChange={e => mudarSecao('clipe', { ligado: e.target.checked })} />
          Mostrar o botão de clipe no painel Momentos
        </label>
        {config.clipe.ligado && <>
        <label className="rotulo" htmlFor="config-clipe-duracao">Duração do clipe</label>
        <select id="config-clipe-duracao" value={config.clipe.duracao} onChange={e => mudarSecao('clipe', { duracao: Number(e.target.value) })}>
          {[15, 30, 45, 60].map(s => <option key={s} value={s}>{s} segundos</option>)}
        </select>
        </>}
      </div>

      <div className="config-secao">
        <h3>Mudo do microfone</h3>
        <label className="opcao-linha" htmlFor="config-mic-ligado">
          <input id="config-mic-ligado" type="checkbox" checked={config.mic.ligado} onChange={e => mudarSecao('mic', { ligado: e.target.checked })} />
          Mostrar o botão de mudo do microfone
        </label>
        {config.mic.ligado && <>
        <label className="rotulo" htmlFor="config-mic-entrada">Entrada do microfone no OBS</label>
        <input id="config-mic-entrada" type="text" value={config.mic.entrada} placeholder="Mic/Aux" spellCheck={false} onChange={e => mudarSecao('mic', { entrada: e.target.value })} />
        <div className="linha-botoes">
          <button type="button" id="config-mic-listar" onClick={listarEntradas} disabled={listando}>{listando ? 'Lendo o OBS…' : 'Listar as entradas do OBS'}</button>
        </div>
        {entradas && entradas.length > 0 && (
          <select id="config-mic-escolher" value="" onChange={e => { if (e.target.value) mudarSecao('mic', { entrada: e.target.value, ligado: true }); }}>
            <option value="">Escolha o microfone…</option>
            {entradas.map(i => <option key={i.nome} value={i.nome}>{i.nome}{i.tipo ? ` (${i.tipo})` : ''}</option>)}
          </select>
        )}
        {entradas && entradas.length === 0 && <p className="aviso">O OBS não tem nenhuma entrada de áudio.</p>}
        {erroEntradas && <p className="resultado-teste nivel-2">✕ {erroEntradas}</p>}
        {!config.mic.entrada.trim() && <p className="aviso">Escolha a entrada do microfone para o botão aparecer.</p>}
        </>}
      </div>

      <div className="config-secao">
        <h3>Saúde do OBS</h3>
        <label className="opcao-linha" htmlFor="config-saude-ligada">
          <input id="config-saude-ligada" type="checkbox" checked={config.saude.ligada} onChange={e => mudarSaude({ ligada: e.target.checked })} />
          Mostrar fps, CPU e rede do OBS no alto
        </label>
      </div>

      <div className="config-secao">
        <h3>Painel de Multistream</h3>
        <label className="opcao-linha" htmlFor="config-multistream-ligado">
          <input id="config-multistream-ligado" type="checkbox" checked={config.multistream.ligado} onChange={e => mudarMultistream({ ligado: e.target.checked })} />
          Usar o Painel de Multistream
        </label>
      </div>

      <div className="config-secao">
        <h3>Aviso de anúncio (Twitch)</h3>
        <label className="opcao-linha" htmlFor="config-anuncio-ligado">
          <input id="config-anuncio-ligado" type="checkbox" checked={config.anuncio.ligado} onChange={e => mudarAnuncio({ ligado: e.target.checked })} />
          Avisar antes de cada anúncio
        </label>
        <label className="rotulo" htmlFor="config-anuncio-antecedencia">Avisar quando faltarem</label>
        <select id="config-anuncio-antecedencia" value={config.anuncio.antecedencia} onChange={e => mudarAnuncio({ antecedencia: Number(e.target.value) })}>
          {[15, 30, 45, 60].map(s => <option key={s} value={s}>{s} segundos</option>)}
        </select>
        <p className="dica">O botão <b>Adiar 5 min</b> precisa da ação <b>{NOME_DA_ACAO_DE_ANUNCIO}</b> no Streamer.bot (veja as Instruções).</p>
        <button type="button" id="config-anuncio-testar" className="primario" onClick={testarAvisoDeAnuncio}>Testar o aviso</button>
      </div>
    </section>
  );
}
