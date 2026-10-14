// Configurações do dock, abertas pela bolinha de estado: aparência (acento e fundo), a conexão com o
// Streamer.bot, a conexão com o OBS (o tempo da Marcação de momentos) e a própria marcação. Cada seção grava na hora, menos as
// conexões, que têm Salvar. Novas opções entram como novas seções.
import { useState } from 'react';
import { ACENTOS, FUNDOS, aplicarTema, gravarSecao, lerConfig, pastaPadraoDosClipes } from './configuracoes.js';
import { reconectarStreamerbot } from './streamerbot.js';
import { tempoDoOBS, formatarTempo } from './obs.js';

export default function Configuracoes({ conectado, recusa, onVoltar }) {
  const [config, setConfig] = useState(lerConfig);
  const [sb, setSb] = useState(config.streamerbot);
  const [obs, setObs] = useState(config.obs);
  const [testeObs, setTesteObs] = useState(null); // { nivel, texto }
  const [testando, setTestando] = useState(false);
  const padraoDaPasta = pastaPadraoDosClipes();

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
    </section>
  );
}
