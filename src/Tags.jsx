// Tags (#) da live, só da Twitch (o Streamer.bot 1.0.7 não muda tags na Kick nem no YouTube). O painel mostra as tags que o canal
// tem agora, lidas pela ação `Painel: Tags`; excluir e adicionar mexem só na lista em edição, e o Aplicar manda a lista final
// (as tags não entram no Confirmar de título e categoria).
import { useEffect, useState } from 'react';
import { ler, gravar } from './armazenamento.js';
import { definirTags, lerTags, temAcaoDeTags, NOME_DA_ACAO_DE_TAGS } from './acoes.js';
import { adicionarTags, limparTags, mesmasTags, removerTag } from './tagsLista.js';
import { IconePlataforma } from './Icones.jsx';
import { PLATAFORMAS } from './plataformas.js';
import { lerConfig } from './configuracoes.js';
import YoutubeInfo from './YoutubeInfo.jsx';
import { EVENTO_DAS_TAGS } from './predefinicoes.js';

const MARCA = ['✓', '!', '✕']; // por nivel: ok, aviso, erro
const MAX_TAGS = 10;

export default function Tags({ ativas, conectado, nomesDeAcoes }) {
  const [recolhido, setRecolhido] = useState(() => ler('tagsRecolhido', false));
  const [noCanal, setNoCanal] = useState(null);  // tags que a Twitch tem; null = ainda não lidas
  const [rascunho, setRascunho] = useState([]);  // lista em edição
  const [texto, setTexto] = useState('');
  const [lendo, setLendo] = useState(false);
  const [erroLeitura, setErroLeitura] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { nivel, texto }

  // Uma predefinição de live aplicada trocou as tags da Twitch: o painel passa a mostrá-las como as do canal.
  useEffect(() => {
    const aoAplicar = ev => { const tags = ev.detail && ev.detail.tags; if (Array.isArray(tags)) { setNoCanal(tags); setRascunho(tags); setTexto(''); setResultado(null); } };
    window.addEventListener(EVENTO_DAS_TAGS, aoAplicar);
    return () => window.removeEventListener(EVENTO_DAS_TAGS, aoAplicar);
  }, []);

  const comYoutube = lerConfig().youtubeInfo.ligado; // tags e descrição do YouTube no mesmo painel (ligado nas configurações)
  const faltaAcao = nomesDeAcoes && !temAcaoDeTags(nomesDeAcoes);
  const podeLer = conectado && ativas.twitch && nomesDeAcoes !== null && !faltaAcao;
  const final = adicionarTags(rascunho, texto); // o que o Aplicar manda: a lista em edição mais o que está digitado
  const alterado = noCanal === null ? final.length > 0 : !mesmasTags(final, noCanal);
  const pode = podeLer && !enviando && alterado;
  const cheio = rascunho.length >= MAX_TAGS;

  async function lerDoCanal() {
    setLendo(true);
    setErroLeitura('');
    setResultado(null);
    const r = await lerTags();
    if (r.ok) {
      setNoCanal(r.tags);
      setRascunho(r.tags);
    } else {
      setErroLeitura(r.erro);
    }
    setLendo(false);
  }

  // Lê ao abrir o painel (e quando a conexão volta). Depois de um erro só o botão de reler tenta de novo.
  useEffect(() => {
    if (!recolhido && podeLer && noCanal === null && !lendo && !erroLeitura) lerDoCanal();
  }, [recolhido, podeLer, noCanal, lendo, erroLeitura]);

  function alternarRecolhido() {
    gravar('tagsRecolhido', !recolhido);
    setRecolhido(!recolhido);
  }
  function incluir() {
    setRascunho(adicionarTags(rascunho, texto));
    setTexto('');
    setResultado(null);
  }
  function excluir(tag) {
    setRascunho(removerTag(rascunho, tag));
    setResultado(null);
  }
  async function aplicar() {
    if (!pode) return;
    setEnviando(true);
    setResultado(null);
    const r = await definirTags(final);
    setResultado(r);
    if (r.nivel === 0) {
      setNoCanal(final);
      setRascunho(final);
      setTexto('');
    }
    setEnviando(false);
  }

  return (
    <section className="cartao" id="painel-tags">
      <button type="button" className="cabecalho" onClick={alternarRecolhido} aria-expanded={!recolhido}>
        <span className="seta">{recolhido ? '▸' : '▾'}</span>
        <span className="titulo-painel">{comYoutube ? 'Tags e descrição' : 'Tags'}</span>
        <span className="marca-twitch" style={{ color: PLATAFORMAS.twitch.cor }} title="Tags da Twitch"><IconePlataforma id="twitch" tamanho={13} /></span>
        {comYoutube && <span className="marca-twitch" style={{ color: PLATAFORMAS.youtube.cor }} title="Tags e descrição do YouTube"><IconePlataforma id="youtube" tamanho={13} /></span>}
        {recolhido && <span className="resumo">{rascunho.map(t => `#${t}`).join(' ')}</span>}
      </button>
      {!recolhido && (
        <div className="corpo-live">
          <div className="atalhos" id="tags-do-canal">
            {rascunho.map(t => (
              <span key={t} className="atalho">
                <span className="tag-nome">#{t}</span>
                <button type="button" className="atalho-remove" onClick={() => excluir(t)} title="Excluir" aria-label={`Excluir ${t}`}>✕</button>
              </span>
            ))}
            {!lendo && rascunho.length === 0 && noCanal !== null && <span className="dica">O canal está sem tags.</span>}
            <button type="button" className="link" id="botao-reler-tags" onClick={lerDoCanal} disabled={!podeLer || lendo}>{lendo ? 'Lendo…' : '↻ Ler da Twitch'}</button>
          </div>
          <div className="linha-categoria">
            <input id="campo-tags" type="text" value={texto} placeholder="Adicionar tag" spellCheck={false} disabled={cheio}
                   onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') incluir(); }} />
            <button type="button" id="botao-tags" className="primario" disabled={!pode} onClick={aplicar}>{enviando ? 'Enviando…' : 'Aplicar'}</button>
          </div>
          {cheio && <p className="dica">Limite de {MAX_TAGS} tags: exclua uma para adicionar outra.</p>}
          {texto.trim() && limparTags(texto).length === 0 && <p className="dica">Nenhuma tag válida (use letras e números).</p>}
          {alterado && noCanal !== null && <p className="dica" id="tags-pendentes">Alterações ainda não aplicadas.</p>}
          {!ativas.twitch && <p className="aviso">A Twitch está desligada no alto: ligue-a para ler e aplicar as tags.</p>}
          {faltaAcao && <p className="aviso">Falta a ação “{NOME_DA_ACAO_DE_TAGS}” no Streamer.bot (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”).</p>}
          {erroLeitura && <p className="aviso" id="erro-tags">Não consegui ler as tags do canal: {erroLeitura}. O que você aplicar troca as tags do canal.</p>}
          {resultado && <p className={`resultado-teste nivel-${resultado.nivel}`} id="resultado-tags">{MARCA[resultado.nivel]} {resultado.texto}</p>}
          {comYoutube && <YoutubeInfo ativas={ativas} conectado={conectado} nomesDeAcoes={nomesDeAcoes} />}
        </div>
      )}
    </section>
  );
}
