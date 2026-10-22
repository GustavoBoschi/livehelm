// Título e categoria da live: um campo de cada, Confirmar atualiza as plataformas ativas (uma ação do Streamer.bot por
// plataforma) e o resultado mostra o que cada uma realmente aplicou. As categorias salvas e as que as plataformas já
// confirmaram viram sugestões. Tudo fica lembrado no armazenamento do navegador do dock. As tags (#) ficam em Tags.jsx.
import { useEffect, useRef, useState } from 'react';
import SeletorDeEmoji from './Emojis.jsx';
import { ler, gravar } from './armazenamento.js';
import { EVENTO_DOS_CAMPOS } from './predefinicoes.js';
import { PLATAFORMAS_DO_DOCK, NOME_DA_PLATAFORMA, acoesQueFaltam, aoAplicarPendenteDoYoutube, atualizarLive, lerCanal, normalizar, temAcaoDeTags, temAcaoSemCategoria, tirarCategoriaDaTwitch } from './acoes.js';

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
  useEffect(() => aoAplicarPendenteDoYoutube(r => setResultados(rs => [...rs.filter(x => x.plataforma !== 'youtube'), r])), []);
  // Uma predefinição de live aplicada põe o título e a categoria nos campos (ela já os guardou e já enviou às plataformas).
  useEffect(() => {
    const aoAplicar = ev => { const d = ev.detail || {}; setTitulo(d.titulo || ''); setCategoria(d.categoria || ''); setResultados([]); };
    window.addEventListener(EVENTO_DOS_CAMPOS, aoAplicar);
    return () => window.removeEventListener(EVENTO_DOS_CAMPOS, aoAplicar);
  }, []);
  const editado = useRef(false); // a pessoa mexeu nos campos: a leitura do canal não pode passar por cima
  const jaLeu = useRef(false);

  // Ao conectar, os campos ganham o título e a categoria que o canal tem agora (a Twitch; sem título lá, o do YouTube). A categoria só vem da
  // Twitch: a do YouTube é um grupo de vídeos ("Games"), não o jogo, e a Kick não deixa o Streamer.bot lê-la. Sem a ação nova ou sem resposta,
  // ficam os valores lembrados da última vez.
  useEffect(() => {
    if (!conectado) { jaLeu.current = false; return undefined; }
    if (jaLeu.current || !nomesDeAcoes || !temAcaoDeTags(nomesDeAcoes)) return undefined;
    jaLeu.current = true;
    let vivo = true;
    lerCanal().then(r => {
      if (!vivo || editado.current) return;
      const t = (r.ok && r.titulo) || (r.youtube && r.youtube.titulo) || '';
      const c = (r.ok && r.categoria) || '';
      if (t) { setTitulo(t); gravar('titulo', t); }
      if (c) { setCategoria(c); gravar('categoria', c); }
    });
    return () => { vivo = false; };
  }, [conectado, nomesDeAcoes]);

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
  function mudarTitulo(v) { editado.current = true; setTitulo(v); setResultados([]); gravar('titulo', v); }
  // Põe o emoji onde está o cursor do título (no fim, se o campo nunca teve foco) e devolve o foco ao campo.
  function inserirNoTitulo(emoji) {
    const campo = campoTitulo.current;
    const ini = campo && campo.selectionStart !== null ? campo.selectionStart : titulo.length;
    const fim = campo && campo.selectionEnd !== null ? campo.selectionEnd : titulo.length;
    mudarTitulo(titulo.slice(0, ini) + emoji + titulo.slice(fim));
    requestAnimationFrame(() => { if (campo) { campo.focus(); const p = ini + emoji.length; campo.setSelectionRange(p, p); } });
  }
  function mudarCategoria(v) { editado.current = true; setCategoria(v); setResultados([]); gravar('categoria', v); }

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
    // As plataformas vão juntas e cada resultado aparece assim que chega (antes uma esperava a outra terminar).
    const feitos = await Promise.all(alvos.map(async p => {
      const r = await atualizarLive(p, t, c);
      setResultados(rs => [...rs.filter(x => x.plataforma !== p), r].sort((a, b) => PLATAFORMAS_DO_DOCK.indexOf(a.plataforma) - PLATAFORMAS_DO_DOCK.indexOf(b.plataforma)));
      return r;
    }));
    lembrar(feitos.map(r => r.categoriaFeita).filter(Boolean));
    setEnviando(false);
  }

  // Opcional (ação Painel: Sem Categoria): pede à Twitch que fique sem categoria.
  async function semCategoria() {
    setCategoria('');
    gravar('categoria', '');
    editado.current = true;
    const erro = await tirarCategoriaDaTwitch();
    setResultados([erro
      ? { plataforma: 'twitch', nivel: 2, texto: erro }
      : { plataforma: 'twitch', nivel: 0, texto: 'pedi à Twitch para tirar a categoria' }]);
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
            {nomesDeAcoes && temAcaoSemCategoria(nomesDeAcoes) && alvos.includes('twitch') && (
              <button type="button" className="link" id="botao-sem-categoria" onClick={semCategoria} title="Tira a categoria do canal na Twitch">Sem categoria (Twitch)</button>
            )}
          </div>
          {alvos.length === 0 && <p className="aviso">Nenhuma plataforma ativa: ligue uma no alto.</p>}
          {faltam.length > 0 && <p className="aviso">Faltam ações no Streamer.bot: {faltam.join(', ')} (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”).</p>}
          {resultados.length > 0 && (
            <ul className="resultados resultados-flutuantes" id="resultados-live" title="Clique para fechar" onClick={() => setResultados([])}>
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
