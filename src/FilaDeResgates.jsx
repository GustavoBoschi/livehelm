// A fila de resgates da Twitch (aba Resgates do chat, ligada nas configurações): cada resgate de pontos com o nome, a recompensa, o texto que a pessoa escreveu e os
// botões Cumprir e Reembolsar (ação `Painel: Controles`). Só os resgates que chegaram com o dock aberto aparecem (o Streamer.bot não lista os que já estavam na fila
// da Twitch). Recompensa que se completa sozinha (skip queue) entra como "automático", sem botões. A Kick não tem cumprir nem reembolsar no Streamer.bot.
import { IconePlataforma } from './Icones.jsx';
import { PLATAFORMAS } from './plataformas.js';

const ROTULO_DO_ESTADO = { cumprido: 'cumprido', reembolsado: 'reembolsado', automatico: 'automático', semid: 'sem id no evento: resolva pela Twitch' };

export default function FilaDeResgates({ fila, aoDecidir, conectado, semAcao }) {
  if (fila.length === 0) {
    return <p className="vazio" id="fila-vazia">{!conectado ? 'Os resgates aparecem aqui quando o Streamer.bot estiver conectado.' : 'Nenhum resgate ainda. Os da Twitch que chegarem com o dock aberto aparecem aqui.'}</p>;
  }
  return fila.map(i => {
    const semId = !i.redemptionId || !i.rewardId;
    const resolvido = i.estado === 'cumprido' || i.estado === 'reembolsado' || i.estado === 'automatico' || i.estado === 'semid';
    return (
      <div key={i.uid} className={`linha linha-fila linha-fila-${i.estado}`} id={`resgate-${i.uid}`} style={{ '--cor-plataforma': PLATAFORMAS.twitch.cor }}>
        <span className="hora">{i.hora}</span>
        <span className="marca-plataforma"><IconePlataforma id="twitch" /></span>
        <div className="conteudo">
          <b>{i.nome}</b>
          {i.detalhe && <span className="alerta-detalhe">{i.detalhe}</span>}
          {i.texto && <span className="alerta-mensagem">{i.texto}</span>}
          {resolvido && <span className="retida-status">{ROTULO_DO_ESTADO[i.estado]}</span>}
          {!resolvido && (
            <span className="retida-botoes">
              <button type="button" className="retida-permitir" id={`cumprir-${i.uid}`} disabled={!conectado || semAcao || semId || i.estado === 'enviando'} onClick={() => aoDecidir(i, 'cumprir')}
                      title={semId ? 'O evento deste resgate não trouxe o id: cumpra pela Twitch' : 'Marca o resgate como cumprido na Twitch'}>Cumprir</button>
              <button type="button" className="retida-negar" id={`reembolsar-${i.uid}`} disabled={!conectado || semAcao || semId || i.estado === 'enviando'} onClick={() => aoDecidir(i, 'reembolsar')}
                      title={semId ? 'O evento deste resgate não trouxe o id: reembolse pela Twitch' : 'Devolve os pontos a quem resgatou'}>Reembolsar</button>
            </span>
          )}
          {i.erro && <span className="retida-status retida-erro">{i.erro}</span>}
        </div>
      </div>
    );
  });
}
