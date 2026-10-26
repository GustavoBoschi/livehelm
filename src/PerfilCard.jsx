// O perfil de quem escreve no chat (menu da mensagem > Ver perfil, ligado nas configurações). Vale para as três plataformas com o que o chat entrega (nome, foto, selos,
// primeira mensagem, quantas mensagens na sessão e as punições do dock) e, na Twitch, acrescenta a conta pela ação `Painel: Controles` (idade da conta, se segue, se é sub,
// moderador ou VIP). O botão copia o link do perfil: abrir o link dentro do dock o tiraria da tela.
import { useEffect, useState } from 'react';
import { perfilDaTwitch, temControlesAgora, NOME_DA_PLATAFORMA } from './acoes.js';
import { IconePlataforma } from './Icones.jsx';
import { idadeDaConta, linkDoPerfil, nivelDeSub } from './perfil.js';
import { plataformaDe } from './plataformas.js';
import { copiarTexto, corLegivel, duracao } from './texto.js';

const sim = v => (v ? 'sim' : 'não');

export default function PerfilCard({ item, itens, punicoes, aoFechar, aoResponder, aoVerSo }) {
  const plat = plataformaDe(item.plataforma);
  const [twitch, setTwitch] = useState(null); // { nivel, texto, perfil } ou null enquanto lê
  const [copiado, setCopiado] = useState(false);
  const querTwitch = item.plataforma === 'twitch' && item.userId && temControlesAgora();

  useEffect(() => {
    if (!querTwitch) return undefined;
    let vivo = true;
    perfilDaTwitch(item.userId).then(r => { if (vivo) setTwitch(r); });
    return () => { vivo = false; };
  }, [querTwitch, item.userId]);

  const mesmo = i => i.plataforma === item.plataforma && String(i.nome).toLowerCase() === String(item.nome).toLowerCase();
  const mensagens = itens.filter(i => i.tipo === 'chat' && mesmo(i));
  const apagadas = mensagens.filter(i => i.apagada).length;
  const primeira = mensagens.some(i => i.primeira);
  const castigos = punicoes.filter(p => p.plataforma === item.plataforma && String(p.nome).toLowerCase() === String(item.nome).toLowerCase());
  const perfil = twitch && twitch.nivel === 0 ? twitch.perfil : null;
  const foto = (perfil && /^https:\/\//i.test(perfil.foto || '') && perfil.foto) || (/^https:\/\//i.test(item.avatar || '') && item.avatar) || '';
  const link = linkDoPerfil({ plataforma: item.plataforma, login: item.login, userId: item.userId, nome: item.nome });
  const insignias = (item.insignias || []).filter(b => b && b.src && /^https:\/\//i.test(b.src));
  const papeis = perfil ? [perfil.moderador && 'moderador', perfil.vip && 'VIP', perfil.inscrito && `sub ${nivelDeSub(perfil.nivelSub)}`.trim(), perfil.parceiro ? 'parceiro' : perfil.afiliado && 'afiliado'].filter(Boolean) : [];

  function copiarLink() {
    copiarTexto(link);
    setCopiado(true);
  }

  return (
    <div className="perfil-card" id="perfil-card" role="dialog" aria-label={`Perfil de ${item.nome}`} onClick={e => e.stopPropagation()} style={{ '--cor-plataforma': plat.cor }}>
      <div className="perfil-topo">
        {foto ? <img className="perfil-foto" src={foto} alt="" /> : <span className="perfil-foto perfil-foto-vazia"><IconePlataforma id={item.plataforma} tamanho={22} /></span>}
        <div className="perfil-nome">
          <b style={{ color: corLegivel(item.cor) }}>{item.nome}</b>
          <span className="perfil-plataforma"><IconePlataforma id={item.plataforma} tamanho={12} /> {NOME_DA_PLATAFORMA[item.plataforma] || item.plataforma}</span>
          {(insignias.length > 0 || papeis.length > 0) && (
            <span className="perfil-selos">
              {insignias.map((b, i) => <img key={i} className="insignia" src={b.src} alt="" />)}
              {papeis.map(p => <span key={p} className="perfil-papel">{p}</span>)}
            </span>
          )}
        </div>
        <button type="button" className="perfil-fechar" onClick={aoFechar} title="Fechar" aria-label="Fechar o perfil">✕</button>
      </div>

      <ul className="perfil-fatos">
        <li>{mensagens.length} {mensagens.length === 1 ? 'mensagem' : 'mensagens'} nesta sessão{apagadas ? ` (${apagadas} apagada${apagadas > 1 ? 's' : ''})` : ''}</li>
        {primeira && <li>Escreveu a primeira mensagem dela no canal nesta sessão</li>}
        {castigos.map(p => <li key={p.id} className="perfil-castigo">{p.banido ? 'Banido' : `Silenciado${p.segundos ? ` por ${duracao(p.segundos)}` : ''}`} nesta sessão</li>)}
        {perfil && perfil.criadaEm && <li>Conta criada em {new Date(perfil.criadaEm).toLocaleDateString('pt-BR')}{idadeDaConta(perfil.criadaEm) ? ` (${idadeDaConta(perfil.criadaEm)})` : ''}</li>}
        {perfil && <li>Segue o canal: {sim(perfil.seguindo)}</li>}
        {perfil && perfil.descricao && <li className="perfil-descricao">{perfil.descricao}</li>}
      </ul>

      {querTwitch && !twitch && <p className="dica" id="perfil-lendo">Lendo a conta na Twitch…</p>}
      {querTwitch && twitch && twitch.nivel > 0 && <p className="aviso" id="perfil-erro">Não consegui ler a conta na Twitch: {twitch.texto}.</p>}
      {item.plataforma === 'twitch' && !querTwitch && <p className="dica">Para ver a idade da conta e se segue o canal, crie a ação Painel: Controles (Painel-Controles.cs).</p>}
      {item.plataforma !== 'twitch' && <p className="dica">{NOME_DA_PLATAFORMA[item.plataforma]} só entrega o nome, a foto e os selos no chat; o resto o dock soma pela sessão.</p>}

      <div className="perfil-botoes">
        {aoResponder && <button type="button" id="perfil-responder" onClick={aoResponder}>Responder</button>}
        <button type="button" id="perfil-so-este" onClick={aoVerSo}>Ver só este usuário</button>
        <button type="button" id="perfil-copiar" disabled={!link} onClick={copiarLink} title={link || 'Sem o dado para montar o link deste perfil'}>{copiado ? 'Copiado!' : 'Copiar link do perfil'}</button>
      </div>
    </div>
  );
}
