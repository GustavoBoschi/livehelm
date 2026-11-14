// Os links das redes: o botão no alto da barra (ao lado esquerdo da bolinha azul) e a janelinha que ele abre, só com os símbolos das redes que a pessoa preencheu nas
// configurações. Um clique abre o endereço no navegador; o botão direito copia o link (se o OBS não abrir a página, ainda dá para colar no navegador). O clique nunca navega
// o próprio dock (abrir o link dentro dele o tiraria da tela): a página sai por uma janela nova, que o OBS entrega ao navegador do computador.
import { useEffect, useState } from 'react';
import { Traco } from './Icones.jsx';
import { copiarTexto } from './texto.js';

export function BotaoLinks({ aberto, aoAlternar }) {
  return (
    <button type="button" id="botao-links" className="botao-links" aria-pressed={aberto} aria-haspopup="dialog" title="Links das redes" aria-label="Links das redes"
            onClick={e => { e.stopPropagation(); aoAlternar(); }}>
      <Traco nome="link" tamanho={15} />
    </button>
  );
}

function SimboloDaRede({ rede, tamanho }) {
  if (!rede.icone) return <Traco nome="globo" tamanho={tamanho} />;
  return (
    <svg className="icone" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={rede.icone} />
    </svg>
  );
}

export default function LinksDoDock({ links, aoFechar }) {
  const [copiado, setCopiado] = useState('');
  useEffect(() => {
    const tecla = e => { if (e.key === 'Escape') aoFechar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);
  useEffect(() => {
    if (!copiado) return undefined;
    const t = setTimeout(() => setCopiado(''), 1800);
    return () => clearTimeout(t);
  }, [copiado]);

  function abrir(e, rede) {
    e.preventDefault();
    window.open(rede.url, '_blank', 'noopener,noreferrer');
    aoFechar();
  }
  function copiar(e, rede) {
    e.preventDefault();
    copiarTexto(rede.url);
    setCopiado(rede.nome);
  }

  return (
    <div className="links-fundo" id="links-fundo" onClick={aoFechar}>
      <div className="links-modal" id="links-modal" role="dialog" aria-label="Links das redes" onClick={e => e.stopPropagation()}>
        <div className="links-topo">
          <b>Links</b>
          <button type="button" className="perfil-fechar" id="links-fechar" onClick={aoFechar} title="Fechar" aria-label="Fechar os links">✕</button>
        </div>
        {links.length === 0 ? (
          <p className="dica">Nenhum link ainda: coloque os endereços das suas redes em Configurações &gt; Links das redes.</p>
        ) : (
          <div className="links-grade">
            {links.map(rede => (
              <a key={rede.id} id={`link-${rede.id}`} className="link-rede" href={rede.url} target="_blank" rel="noopener noreferrer" style={rede.cor ? { '--cor-rede': rede.cor } : undefined}
                 title={`${rede.nome}: ${rede.url}`} aria-label={rede.nome} onClick={e => abrir(e, rede)} onContextMenu={e => copiar(e, rede)}>
                <SimboloDaRede rede={rede} tamanho={24} />
              </a>
            ))}
          </div>
        )}
        <p className="links-dica" role="status">{copiado ? `Link do ${copiado} copiado` : 'Clique abre · botão direito copia o link'}</p>
      </div>
    </div>
  );
}
