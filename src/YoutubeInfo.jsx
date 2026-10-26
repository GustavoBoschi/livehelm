// Tags e descrição da live do YouTube, dentro do painel Tags (só aparece com a opção ligada nas configurações). Lê o que a transmissão tem agora, deixa editar e
// manda só o que mudou, pela ação `Painel: YouTube` (Painel-YouTube.cs, versão 2). Sem live do YouTube aberta, o que for escrito fica guardado e é aplicado quando
// ela abrir, como o título. As tags do YouTube são palavras-chave escondidas (ajudam nas buscas); não são as da Twitch nem o "Título do jogo" do Studio.
import { useEffect, useRef, useState } from 'react';
import { aoAplicarInfoPendenteDoYoutube, aplicarInfoDoYoutube, infoPendenteDoYoutubeAgora, lerInfoDoYoutube, NOME_DA_ACAO_DO_YOUTUBE } from './acoes.js';
import { descricaoDoYoutube, tagsDoYoutube } from './titulos.js';
import { mesmasTags } from './tagsLista.js';
import { IconePlataforma } from './Icones.jsx';
import { PLATAFORMAS } from './plataformas.js';

const MARCA = ['✓', '!', '✕'];
const MAX_DESCRICAO = 5000;
const quebras = s => String(s || '').replace(/\r\n?/g, '\n').trim();

