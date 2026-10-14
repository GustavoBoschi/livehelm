// Enquetes e previsões (só na Twitch): escolher o tipo, escrever a pergunta, as opções (separadas por |) e a duração, e
// iniciar; e o controle da que está no ar (encerrar, travar apostas, dizer quem
// venceu, cancelar). Tudo sai pela ação `Painel: Chat`. A que está no ar vem dos eventos da Twitch (o id e as opções com
// id chegam em `alerta.interacao`, ver streamerbot.js); sem o id no evento, os botões de controle ficam desligados.
import { useEffect, useState } from 'react';
import { assinarStreamerbot } from './streamerbot.js';
import { executarChat } from './acoes.js';
import { ler, gravar } from './armazenamento.js';

const DURACAO_PADRAO = { enquete: 60, previsao: 120 };

const opcoesDe = texto => texto.split(texto.includes('|') ? '|' : ',').map(o => o.trim()).filter(Boolean);

// Limites da Twitch: enquete de 2 a 5 opções, previsão de 2 a 10; título de 60 (enquete) ou 45 (previsão); opção até 25.
function validar(tipo, pergunta, opcoes, duracao) {
  const previsao = tipo === 'previsao';
  if (!pergunta) return 'Escreva a pergunta.';
  if (pergunta.length > (previsao ? 45 : 60)) return `A pergunta passa de ${previsao ? 45 : 60} letras (limite da Twitch).`;
  if (opcoes.length < 2) return 'Coloque pelo menos 2 opções, separadas por | (barra).';
  if (opcoes.length > (previsao ? 10 : 5)) return `No máximo ${previsao ? 10 : 5} opções.`;
  if (opcoes.some(o => o.length > 25)) return 'Cada opção tem no máximo 25 letras.';
  if (!(duracao >= (previsao ? 30 : 15) && duracao <= 1800)) return `A duração vai de ${previsao ? 30 : 15} a 1800 segundos.`;
  return null;
}

