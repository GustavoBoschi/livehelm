// Doações do LivePix no dock: sem React nem DOM. O aviso vem da ação `LivePix` do Streamer.bot (acoes-streamerbot/LivePix.cs deste projeto, a mesma que alimenta o Overlay Dinâmico
// de Lives), que consulta a API do LivePix e avisa cada doação nova como uma mensagem personalizada { event: { source: 'Custom', type: 'LivePix' }, data: {...} }. Ela chega ao dock
// como `General.Custom` (o Dock assina esse evento, streamerbot.js) e vira um alerta nas abas Alertas e Tudo (com o fundo na cor do LivePix, `.linha-livepix`).

const MAX_MENSAGEM = 220; // a mensagem do doador é cortada aqui, como no overlay

const texto = v => (v === undefined || v === null ? '' : String(v).trim());

// Acha os dados da doação numa mensagem do WebSocket do Streamer.bot, seja qual for o envelope: o aviso de `WebsocketBroadcastJson` chega como `General.Custom` com o nosso
// JSON dentro de `data`, como objeto ou como texto (a documentação não deixa claro, então vale os dois e um envelope a mais). null se a mensagem não é do LivePix.
export function dadosDoLivePixNaMensagem(msg) {
  if (!msg || !msg.event) return null;
  const { source, type } = msg.event;
  if (source === 'Custom' && type === 'LivePix') return msg.data && typeof msg.data === 'object' ? msg.data : null;
  if (source !== 'General' || type !== 'Custom') return null;
  let carga = msg.data;
  for (let i = 0; i < 3 && carga !== undefined && carga !== null; i++) {
    if (typeof carga === 'string') {
      try { carga = JSON.parse(carga); } catch (_) { return null; }
    }
    if (!carga || typeof carga !== 'object') return null;
    if (carga.event && carga.event.type === 'LivePix') return carga.data && typeof carga.data === 'object' ? carga.data : null;
    carga = carga.data;
  }
  return null;
}

// O LivePix manda o valor em centavos (um número inteiro); com casas decimais é lido como reais. null se não for um valor.
function centavosDaDoacao(valor) {
  const n = Number(valor);
  if (valor === undefined || valor === null || valor === '' || !Number.isFinite(n) || n < 0) return null;
  return Number.isInteger(n) ? n : Math.round(n * 100);
}

// "R$ 15,00"; outra moeda vai como "10,00 USD". Vazio se não for um valor.
export function valorDaDoacao(valor, moeda = 'BRL') {
  const centavos = centavosDaDoacao(valor);
  if (centavos === null) return '';
  const formatado = (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const m = texto(moeda).toUpperCase();
  return !m || m === 'BRL' ? `R$ ${formatado}` : `${formatado} ${m}`;
}

// Os dados do aviso -> o evento { tipo: 'alerta', alerta } do dock ("Nome apoiou", o valor embaixo e a mensagem) com a plataforma `livepix` (a cor e o símbolo dela, plataformas.js). A
// mensagem que o LivePix marcou como imprópria (`flagged`) não aparece, como no overlay: sobra o valor e o aviso de que ficou retida. O reenvio de teste (a ação com acao = ultima)
// leva "teste" no detalhe. null sem dados.
export function alertaDoLivePix(dados) {
  if (!dados || typeof dados !== 'object') return null;
  const nome = texto(dados.username) || 'Anônimo';
  const valor = valorDaDoacao(dados.amount, texto(dados.currency).toUpperCase() || 'BRL');
  const retida = dados.flagged === true;
  let mensagem = retida ? '' : texto(dados.message);
  if (mensagem.length > MAX_MENSAGEM) mensagem = `${mensagem.slice(0, MAX_MENSAGEM - 1).trimEnd()}…`;
  const quando = texto(dados.createdAt);
  return {
    tipo: 'alerta',
    alerta: {
      type: 'livepix',
      event: 'livepix',
      chatname: nome,
      userid: '',
      id: `livepix-${texto(dados.id) || nome}-${quando}`,
      chatimg: '',
      membership: '',
      detalhe: [valor, retida ? 'mensagem retida pelo LivePix' : '', dados.teste === true ? 'teste' : ''].filter(Boolean).join(' · '),
      rotulo: '',
      principal: `${nome} apoiou`,
      antes: '',
      acao: 'apoiou',
      destaque: '',
      mensagem,
      meta: { origem: 'livepix', evento: 'LivePix.Message', quando },
    },
  };
}