export default function YoutubeInfo({ ativas, conectado, nomesDeAcoes }) {
  const pendente = useRef(infoPendenteDoYoutubeAgora()).current; // o que ficou esperando a live abrir (aparece como rascunho)
  const [tags, setTags] = useState(() => (pendente && pendente.trocarTags ? pendente.tags : []));
  const [texto, setTexto] = useState('');
  const [descricao, setDescricao] = useState(() => (pendente && pendente.trocarDescricao ? pendente.descricao : ''));
  const [lido, setLido] = useState(null);       // { tags, descricao } que o YouTube tem; null = ainda não lido
  const [categoriaAtual, setCategoriaAtual] = useState(''); // a categoria que a transmissão tem agora (como o Streamer.bot a vê)
  const [lendo, setLendo] = useState(false);
  const [erroLeitura, setErroLeitura] = useState(null); // { texto, semTransmissao }
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const editado = useRef(Boolean(pendente));     // a pessoa mexeu (ou há um pedido guardado): a leitura não passa por cima

  const faltaAcao = nomesDeAcoes && !nomesDeAcoes.includes(NOME_DA_ACAO_DO_YOUTUBE);
  const podeLer = conectado && ativas.youtube && nomesDeAcoes !== null && !faltaAcao;
  const limpas = tagsDoYoutube(tags);
  const tagsMudaram = lido ? !mesmasTags(limpas.tags, lido.tags) : limpas.tags.length > 0;
  const descricaoMudou = lido ? quebras(descricao) !== quebras(lido.descricao) : quebras(descricao) !== '';
  const alterado = tagsMudaram || descricaoMudou;
  const pode = podeLer && !enviando && alterado;

  async function ler(sobrescrever) {
    setLendo(true);
    setErroLeitura(null);
    const r = await lerInfoDoYoutube();
    if (r.ok) {
      setLido({ tags: r.tags, descricao: r.descricao });
      setCategoriaAtual(r.categoria || '');
      if (sobrescrever || !editado.current) { setTags(r.tags); setDescricao(r.descricao); editado.current = false; }
    } else {
      setErroLeitura({ texto: r.erro, semTransmissao: Boolean(r.semTransmissao) });
    }
    setLendo(false);
  }

  // Lê ao abrir (e quando a conexão volta). Depois de um erro (ou de não haver live aberta), só o botão de reler tenta de novo.
  useEffect(() => {
    if (podeLer && lido === null && !lendo && !erroLeitura) ler(false);
  }, [podeLer, lido, lendo, erroLeitura]);

  // O pedido guardado foi aplicado quando a live abriu.
  useEffect(() => aoAplicarInfoPendenteDoYoutube(r => {
    setResultado(r);
    if (r.nivel < 2) { editado.current = false; setLido(null); setErroLeitura(null); }
  }), []);

  function incluir() {
    const novas = tagsDoYoutube([...tags, texto]).tags;
    editado.current = true;
    setTags(novas);
    setTexto('');
    setResultado(null);
  }
  function excluir(tag) {
    editado.current = true;
    setTags(tags.filter(t => t !== tag));
    setResultado(null);
  }
  async function aplicar() {
    if (!pode) return;
    setEnviando(true);
    setResultado(null);
    const r = await aplicarInfoDoYoutube({ tags, trocarTags: tagsMudaram, descricao, trocarDescricao: descricaoMudou });
    setResultado(r);
    if (r.nivel < 2 && !r.semTransmissao) {
      // O YouTube agora tem o que foi enviado (já ajustado às regras dele); o que não mudou continua como estava.
      const novaDescricao = descricaoMudou ? descricaoDoYoutube(descricao).texto : (lido ? lido.descricao : '');
      setLido({ tags: tagsMudaram ? limpas.tags : (lido ? lido.tags : []), descricao: novaDescricao });
      if (tagsMudaram) setTags(limpas.tags);
      if (descricaoMudou) setDescricao(novaDescricao);
      editado.current = false;
    }
    setEnviando(false);
  }

  return (
    <div className="youtube-info" id="youtube-info">
      <div className="youtube-info-titulo">
        <span className="marca-twitch" style={{ color: PLATAFORMAS.youtube.cor }}><IconePlataforma id="youtube" tamanho={13} /></span> YouTube
      </div>
      <div className="atalhos" id="tags-do-youtube">
        {tags.map(t => (
          <span key={t} className="atalho">
            <span className="tag-nome">{t}</span>
            <button type="button" className="atalho-remove" onClick={() => excluir(t)} title="Excluir" aria-label={`Excluir ${t}`}>✕</button>
          </span>
        ))}
        {!lendo && tags.length === 0 && lido && <span className="dica">A live está sem tags.</span>}
        <button type="button" className="link" id="botao-reler-youtube" onClick={() => ler(true)} disabled={!podeLer || lendo}>{lendo ? 'Lendo…' : '↻ Ler do YouTube'}</button>
      </div>
      {categoriaAtual && <p className="dica" id="categoria-atual-youtube">Categoria atual no YouTube: {categoriaAtual}</p>}
      <input id="campo-tags-youtube" type="text" value={texto} placeholder="Adicionar tag (a vírgula separa várias)" spellCheck={false}
             onChange={e => { if (e.target.value.includes(',')) { editado.current = true; setTags(tagsDoYoutube([...tags, e.target.value]).tags); setTexto(''); } else setTexto(e.target.value); }}
             onKeyDown={e => { if (e.key === 'Enter') incluir(); }} />
      {limpas.ajustes.length > 0 && <p className="dica" id="aviso-tags-youtube">{limpas.ajustes[0]}.</p>}
      <textarea id="campo-descricao-youtube" rows={4} value={descricao} maxLength={MAX_DESCRICAO} placeholder="Descrição da live no YouTube" spellCheck
                onChange={e => { editado.current = true; setDescricao(e.target.value); setResultado(null); }} />
      <div className="youtube-info-rodape">
        <span className="dica">{descricao.length} / {MAX_DESCRICAO}</span>
        <button type="button" id="botao-youtube-info" className="primario" disabled={!pode} onClick={aplicar}>{enviando ? 'Enviando…' : 'Aplicar no YouTube'}</button>
      </div>
      {alterado && lido !== null && <p className="dica" id="youtube-pendente">Alterações ainda não aplicadas.</p>}
      {erroLeitura && erroLeitura.semTransmissao && <p className="dica" id="youtube-sem-live">Sem live do YouTube aberta: o que você escrever aqui fica guardado e eu aplico quando ela abrir.</p>}
      {erroLeitura && !erroLeitura.semTransmissao && <p className="aviso" id="erro-youtube-info">Não consegui ler o YouTube: {erroLeitura.texto}.</p>}
      {!ativas.youtube && <p className="aviso">O YouTube está desligado no alto: ligue-o para ler e aplicar.</p>}
      {faltaAcao && <p className="aviso">Falta a ação “{NOME_DA_ACAO_DO_YOUTUBE}” no Streamer.bot (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”).</p>}
      {resultado && <p className={`resultado-teste nivel-${resultado.nivel}`} id="resultado-youtube-info">{MARCA[resultado.nivel]} {resultado.texto}</p>}
    </div>
  );
}
