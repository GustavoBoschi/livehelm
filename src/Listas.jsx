// Lista do chat que não é o feed: silenciados e banidos da sessão (popup do botão ⊘).
import { plataformaDe } from './plataformas.js';
import { NOME_DA_PLATAFORMA } from './acoes.js';
import { IconePlataforma } from './Icones.jsx';
import { descricao, dica, podeReverter, textoDoBotao } from './punicoes.js';

export function PopupPunicoes({ punicoes, agora, aoReverter }) {
  return (
    <div className="popup-punicoes" id="popup-punicoes" onClick={e => e.stopPropagation()}>
      <b>Silenciados e banidos nesta sessão</b>
      {punicoes.length === 0 && <p className="vazio-popup">Ninguém foi silenciado ou banido ainda. Aparecem aqui os silêncios e banimentos feitos pelo dock e os avisados pelas plataformas.</p>}
      {punicoes.map(p => (
        <div key={p.id} className="punicao" style={{ '--cor-plataforma': plataformaDe(p.plataforma).cor }}>
          <span className="marca-plataforma"><IconePlataforma id={p.plataforma} /></span>
          <div className="conteudo">
            <b>{p.nome}</b>
            <div className="descricao">{descricao(p, agora)}</div>
          </div>
          <button type="button" disabled={!podeReverter(p, agora)} title={dica(p, agora)} onClick={() => aoReverter(p)} aria-label={`${textoDoBotao(p)} ${NOME_DA_PLATAFORMA[p.plataforma] || ''} ${p.nome}`}>{textoDoBotao(p)}</button>
        </div>
      ))}
    </div>
  );
}
