// Marcação de momentos: um clique anota o tempo da live num arquivo de texto, "Clipes - <título da live>.txt", com uma linha
// por marcação ("Clipe 3 - 00:12:34", ou "<título> - 00:12:34" quando o título de clipe está ligado nas configurações). O
// tempo vem do OBS (obs.js) e quem escreve o arquivo é a ação `Painel: Momentos` do Streamer.bot (um navegador não grava em
// disco). A numeração e a lista da sessão ficam lembradas por arquivo.
import { useState } from 'react';
import { ler, gravar } from './armazenamento.js';
import { lerConfig, pastaPadraoDosClipes } from './configuracoes.js';
import { pastaDeClipesValida } from './pastaClipes.js';
import { tempoDoOBS, formatarTempo } from './obs.js';
import { registrarMomento, temAcaoDeMomentos, NOME_DA_ACAO_DE_MOMENTOS } from './acoes.js';

const MAX_LISTA = 40;
const MARCA = ['✓', '!', '✕'];

// "Clipes - <título da live>": sem título, "Clipes - Sem título".
const nomeDoArquivo = titulo => `Clipes - ${titulo.trim() || 'Sem título'}`;

export default function Momentos({ conectado, nomesDeAcoes }) {
  const [recolhido, setRecolhido] = useState(() => ler('momentosRecolhido', false));
  const [titulo, setTitulo] = useState('');
  const [marcando, setMarcando] = useState(false);
  const [resultado, setResultado] = useState(null); // { nivel, texto }
  const [versao, setVersao] = useState(0);          // força reler a lista gravada
  const config = lerConfig();
  const arquivo = nomeDoArquivo(ler('titulo', ''));
  const lista = ler(`momentos.${arquivo}`, []);
  const faltaAcao = nomesDeAcoes && !temAcaoDeMomentos(nomesDeAcoes);
  const pode = conectado && !marcando && !faltaAcao && nomesDeAcoes !== null;

  function alternarRecolhido() {
    gravar('momentosRecolhido', !recolhido);
    setRecolhido(!recolhido);
  }

  async function marcar() {
    if (!pode) return;
    setMarcando(true);
    setResultado(null);
    const cfg = lerConfig();
    const pasta = cfg.momentos.pasta.trim() || pastaPadraoDosClipes();
    if (!pastaDeClipesValida(pasta)) {
      setResultado({ nivel: 2, texto: 'A pasta dos clipes precisa ser um caminho completo de uma unidade local, como C:\\Clipes (veja as configurações).' });
      setMarcando(false);
      return;
    }
    const nomeAtual = nomeDoArquivo(ler('titulo', ''));
    const tempo = await tempoDoOBS(cfg.obs);
    if (!tempo.ok) {
      setResultado({ nivel: 2, texto: tempo.erro });
      setMarcando(false);
      return;
    }
    const numero = ler(`contador.${nomeAtual}`, 0) + 1;
    const escrito = cfg.momentos.tituloDeClipe ? titulo.trim() : '';
    const linha = `${escrito || `Clipe ${numero}`} - ${formatarTempo(tempo.ms)}`;
    const erro = await registrarMomento({ linha, arquivo: nomeAtual, pasta });
    if (erro) {
      setResultado({ nivel: 2, texto: erro });
    } else {
      gravar(`contador.${nomeAtual}`, numero);
      gravar(`momentos.${nomeAtual}`, [linha, ...ler(`momentos.${nomeAtual}`, [])].slice(0, MAX_LISTA));
      setResultado({ nivel: 0, texto: `${linha} (${tempo.origem})` });
      setTitulo('');
      setVersao(v => v + 1);
    }
    setMarcando(false);
  }

  function limparLista() {
    gravar(`momentos.${arquivo}`, []);
    setVersao(v => v + 1);
  }

  const tecla = e => { if (e.key === 'Enter') marcar(); };

  return (
    <section className="cartao" id="painel-momentos" data-versao={versao}>
      <button type="button" className="cabecalho" onClick={alternarRecolhido} aria-expanded={!recolhido}>
        <span className="seta">{recolhido ? '▸' : '▾'}</span>
        <span className="titulo-painel">Momentos</span>
        {recolhido && lista.length > 0 && <span className="resumo">{lista[0]}</span>}
      </button>
      {!recolhido && (
        <div className="corpo-live">
          {config.momentos.tituloDeClipe && (
            <input id="campo-titulo-clipe" type="text" value={titulo} placeholder={`Título do clipe (vazio: Clipe ${ler(`contador.${arquivo}`, 0) + 1})`}
                   spellCheck onChange={e => setTitulo(e.target.value)} onKeyDown={tecla} />
          )}
          <button type="button" id="botao-marcar" className="primario" disabled={!pode} onClick={marcar}>{marcando ? 'Marcando…' : 'Marcar momento'}</button>
          <p className="dica" id="arquivo-momentos">Arquivo: {arquivo}.txt</p>
          {faltaAcao && <p className="aviso">Falta a ação “{NOME_DA_ACAO_DE_MOMENTOS}” no Streamer.bot (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”).</p>}
          {resultado && <p className={`resultado-teste nivel-${resultado.nivel}`} id="resultado-momento">{MARCA[resultado.nivel]} {resultado.texto}</p>}
          {lista.length > 0 && (
            <>
              <ul className="lista-momentos" id="lista-momentos">
                {lista.map((l, i) => <li key={`${l}-${i}`}>{l}</li>)}
              </ul>
              <button type="button" className="link" onClick={limparLista}>Limpar a lista (o arquivo não muda)</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
