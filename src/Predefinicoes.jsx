// Predefinições de live: guarda um "modo" (título, categoria, tags da Twitch e, se quiser, a categoria do YouTube) e o aplica com um clique, em vez de
// redigitar tudo a cada troca (Marvel Rivals ranqueada, Just Chatting, programando...). Aplicar faz o mesmo que preencher o painel Live e o Confirmar
// (nas plataformas ativas) e, se a predefinição tem tags, o Aplicar do painel de Tags. O painel só existe com a opção ligada nas configurações.
import { useEffect, useState } from 'react';
import { ler, gravar } from './armazenamento.js';
import { NOME_DA_PLATAFORMA, PLATAFORMAS_DO_DOCK, acoesQueFaltam, atualizarLive, definirTags, lerTags, temAcaoDeTags } from './acoes.js';
import { CATEGORIAS_DO_YOUTUBE } from './titulos.js';
import { EVENTO_DAS_TAGS, EVENTO_DOS_CAMPOS, criarPredefinicao, lerPredefinicoes, removerPredefinicao, resumoDaPredefinicao, salvarPredefinicao } from './predefinicoes.js';

const SEGUNDOS_DOS_AVISOS = 10;
const MARCA = ['✓', '!', '✕'];

export default function Predefinicoes({ ativas, conectado, nomesDeAcoes }) {
  const [recolhido, setRecolhido] = useState(() => ler('predefinicoesRecolhido', false));
  const [lista, setLista] = useState(() => lerPredefinicoes(ler('predefinicoes', [])));
  const [nome, setNome] = useState('');
  const [youtube, setYoutube] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [resultados, setResultados] = useState([]); // [{ chave, nivel, texto }]
  const [aplicada, setAplicada] = useState(() => ler('predefinicaoAplicada', ''));

  const alvos = PLATAFORMAS_DO_DOCK.filter(p => ativas[p]);
  const faltam = nomesDeAcoes ? acoesQueFaltam(alvos, nomesDeAcoes) : [];
  const pode = conectado && !ocupado && nomesDeAcoes !== null;

  useEffect(() => {
    if (!resultados.some(r => r.nivel < 2)) return undefined;
    const t = setTimeout(() => setResultados(rs => rs.filter(r => r.nivel === 2)), SEGUNDOS_DOS_AVISOS * 1000);
    return () => clearTimeout(t);
  }, [resultados]);

  const mostrar = (chave, nivel, texto) => setResultados(rs => [...rs.filter(r => r.chave !== chave), { chave, nivel, texto }]);

  function alternarRecolhido() {
    gravar('predefinicoesRecolhido', !recolhido);
    setRecolhido(!recolhido);
  }
  function guardar(nova) {
    setLista(nova);
    gravar('predefinicoes', nova);
  }

  // Guarda o que está nos campos do painel Live (título e categoria) e as tags que o canal tem agora na Twitch (lidas na hora).
  async function salvar() {
    if (!pode || !nome.trim()) return;
    setOcupado(true);
    setResultados([]);
    let tags = [];
    let aviso = '';
    if (nomesDeAcoes && temAcaoDeTags(nomesDeAcoes) && ativas.twitch) {
      const r = await lerTags();
      if (r.ok) tags = r.tags;
      else aviso = 'sem as tags (não consegui ler as do canal)';
    } else {
      aviso = 'sem as tags (só a Twitch tem, e precisa da ação Painel: Tags)';
    }
    const nova = criarPredefinicao({ nome, titulo: ler('titulo', ''), categoria: ler('categoria', ''), tags, categoriaYoutube: youtube });
    if (!nova) {
      mostrar('salvar', 1, 'preencha título ou categoria no painel Live antes de guardar');
    } else {
      const r = salvarPredefinicao(lista, nova);
      if (r.erro) mostrar('salvar', 2, r.erro);
      else {
        guardar(r.lista);
        setNome('');
        setYoutube('');
        mostrar('salvar', aviso ? 1 : 0, `${r.substituiu ? 'atualizada' : 'guardada'}: ${nova.nome}${aviso ? ` (${aviso})` : ''}`);
      }
    }
    setOcupado(false);
  }

  async function aplicar(p) {
    if (!pode) return;
    setOcupado(true);
    setResultados([]);
    // Os campos do painel Live passam a mostrar a predefinição (e ficam lembrados), como se a pessoa os tivesse preenchido.
    gravar('titulo', p.titulo);
    gravar('categoria', p.categoria);
    window.dispatchEvent(new CustomEvent(EVENTO_DOS_CAMPOS, { detail: { titulo: p.titulo, categoria: p.categoria } }));
    setAplicada(p.id);
    gravar('predefinicaoAplicada', p.id);
    const tarefas = alvos.filter(() => p.titulo || p.categoria).map(async plataforma => {
      const r = await atualizarLive(plataforma, p.titulo, p.categoria, p.categoriaYoutube);
      mostrar(plataforma, r.nivel, `${NOME_DA_PLATAFORMA[plataforma]}: ${r.texto}`);
    });
    if (p.tags.length && ativas.twitch) {
      tarefas.push(definirTags(p.tags).then(r => {
        mostrar('tags', r.nivel, `Tags da Twitch: ${r.texto}`);
        if (r.nivel === 0) window.dispatchEvent(new CustomEvent(EVENTO_DAS_TAGS, { detail: { tags: p.tags } }));
      }));
    }
    await Promise.all(tarefas);
    setOcupado(false);
  }

  function apagar(p) {
    guardar(removerPredefinicao(lista, p.id));
    if (aplicada === p.id) { setAplicada(''); gravar('predefinicaoAplicada', ''); }
  }

  const tecla = e => { if (e.key === 'Enter') salvar(); };
  const atual = lista.find(p => p.id === aplicada);

  return (
    <section className="cartao" id="painel-predefinicoes">
      <button type="button" className="cabecalho" onClick={alternarRecolhido} aria-expanded={!recolhido}>
        <span className="seta">{recolhido ? '▸' : '▾'}</span>
        <span className="titulo-painel">Predefinições</span>
        {recolhido && atual && <span className="resumo">{atual.nome}</span>}
      </button>
      {!recolhido && (
        <div className="corpo-live">
          {lista.length === 0 && <p className="dica">Nenhuma predefinição ainda. Preencha o painel Live (título e categoria), dê um nome aqui embaixo e guarde.</p>}
          <div className="predefinicoes-lista" id="lista-predefinicoes">
            {lista.map(p => (
              <span key={p.id} className={`atalho predefinicao${aplicada === p.id ? ' predefinicao-aplicada' : ''}`}>
                <button type="button" className="atalho-nome" disabled={!pode} onClick={() => aplicar(p)} title={`Aplicar agora: ${resumoDaPredefinicao(p)}`}>{p.nome}</button>
                <button type="button" className="atalho-remove" onClick={() => apagar(p)} title="Apagar esta predefinição" aria-label={`Apagar ${p.nome}`}>✕</button>
              </span>
            ))}
          </div>
          <div className="linha-categoria">
            <input id="campo-nome-predefinicao" type="text" value={nome} placeholder="Nome da nova predefinição" maxLength={40} spellCheck={false}
                   onChange={e => setNome(e.target.value)} onKeyDown={tecla} />
            <button type="button" id="botao-salvar-predefinicao" className="primario" disabled={!pode || !nome.trim()} onClick={salvar}>Guardar</button>
          </div>
          <select id="campo-youtube-predefinicao" value={youtube} aria-label="Categoria do YouTube desta predefinição" onChange={e => setYoutube(e.target.value)}>
            <option value="">YouTube: categoria automática (pelas regras)</option>
            {CATEGORIAS_DO_YOUTUBE.map(c => <option key={c.nome} value={c.nome}>YouTube: {c.rotulo}</option>)}
          </select>
          <p className="dica">Guarda o título e a categoria do painel Live e as tags que a Twitch tem agora. Clicar numa predefinição aplica tudo nas plataformas ativas, na hora. Usar o mesmo nome atualiza a predefinição.</p>
          {faltam.length > 0 && <p className="aviso">Faltam ações no Streamer.bot: {faltam.join(', ')} (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”).</p>}
          {resultados.length > 0 && (
            <ul className="resultados resultados-flutuantes" id="resultados-predefinicoes" title="Clique para fechar" onClick={() => setResultados([])}>
              {resultados.map(r => <li key={r.chave} className={`nivel-${r.nivel}`}><b>{MARCA[r.nivel]}</b> {r.texto}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
