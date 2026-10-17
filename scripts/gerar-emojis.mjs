// Gera src/emojisDados.js a partir do pacote emojibase-data (devDependency): a lista de todos os emojis do seletor do título, com nome e palavras de
// busca em português e em inglês, tons de pele e o grupo. Rode `npm run emojis` ao atualizar o pacote; o resultado vai para o repositório, então o
// build do dock não depende dele.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pt = require('emojibase-data/pt/data.json');
const en = require('emojibase-data/en/data.json');

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ingles = new Map(en.map(e => [e.hexcode, e]));

// Grupos do emojibase: 0 rostos, 1 pessoas, 3 animais e natureza, 4 comida, 5 viagens, 6 atividades, 7 objetos, 8 símbolos, 9 bandeiras.
// O 2 são só componentes (tons de pele soltos) e fica de fora, assim como o que não tem grupo.
const GRUPOS = new Set([0, 1, 3, 4, 5, 6, 7, 8, 9]);

const linhas = [];
for (const e of pt) {
  if (!GRUPOS.has(e.group)) continue;
  const e2 = ingles.get(e.hexcode);
  const busca = [...new Set(semAcento([e.label, ...(e.tags || []), e2 ? e2.label : '', ...(e2 && e2.tags ? e2.tags : [])].join(' ')).split(/\s+/).filter(Boolean))].join(' ');
  // só os tons simples (1 a 5); combinações de dois tons ficam de fora
  const peles = {};
  for (const s of e.skins || []) if (typeof s.tone === 'number') peles[s.tone] = s.emoji;
  linhas.push([e.emoji, e.label, busca, e.group, e.version, Object.keys(peles).length ? peles : 0]);
}

const saida = `// Gerado por scripts/gerar-emojis.mjs (npm run emojis) a partir do emojibase-data: não edite à mão.
// [emoji, nome, palavras de busca sem acento (pt e en), grupo, versão do Unicode, { tom: emoji } ou 0]
export default ${JSON.stringify(linhas)};
`;
fs.writeFileSync(new URL('../src/emojisDados.js', import.meta.url), saida);
console.log(`${linhas.length} emojis, ${(saida.length / 1024).toFixed(0)} KB`);
