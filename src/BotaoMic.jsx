// Botão de mudo do microfone: uma caixinha no alto, ao lado esquerdo da bolinha azul dos painéis, que não some. Um clique liga ou tira do mudo a entrada de áudio
// escolhida nas configurações, pelo WebSocket do OBS, sem caçar o microfone no mixer. Verde com o microfone aberto, vermelho cheio no mudo, cinza quando o OBS
// não está conectado ou a entrada não existe (o tamanho é sempre o mesmo). O estado vem da leitura contínua do OBS (obsSaude.js), que o OBS atualiza na hora quando
// o mudo muda por outro caminho.
import { useEffect, useState } from 'react';
import { alternarMudoDaEntrada } from './obsSaude.js';

export default function BotaoMic({ saude, obs, entrada }) {
  const conectado = Boolean(saude && saude.conectado);
  const [mudoLocal, setMudoLocal] = useState(null); // o estado que o último clique deixou, até a próxima leitura do OBS
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState('');
  // A leitura do OBS (e o evento de mudo) manda: quando chega uma, a marca local sai.
  useEffect(() => { setMudoLocal(null); }, [saude && saude.micMudo, saude && saude.lidoEm]);

  const mudoLido = conectado ? saude.micMudo : null;
  const mudo = mudoLocal ?? mudoLido;
  const semEntrada = conectado && mudo === null;
  const pode = conectado && !trocando && !semEntrada;

  async function alternar() {
    if (!pode) return;
    setTrocando(true);
    setErro('');
    const r = await alternarMudoDaEntrada(obs, entrada);
    if (r.ok) setMudoLocal(r.mudo);
    else setErro(r.erro);
    setTrocando(false);
  }

  let dica = `Microfone ligado: clique para colocar “${entrada}” no mudo`;
  let classe = 'mic-ligado';
  if (!conectado) { dica = 'Microfone: o OBS não está conectado (confira o endereço e a senha nas configurações)'; classe = 'mic-indisponivel'; }
  else if (semEntrada) { dica = saude.micErro || `Não achei a entrada “${entrada}” no OBS: escolha o microfone de novo nas configurações`; classe = 'mic-indisponivel'; }
  else if (mudo) { dica = `Microfone no mudo: clique para tirar “${entrada}” do mudo`; classe = 'mic-mudo'; }
  if (erro) dica = erro;

  return (
    <button type="button" id="botao-mic" className={`botao-mic ${classe}`} aria-pressed={Boolean(mudo)} aria-label={dica} disabled={!pode} title={dica} onClick={alternar}>
      <svg className="icone" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6" />
        {mudo && <path d="M4 4l16 16" />}
      </svg>
    </button>
  );
}
