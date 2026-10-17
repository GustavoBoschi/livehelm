// Título e categoria da live: um campo de cada, Confirmar atualiza as plataformas ativas (uma ação do Streamer.bot por
// plataforma) e o resultado mostra o que cada uma realmente aplicou. As categorias salvas e as que as plataformas já
// confirmaram viram sugestões. Tudo fica lembrado no armazenamento do navegador do dock. As tags (#) ficam em Tags.jsx.
import { useEffect, useRef, useState } from 'react';
import SeletorDeEmoji from './Emojis.jsx';
import { ler, gravar } from './armazenamento.js';
import { PLATAFORMAS_DO_DOCK, NOME_DA_PLATAFORMA, acoesQueFaltam, atualizarLive, normalizar } from './acoes.js';

const MAX_HISTORICO = 60;
const SEGUNDOS_DOS_AVISOS = 10; // quanto o ok e o aviso de uma atualização ficam na tela; o erro fica até a próxima ação
const MARCA = ['✓', '!', '✕']; // por nivel: ok, aviso, erro

// Sem repetir (ignorando maiúsculas e acentos) e sem vazios.
const unicas = lista => lista.filter(c => c.trim()).filter((c, i, todas) => todas.findIndex(o => normalizar(o) === normalizar(c)) === i);

export default function LivePanel({ ativas, conectado, nomesDeAcoes }) {
  const [recolhido, setRecolhido] = useState(() => ler('liveRecolhida', true));
  const [titulo, setTitulo] = useState(() => ler('titulo', ''));
  const [categoria, setCategoria] = useState(() => ler('categoria', ''));
  const [atalhos, setAtalhos] = useState(() => ler('atalhos', []));
  const [historico, setHistorico] = useState(() => ler('historico', []));
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const campoTitulo = useRef(null);

  useEffect(() => {
    if (!resultados.some(r => r.nivel < 2)) return undefined;
    const t = setTimeout(() => setResultados(rs => rs.filter(r => r.nivel === 2)), SEGUNDOS_DOS_AVISOS * 1000);
    return () => clearTimeout(t);
  }, [resultados]);

  const alvos = PLATAFORMAS_DO_DOCK.filter(p => ativas[p]);
  const faltam = nomesDeAcoes ? acoesQueFaltam(alvos, nomesDeAcoes) : [];
  const sugestoes = unicas([...atalhos, ...historico]);
  const podeConfirmar = conectado && !enviando && alvos.length > 0 && nomesDeAcoes !== null;

  function alternarRecolhido() {
    gravar('liveRecolhida', !recolhido);
    setRecolhido(!recolhido);
  }
  function mudarTitulo(v) { setTitulo(v); setResultados([]); gravar('titulo', v); }
  // Põe o emoji onde está o cursor do título (no fim, se o campo nunca teve foco) e devolve o foco ao campo.
  function inserirNoTitulo(emoji) {
    const campo = campoTitulo.current;
    const ini = campo && campo.selectionStart !== null ? campo.selectionStart : titulo.length;
    const fim = campo && campo.selectionEnd !== null ? campo.selectionEnd : titulo.length;
    mudarTitulo(titulo.slice(0, ini) + emoji + titulo.slice(fim));
    requestAnimationFrame(() => { if (campo) { campo.focus(); const p = ini + emoji.length; campo.setSelectionRange(p, p); } });
  }
  function mudarCategoria(v) { setCategoria(v); setResultados([]); gravar('categoria', v); }

  function salvarAtalho() {
    const nome = categoria.trim();
    if (!nome || atalhos.some(a => normalizar(a) === normalizar(nome))) return;
    const novos = [...atalhos, nome];
    setAtalhos(novos);
    gravar('atalhos', novos);
  }
  function removerAtalho(nome) {
    const novos = atalhos.filter(a => a !== nome);
    setAtalhos(novos);
    gravar('atalhos', novos);
  }
  function lembrar(nomes) {
    const novo = unicas([...nomes, ...historico]).slice(0, MAX_HISTORICO);
    setHistorico(novo);
    gravar('historico', novo);
  }

  async function confirmar() {
    if (!podeConfirmar) return;
    setEnviando(true);
    setResultados([]);
    const t = titulo.trim();
    const c = categoria.trim();
    const feitos = [];
    for (const p of alvos) feitos.push(await atualizarLive(p, t, c));
    setResultados(feitos);
    lembrar(feitos.map(r => r.categoriaFeita).filter(Boolean));
    setEnviando(false);
  }

  const tecla = e => { if (e.key === 'Enter') confirmar(); };
  const resumo = [titulo.trim(), categoria.trim()].filter(Boolean).join(' · ');

  return (
    <section className="cartao" id="painel-live">
      <button type="button" className="cabecalho" onClick={alternarRecolhido} aria-expanded={!recolhido}>
        <span className="seta">{recolhido ? '▸' : '▾'}</span>
        <span className="titulo-painel">Live</span>
        {recolhido && <span className="resumo">{resumo}</span>}
      </button>
      {!recolhido && (
        <div className="corpo-live">
          <div className="linha-titulo">
            <input id="campo-titulo" ref={campoTitulo} type="text" value={titulo} placeholder="Título da live" spellCheck onChange={e => mudarTitulo(e.target.value)} onKeyDown={tecla} />
            <SeletorDeEmoji aoEscolher={inserirNoTitulo} />
          </div>
          <div className="linha-categoria">
            <input id="campo-categoria" type="text" value={categoria} placeholder="Categoria ou jogo" list="sugestoes-categoria" spellCheck={false}
                   onChange={e => mudarCategoria(e.target.value)} onKeyDown={tecla} />
            <datalist id="sugestoes-categoria">{sugestoes.map(s => <option key={s} value={s} />)}</datalist>
            <button type="button" id="botao-confirmar" className="primario" disabled={!podeConfirmar} onClick={confirmar}>{enviando ? 'Enviando…' : 'Confirmar'}</button>
          </div>
          <div className="atalhos">
            {atalhos.map(a => (
              <span key={a} className="atalho">
                <button type="button" className="atalho-nome" onClick={() => mudarCategoria(a)} title="Usar esta categoria">{a}</button>
                <button type="button" className="atalho-remove" onClick={() => removerAtalho(a)} title="Remover" aria-label={`Remover ${a}`}>✕</button>
              </span>
            ))}
            <button type="button" className="link" onClick={salvarAtalho} disabled={!categoria.trim()}>+ Salvar categoria</button>
          </div>
          {alvos.length === 0 && <p className="aviso">Nenhuma plataforma ativa: ligue uma no alto.</p>}
          {faltam.length > 0 && <p className="aviso">Faltam ações no Streamer.bot: {faltam.join(', ')} (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”).</p>}
          {resultados.length > 0 && (
            <ul className="resultados" id="resultados-live">
              {resultados.map(r => (
                <li key={`${r.plataforma}-${r.texto}`} className={`nivel-${r.nivel}`}><b>{MARCA[r.nivel]} {NOME_DA_PLATAFORMA[r.plataforma]}:</b> {r.texto}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
