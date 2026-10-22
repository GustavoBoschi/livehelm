// Modos do chat da Twitch num toque: só emotes, modo lento, só seguidores e só inscritos, pela ação `Painel: Controles` (Painel-Controles.cs). O
// Streamer.bot só tem estes controles na Twitch (não na Kick nem no YouTube). A Twitch não avisa o Streamer.bot quando um modo muda por fora, então
// o estado mostrado é o que o LiveHelm enviou por último (fica lembrado entre aberturas, porque o modo continua valendo na Twitch).
import { useState } from 'react';
import { ler, gravar } from './armazenamento.js';
import { lerConfig } from './configuracoes.js';
import { MODOS_DO_CHAT, NOME_DA_ACAO_DE_CONTROLES, definirModoDoChat, temAcaoDeControles } from './acoes.js';
import { IconePlataforma } from './Icones.jsx';

const MARCA = ['✓', '!', '✕'];

export default function ModosDoChat({ ativas, conectado, nomesDeAcoes }) {
  const [recolhido, setRecolhido] = useState(() => ler('modosRecolhido', false));
  const [modos, setModos] = useState(() => ler('modosDoChat', {})); // { emotes: true, ... }: o que foi enviado por último
  const [enviando, setEnviando] = useState(null);                  // o modo que está sendo enviado
  const [resultado, setResultado] = useState(null);                // { nivel, texto }
  const { modosDoChat: opcoes } = lerConfig();
  const faltaAcao = nomesDeAcoes && !temAcaoDeControles(nomesDeAcoes);
  const pode = conectado && ativas.twitch && !faltaAcao && nomesDeAcoes !== null && enviando === null;

  const rotuloDe = m => {
    if (m.id === 'lento') return `${m.rotulo} · ${opcoes.lentoSegundos} s`;
    if (m.id === 'seguidores' && opcoes.seguidoresMinutos > 0) return `${m.rotulo} · ${opcoes.seguidoresMinutos} min`;
    return m.rotulo;
  };

  function alternarRecolhido() {
    gravar('modosRecolhido', !recolhido);
    setRecolhido(!recolhido);
  }
  function lembrar(novos) {
    setModos(novos);
    gravar('modosDoChat', novos);
  }
  async function alternar(m) {
    if (!pode) return;
    const ligar = !modos[m.id];
    setEnviando(m.id);
    setResultado(null);
    const r = await definirModoDoChat(m.id, ligar, { segundos: opcoes.lentoSegundos, minutos: opcoes.seguidoresMinutos });
    setResultado({ nivel: r.nivel, texto: `${rotuloDe(m)}: ${r.texto}` });
    if (r.nivel < 2) lembrar({ ...modos, [m.id]: ligar }); // erro: o modo não mudou, a marca fica como estava
    setEnviando(null);
  }

  const ligados = MODOS_DO_CHAT.filter(m => modos[m.id]).map(m => m.rotulo).join(' · ');

  return (
    <section className="cartao" id="painel-modos">
      <button type="button" className="cabecalho" onClick={alternarRecolhido} aria-expanded={!recolhido}>
        <span className="seta">{recolhido ? '▸' : '▾'}</span>
        <span className="titulo-painel"><IconePlataforma id="twitch" tamanho={14} /> Modos do chat</span>
        {recolhido && ligados && <span className="resumo">{ligados}</span>}
      </button>
      {!recolhido && (
        <div className="corpo-live">
          <div className="modos-chat" role="group" aria-label="Modos do chat da Twitch">
            {MODOS_DO_CHAT.map(m => (
              <button key={m.id} type="button" id={`modo-${m.id}`} className={`modo-chat${modos[m.id] ? ' modo-chat-ligado' : ''}`} aria-pressed={!!modos[m.id]}
                      disabled={!pode} title={`${m.dica} (${modos[m.id] ? 'ligado' : 'desligado'})`} onClick={() => alternar(m)}>
                {enviando === m.id ? 'Enviando…' : rotuloDe(m)}
              </button>
            ))}
          </div>
          {!ativas.twitch && <p className="aviso">A Twitch está desligada no alto: ligue-a para usar os modos.</p>}
          {faltaAcao && <p className="aviso">Falta a ação “{NOME_DA_ACAO_DE_CONTROLES}” no Streamer.bot (o nome precisa ser exatamente igual; docs/INSTRUCOES.md, “Criar as ações no Streamer.bot”).</p>}
          {resultado && <p className={`resultado-teste nivel-${resultado.nivel}`} id="resultado-modo">{MARCA[resultado.nivel]} {resultado.texto}</p>}
          {ligados && <button type="button" className="link" id="zerar-modos" onClick={() => lembrar({})} title="Só limpa as marcas do dock; não muda nada na Twitch">Limpar as marcas (se mudou o modo pelo site)</button>}
        </div>
      )}
    </section>
  );
}