export default function Interacoes({ ativas, conectado }) {
  const [recolhido, setRecolhido] = useState(() => ler('interRecolhida', false));
  const [tipo, setTipo] = useState('enquete');
  const [pergunta, setPergunta] = useState('');
  const [opcoes, setOpcoes] = useState('');
  const [duracao, setDuracao] = useState('60');
  const [enquete, setEnquete] = useState(null);   // { id, titulo, opcoes }
  const [previsao, setPrevisao] = useState(null); // { id, titulo, opcoes, travada }
  const [status, setStatus] = useState(null);     // { texto, erro }
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => assinarStreamerbot(ev => {
    const i = ev.tipo === 'alerta' ? ev.alerta.interacao : null;
    if (!i) return;
    switch (i.evento) {
      case 'PollCreated': setEnquete(i); break;
      case 'PollCompleted':
      case 'PollTerminated': setEnquete(null); break;
      case 'PredictionCreated': setPrevisao({ ...i, travada: false }); break;
      case 'PredictionLocked': setPrevisao(p => ({ ...(p || i), travada: true })); break;
      case 'PredictionCompleted':
      case 'PredictionCanceled': setPrevisao(null); break;
      default:
    }
  }), []);

  function alternarRecolhido() { gravar('interRecolhida', !recolhido); setRecolhido(!recolhido); }

  // Cada tipo tem a sua duração padrão: 1 minuto na enquete e 2 minutos pra apostar na previsão.
  function trocarTipo(novo) {
    setTipo(novo);
    const atual = parseInt(duracao, 10);
    if (!(atual > 0) || atual === 60 || atual === 120) setDuracao(String(DURACAO_PADRAO[novo]));
  }

  async function iniciar(t, p, textoOpcoes, d) {
    if (!ativas.twitch) { setStatus({ texto: 'A Twitch está desativada (ícone no alto). Ative para criar.', erro: true }); return; }
    const lista = opcoesDe(textoOpcoes);
    const invalido = validar(t, p.trim(), lista, d);
    if (invalido) { setStatus({ texto: invalido, erro: true }); return; }
    setOcupado(true);
    const erro = await executarChat(t, { plataforma: 'twitch', titulo: p.trim(), opcoes: lista.join('|'), duracao: d });
    setOcupado(false);
    setStatus(erro
      ? { texto: `Não consegui iniciar: ${erro}`, erro: true }
      : { texto: `${t === 'previsao' ? 'Previsão' : 'Enquete'} enviada à Twitch. Se ela não aparecer aqui em instantes, confira se já não há uma no ar.`, erro: false });
  }

  async function controlar(verbo, i, vencedorId = '') {
    const erro = await executarChat(verbo, { plataforma: 'twitch', id: i.id, vencedorId });
    setStatus(erro ? { texto: `Não consegui: ${erro}`, erro: true } : null);
  }

  const botao = (texto, verbo, i, vencedorId = '') => {
    const semId = !i.id || (verbo === 'resolver_previsao' && !vencedorId);
    return (
      <button key={texto} type="button" disabled={semId} title={semId ? 'O Streamer.bot não mandou o identificador no evento; controle esta pela Twitch.' : undefined}
              onClick={() => controlar(verbo, i, vencedorId)}>{texto}</button>
    );
  };
  const noAr = enquete || previsao;

  return (
    <section className="cartao" id="painel-inter">
      <button type="button" className="cabecalho" onClick={alternarRecolhido} aria-expanded={!recolhido}>
        <span className="seta">{recolhido ? '▸' : '▾'}</span>
        <span className="titulo-painel">Enquetes e previsões</span>
        {noAr && <span className="resumo">{previsao ? `previsão no ar: ${previsao.titulo}` : `enquete no ar: ${enquete.titulo}`}</span>}
      </button>
      {!recolhido && (
        <div className="corpo-live">
          {noAr && (
            <div className="no-ar" id="inter-no-ar">
              {enquete && (
                <div><b>Enquete no ar:</b> {enquete.titulo}
                  <div className="controles">{botao('Encerrar enquete', 'encerrar_enquete', enquete)}</div>
                </div>
              )}
              {previsao && (
                <div><b>Previsão {previsao.travada ? 'travada' : 'aberta'}:</b> {previsao.titulo}
                  <div className="controles">
                    {!previsao.travada && botao('Travar apostas', 'travar_previsao', previsao)}
                    {previsao.opcoes.map(o => botao(`Venceu: ${o.nome}`, 'resolver_previsao', previsao, o.id))}
                    {botao('Cancelar previsão', 'cancelar_previsao', previsao)}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="segmentos" role="radiogroup" aria-label="Tipo">
            <button type="button" role="radio" aria-checked={tipo === 'enquete'} id="tipo-enquete" className={tipo === 'enquete' ? 'segmento-ativo' : ''} onClick={() => trocarTipo('enquete')}>Enquete</button>
            <button type="button" role="radio" aria-checked={tipo === 'previsao'} id="tipo-previsao" className={tipo === 'previsao' ? 'segmento-ativo' : ''} onClick={() => trocarTipo('previsao')}>Previsão</button>
          </div>
          <input id="inter-pergunta" type="text" value={pergunta} placeholder="Pergunta" onChange={e => setPergunta(e.target.value)} />
          <input id="inter-opcoes" type="text" value={opcoes} placeholder="Opções, separadas por |" onChange={e => setOpcoes(e.target.value)} />
          <div className="linha-categoria">
            <input id="inter-duracao" type="text" inputMode="numeric" value={duracao} title="Duração em segundos" placeholder="seg" onChange={e => setDuracao(e.target.value)} />
            <button type="button" id="inter-iniciar" className="primario" disabled={!conectado || ocupado}
                    onClick={() => iniciar(tipo, pergunta, opcoes, parseInt(duracao, 10))}>Iniciar</button>
          </div>
          {status && <p className={`aviso${status.erro ? '' : ' aviso-ok'}`} id="inter-status">{status.texto}</p>}
        </div>
      )}
    </section>
  );
}
