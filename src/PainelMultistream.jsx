// Painel de Multistream: mais um painel do dock (liga e desliga pelas bolinhas azuis e nas configurações), só com os botões Iniciar lives e
// Parar lives. Eles fazem o mesmo que Iniciar e Parar transmissão do OBS; os destinos do plugin de multistream seguem junto quando ele está com
// "sincronizar início e fim". Os dois pedem confirmação dentro da página. A saúde do OBS (fps, CPU, rede) fica no alto, em SaudeDoObs.jsx.
import { useEffect, useState } from 'react';
import { ler, gravar } from './armazenamento.js';
import { iniciarTransmissao, pararTransmissoes } from './obsSaude.js';

const SEGUNDOS_DO_RESULTADO = 10;

export default function PainelMultistream({ saude, obs }) {
  const [recolhido, setRecolhido] = useState(() => ler('multistreamRecolhido', false));
  const [pergunta, setPergunta] = useState(null); // 'iniciar' | 'parar'
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [andamento, setAndamento] = useState(null); // enquanto para: { delayS, restantes, esperouS }

  useEffect(() => {
    if (!resultado) return undefined;
    const t = setTimeout(() => setResultado(null), SEGUNDOS_DO_RESULTADO * 1000);
    return () => clearTimeout(t);
  }, [resultado]);

  const conectado = Boolean(saude && saude.conectado);
  const noAr = conectado && saude.ativo;

  function alternarRecolhido() {
    gravar('multistreamRecolhido', !recolhido);
    setRecolhido(!recolhido);
  }
  async function iniciar() {
    setPergunta(null);
    setOcupado(true);
    const r = await iniciarTransmissao(obs);
    setOcupado(false);
    setResultado(r.ok ? { nivel: 0, texto: r.jaEstava ? 'A transmissão já estava no ar.' : 'Pedi ao OBS para iniciar a live. Os destinos do multistream entram junto se o plugin estiver com "sincronizar início".' } : { nivel: 2, texto: `Não consegui iniciar: ${r.erro}` });
  }
  async function parar() {
    setPergunta(null);
    setOcupado(true);
    const r = await pararTransmissoes(obs, setAndamento);
    setOcupado(false);
    setAndamento(null);
    setResultado(r.ok
      ? { nivel: 0, texto: r.nadaNoAr ? 'Nada estava no ar.' : r.delayS > 0 ? `Lives paradas. O OBS esperou o delay de ${r.delayS} s esvaziar antes de fechar.` : 'Lives paradas.' }
      : { nivel: 2, texto: `Não consegui parar tudo: ${r.erro}` });
  }

  return (
    <section className="cartao" id="painel-multistream">
      <button type="button" className="cabecalho" onClick={alternarRecolhido} aria-expanded={!recolhido}>
        <span className="seta">{recolhido ? '▸' : '▾'}</span>
        <span className="titulo-painel">Multistream</span>
        {recolhido && <span className="resumo">{noAr ? 'no ar' : 'parado'}</span>}
      </button>
      {!recolhido && (
        <div className="corpo-multistream">
          <div className="multistream-botoes">
            {pergunta === null && !ocupado && (
              <>
                <button type="button" id="botao-iniciar-lives" className="primario" disabled={!conectado || noAr} title={noAr ? 'A transmissão já está no ar' : 'Inicia a transmissão do OBS e os destinos do multistream'} onClick={() => setPergunta('iniciar')}>Iniciar lives</button>
                <button type="button" id="botao-parar-lives" className="perigo" disabled={!noAr} title={noAr ? 'Para a transmissão do OBS e os destinos do multistream' : 'Nada está no ar no OBS'} onClick={() => setPergunta('parar')}>Parar lives</button>
              </>
            )}
            {pergunta !== null && (
              <div className="multistream-confirmacao" id="confirmacao-multistream" role="alertdialog">
                <span>{pergunta === 'iniciar' ? 'Iniciar as lives agora?' : 'Parar todas as lives agora?'}</span>
                <button type="button" id="confirmar-multistream" className={pergunta === 'iniciar' ? 'primario' : 'perigo'} onClick={pergunta === 'iniciar' ? iniciar : parar}>{pergunta === 'iniciar' ? 'Iniciar' : 'Parar'}</button>
                <button type="button" id="cancelar-multistream" onClick={() => setPergunta(null)}>Cancelar</button>
              </div>
            )}
            {ocupado && (
              <span className="multistream-andamento">
                {andamento && andamento.restantes > 0
                  ? `Parando… esperando o delay${andamento.delayS > 0 ? ` de ${andamento.delayS} s` : ''} terminar: ${andamento.esperouS} s`
                  : 'Aguarde…'}
              </span>
            )}
          </div>
          {!conectado && <p className="dica">Sem conexão com o OBS: confira o endereço e a senha nas configurações.</p>}
          {resultado && <p className={`status nivel-${resultado.nivel}`}>{resultado.texto}</p>}
        </div>
      )}
    </section>
  );
}
