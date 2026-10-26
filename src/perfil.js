// O perfil de quem escreve no chat (cartão do ChatPanel): o link do perfil em cada plataforma e a idade da conta. Sem React nem rede.

const slug = s => encodeURIComponent(String(s || '').trim());

// O endereço do perfil da pessoa. Twitch e Kick usam o login (a Kick troca "_" por "-" no endereço); o YouTube só tem o canal pelo id (UC...).
// Devolve '' quando falta o dado. O dock não abre o link (abrir dentro do dock o tiraria da tela): o cartão o copia.
export function linkDoPerfil({ plataforma, login, userId, nome }) {
  const quem = String(login || nome || '').trim().toLowerCase();
  if (plataforma === 'twitch') return quem ? `https://www.twitch.tv/${slug(quem)}` : '';
  if (plataforma === 'kick') return quem ? `https://kick.com/${slug(quem.replace(/_/g, '-'))}` : '';
  if (plataforma === 'youtube') return /^UC[\w-]{20,}$/.test(String(userId || '')) ? `https://www.youtube.com/channel/${userId}` : '';
  return '';
}

// "6 anos e 5 meses", "3 meses", "12 dias": há quanto tempo a conta existe (iso = data de criação). '' se a data não serve.
export function idadeDaConta(iso, agora = Date.now()) {
  const inicio = Date.parse(iso);
  if (!Number.isFinite(inicio) || inicio > agora) return '';
  const dias = Math.floor((agora - inicio) / 86400000);
  if (dias < 31) return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  // meses de calendário (a média de dias erraria na virada do ano)
  const de = new Date(inicio);
  const ate = new Date(agora);
  let meses = (ate.getUTCFullYear() - de.getUTCFullYear()) * 12 + (ate.getUTCMonth() - de.getUTCMonth());
  if (ate.getUTCDate() < de.getUTCDate()) meses--;
  meses = Math.max(1, meses);
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return `${anos} ${anos === 1 ? 'ano' : 'anos'}${resto ? ` e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : ''}`;
}

// "Tier 1", "Tier 2", "Tier 3" ou "Prime" a partir do que a Twitch manda ("1000", "2000", "3000", "Prime").
export function nivelDeSub(bruto) {
  const t = String(bruto || '').trim();
  if (/prime/i.test(t)) return 'Prime';
  const m = /^([123])000$/.exec(t) || /^tier\s*([123])$/i.exec(t) || /^([123])$/.exec(t);
  return m ? `Tier ${m[1]}` : t;
}
