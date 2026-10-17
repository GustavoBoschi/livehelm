// Seletor de emojis do título da live: um botão que abre um cartão com busca por texto (nome e palavras-chave em português e inglês), abas por
// grupo, os últimos usados, um grupo de jogos e RPG e o tom de pele. Traz todos os emojis do Unicode (emojisDados.js) e esconde os que o sistema
// não sabe desenhar (emojiSuporte.js). O clique chama aoEscolher(emoji).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ler, gravar } from './armazenamento.js';
import { TODOS_OS_EMOJIS, GRUPOS_DE_EMOJI, buscarEmojis, comTom, nomeDoEmoji } from './emojiBusca.js';
import { emojiSuportado } from './emojiSuporte.js';

const JOGOS = '🎮 🕹️ 👾 🎲 🧩 ♟️ 🃏 🎯 🎳 🎰 🏆 🥇 🥈 🥉 🏅 🎖️ ⚔️ 🗡️ 🛡️ 🏹 🔮 🧙 🧝 🧛 🧟 🧞 🧚 🐉 🐲 🏰 🗺️ 🧭 💎 👑 💀 ☠️ 👻 🤖 👽 🛸 🚀 💣 🔫 🪓 ⛏️ 🧪 📜 🔥 ⚡'.split(' ');
const TONS = ['', '🏻', '🏼', '🏽', '🏾', '🏿']; // o 0 é o tom padrão (amarelo)
const MAX_RECENTES = 24;

export default function SeletorDeEmoji({ aoEscolher }) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState('jogos');
  const [busca, setBusca] = useState('');
  const [tom, setTom] = useState(() => ler('emojiTom', 0));
  const [recentes, setRecentes] = useState(() => ler('emojisRecentes', []));
  const raiz = useRef(null);
  const campoBusca = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    if (campoBusca.current) campoBusca.current.focus();
    const fora = e => { if (raiz.current && !raiz.current.contains(e.target)) setAberto(false); };
    const tecla = e => { if (e.key === 'Escape') setAberto(false); };
    window.addEventListener('mousedown', fora);
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('mousedown', fora); window.removeEventListener('keydown', tecla); };
  }, [aberto]);

  const termo = busca.trim();
  const lista = useMemo(() => {
    if (termo) return buscarEmojis(TODOS_OS_EMOJIS, termo).map(e => ({ emoji: comTom(e, tom), nome: e.nome }));
    if (aba === 'recentes') return recentes.map(emoji => ({ emoji, nome: nomeDoEmoji(emoji) }));
    if (aba === 'jogos') return JOGOS.map(emoji => ({ emoji, nome: nomeDoEmoji(emoji) }));
    return TODOS_OS_EMOJIS.filter(e => e.grupo === aba).map(e => ({ emoji: comTom(e, tom), nome: e.nome }));
  }, [termo, aba, tom, recentes]);
  const visiveis = useMemo(() => (aberto ? lista.filter(e => emojiSuportado(e.emoji)) : []), [aberto, lista]);

  function escolher(emoji) {
    const novos = [emoji, ...recentes.filter(e => e !== emoji)].slice(0, MAX_RECENTES);
    setRecentes(novos);
    gravar('emojisRecentes', novos);
    aoEscolher(emoji);
  }
  function proximoTom() {
    setTom(atual => {
      const novo = (atual + 1) % TONS.length;
      gravar('emojiTom', novo);
      return novo;
    });
  }

  const abas = [
    ...(recentes.length ? [{ id: 'recentes', icone: '🕘', nome: 'Usados por último' }] : []),
    { id: 'jogos', icone: '🎮', nome: 'Jogos e RPG' },
    ...GRUPOS_DE_EMOJI.filter(g => g.id !== 9 || (aberto && emojiSuportado('🇧🇷'))),
  ];
  const abaAtual = abas.find(a => a.id === aba) || abas[0];

  return (
    <span className="seletor-emoji" ref={raiz}>
      <button type="button" id="botao-emoji" className="botao-emoji" title="Inserir emoji no título" aria-label="Emojis" aria-expanded={aberto} onClick={() => setAberto(a => !a)}>🙂</button>
      {aberto && (
        <div className="cartao-emoji" id="cartao-emoji" role="dialog" aria-label="Emojis">
          <div className="busca-emoji">
            <input id="busca-emoji" ref={campoBusca} type="text" value={busca} placeholder="Buscar emoji (ex.: fogo, coração, dado)" spellCheck={false}
                   onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && visiveis[0]) escolher(visiveis[0].emoji); }} />
            <button type="button" id="tom-emoji" className="tom-emoji" title="Tom de pele dos emojis de pessoas e gestos" aria-label="Tom de pele" onClick={proximoTom}>{`👋${TONS[tom]}`}</button>
          </div>
          {!termo && (
            <div className="abas-emoji" role="tablist">
              {abas.map(a => (
                <button key={a.id} type="button" role="tab" aria-selected={a.id === abaAtual.id} title={a.nome} className={`aba-emoji${a.id === abaAtual.id ? ' aba-emoji-ativa' : ''}`} onClick={() => setAba(a.id)}>{a.icone}</button>
              ))}
            </div>
          )}
          <div className="grade-emoji" role="listbox" aria-label={termo ? 'Resultados da busca' : abaAtual.nome}>
            {visiveis.map(e => (
              <button key={e.emoji} type="button" className="emoji" title={e.nome} onClick={() => escolher(e.emoji)}>{e.emoji}</button>
            ))}
          </div>
          {termo && visiveis.length === 0 && <p className="vazio-emoji">Nenhum emoji com “{termo}”.</p>}
          {termo && visiveis.length > 0 && <p className="vazio-emoji">{visiveis.length} {visiveis.length === 1 ? 'resultado' : 'resultados'}. Enter escolhe o primeiro.</p>}
        </div>
      )}
    </span>
  );
}
