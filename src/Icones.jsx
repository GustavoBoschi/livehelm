// Ícones do Dock: traços em viewBox 24x24 (e os das plataformas, de plataformas.js.
import { PLATAFORMAS } from './plataformas.js';

const TRACOS = {
  globo: 'M12,3 A9,9 0 1 1 11.99,3 Z M3,12 L21,12 M12,3 C8,7 8,17 12,21 M12,3 C16,7 16,17 12,21',
  banir: 'M12,3 A9,9 0 1 1 11.99,3 Z M5.6,18.4 L18.4,5.6',
  tempo: 'M12,3 A9,9 0 1 1 11.99,3 Z M12,7 L12,12 L15.5,14.5',
  lixeira: 'M5,7 L19,7 M9,7 L9,4 L15,4 L15,7 M7,7 L8,20 L16,20 L17,7 M10,11 L10,17 M14,11 L14,17',
  mais: 'M12,5 L12,5.01 M12,12 L12,12.01 M12,19 L12,19.01',
  lupa: 'M11,4 A7,7 0 1 1 10.99,4 Z M16,16 L21,21',
  pergunta: 'M12,3 A9,9 0 1 1 11.99,3 Z M9.3,9.5 C9.3,7.2 14.7,7.2 14.7,9.7 C14.7,11.8 12,11.6 12,14 M12,16.5 L12,17.2',
  fixar: 'M9,3 L15,3 M10,3 L10,10 L7,14 L17,14 L14,10 L14,3 M12,14 L12,21',
  responder: 'M10,6 L4,12 L10,18 M4,12 L15,12 C19,12 20,14 20,18',
};

export function Traco({ nome, tamanho = 15 }) {
  return (
    <svg className="icone" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={nome === 'mais' ? 2.6 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRACOS[nome]} />
    </svg>
  );
}

export function IconePlataforma({ id, tamanho = 14 }) {
  const p = PLATAFORMAS[id];
  if (!p || !p.icone) return null;
  return (
    <svg className="icone" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" aria-label={p.nome}>
      <path d={p.icone} />
    </svg>
  );
}

// O d20 âmbar do app, de frente, em 10 faces. Com `aceso` brilha; sem, fica
// só o contorno apagado.
const FACES_D20 = [
  '60,40 78,71 42,71', '60,26 89,43 60,40', '60,26 31,43 60,40', '89,43 78,71 60,40', '31,43 42,71 60,40',
  '89,43 89,77 78,71', '31,43 31,77 42,71', '78,71 89,77 60,94', '42,71 31,77 60,94', '42,71 78,71 60,94',
];
export function D20Ambar({ aceso, largura = 24 }) {
  return (
    <svg className={`d20-ambar${aceso ? ' aceso' : ''}`} width={largura} height={Math.round(largura * 76 / 68)} viewBox="26 22 68 76" aria-hidden="true">
      {FACES_D20.map((p, i) => <polygon key={i} className="d20-face" points={p} />)}
    </svg>
  );
}
