// Pop-up de aviso de anúncio da Twitch: quando faltam alguns segundos (configurações) ele aparece por cima do dock com a contagem
// regressiva, o botão para adiar o anúncio em 5 minutos e o botão para deixar rodar. A lógica de quando mostrar está em
// anuncios.js; o adiamento sai pela ação `Painel: Anuncio` (acoes.js). Desligado por padrão (configurações).
import { useEffect, useState } from 'react';
import { assinarStreamerbot } from './streamerbot.js';
import { adiarAnuncio, NOME_DA_ACAO_DE_ANUNCIO, temAcaoDeAnuncio } from './acoes.js';
import { adiado, comAviso, contagem, deveMostrar, dispensar, segundosAte } from './anuncios.js';
import { lerConfig } from './configuracoes.js';
import { IconePlataforma } from './Icones.jsx';

const TICK_MS = 500;
const SEGUNDOS_PARA_ESQUECER = 30; // um anúncio que começou há mais que isso sai da memória

// Botão "Testar o aviso" das configurações: mostra o pop-up com um anúncio de mentira em `antecedenciaS` segundos, sem falar com a
// Twitch. Quem escuta é o componente (um só no App).
let aoTestar = null;
export function testarAvisoDeAnuncio() {
  if (aoTestar) aoTestar();
}

export default function AvisoAnuncio({ nomesDeAcoes }) {
  const [anuncio, setAnuncio] = useState(null); // estado de anuncios.js, com `teste: true` no anúncio de mentira
  const [agora, setAgora] = useState(() => Date.now());
  const [pedindo, setPedindo] = useState(false);
  const [status, setStatus] = useState(null); // { texto, erro }

  useEffect(() => {
    const parar = assinarStreamerbot(ev => {
      if (ev.tipo === 'alerta' && ev.alerta.event === 'upcoming_ad' && ev.alerta.anuncio) {
        setAnuncio(a => comAviso(a && !a.teste ? a : null, ev.alerta.anuncio));
        setStatus(null);
      }
    });
    aoTestar = () => {
      const { antecedencia } = lerConfig().anuncio;
      setAnuncio({ quandoMs: Date.now() + antecedencia * 1000, duracaoS: 90, adiamentos: 3, dispensado: false, teste: true });
      setStatus(null);
    };
    return () => { parar(); aoTestar = null; };
  }, []);

  // O relógio só anda enquanto há um anúncio na memória.
  useEffect(() => {
    if (!anuncio) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      setAgora(t);
      setAnuncio(a => (a && segundosAte(a, t) < -SEGUNDOS_PARA_ESQUECER ? null : a));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [anuncio !== null]);

  if (!anuncio) return null;
  const { ligado, antecedencia } = lerConfig().anuncio;
  if (!(anuncio.teste || ligado) || !deveMostrar(anuncio, agora, antecedencia)) return null;

  const faltam = segundosAte(anuncio, agora);
  const semAdiamentos = anuncio.adiamentos === 0;
  const semAcao = !anuncio.teste && nomesDeAcoes !== null && !temAcaoDeAnuncio(nomesDeAcoes);

  async function adiar() {
    if (anuncio.teste) { setStatus({ texto: 'Teste: nada foi enviado à Twitch.', erro: false }); return; }
    setPedindo(true);
    const erro = await adiarAnuncio();
    setPedindo(false);
    if (erro) { setStatus({ texto: `Não consegui adiar: ${erro}`, erro: true }); return; }
    setAnuncio(a => adiado(a));
  }

  const dica = ['Anúncio da Twitch', anuncio.duracaoS === null ? '' : `dura ${anuncio.duracaoS} s`,
    anuncio.adiamentos === null ? '' : `${anuncio.adiamentos} ${anuncio.adiamentos === 1 ? 'adiamento restante' : 'adiamentos restantes'}`].filter(Boolean).join(' · ');

  // Uma linha só (ícone, contagem e botões) pra cobrir o mínimo do chat; o número entre parênteses no Adiar é o que ainda resta.
  return (
    <section className="aviso-anuncio" id="aviso-anuncio" role="alert" title={dica}>
      <div className="anuncio-linha">
        <IconePlataforma id="twitch" tamanho={13} />
        <span className="anuncio-titulo">Anúncio</span>
        <span className="anuncio-tempo" id="anuncio-tempo">{faltam > 0 ? contagem(faltam) : 'agora'}</span>
        {anuncio.teste && <span className="anuncio-teste">teste</span>}
        <span className="anuncio-botoes">
          <button type="button" className="primario" id="anuncio-adiar" disabled={pedindo || semAdiamentos || semAcao}
                  title={semAdiamentos ? 'A Twitch não tem mais adiamentos' : semAcao ? `Falta a ação “${NOME_DA_ACAO_DE_ANUNCIO}” no Streamer.bot` : 'Empurra o anúncio em 5 minutos'}
                  onClick={adiar}>{pedindo ? 'Pedindo…' : `Adiar 5 min${anuncio.adiamentos === null ? '' : ` (${anuncio.adiamentos})`}`}</button>
          <button type="button" id="anuncio-rodar" onClick={() => setAnuncio(a => dispensar(a))}>Deixar rodar</button>
        </span>
      </div>
      {semAcao && !status && <p className="status status-erro">Falta a ação “{NOME_DA_ACAO_DE_ANUNCIO}” no Streamer.bot (o nome precisa ser exatamente igual; docs/INSTRUCOES.md).</p>}
      {status && <p className={`status${status.erro ? ' status-erro' : ''}`} id="anuncio-status">{status.texto}</p>}
    </section>
  );
}
