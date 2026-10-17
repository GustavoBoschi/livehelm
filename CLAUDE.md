# LiveHelm: regras para quem mexe no código

Dock de navegador do OBS em React (Vite), de arquivo único: título e categoria, tags da Twitch, momentos, enquetes e previsões,
chat com moderação e aviso de anúncio da Twitch. Fala com o Streamer.bot (WebSocket) e com o OBS (obs-websocket v5). Uso e instalação estão no
[README.md](README.md) e em [docs/INSTRUCOES.md](docs/INSTRUCOES.md); este arquivo guarda só o que é preciso saber para expandir o
código sem quebrar nada.

## Comandos

- `npm run dev` serve em `http://localhost:5173/livehelm.html`. `npm test` roda `node --test` em `tests/`. `npm run build` gera
  `dist/livehelm.html`. `npm run instalador` faz o build e o `Instalar LiveHelm.exe` (precisa do .NET SDK). `npm run emojis` regera `src/emojisDados.js` (a lista dos emojis).
- Antes de terminar uma mudança: `npm test` e `npm run build`. O `.exe` leva o dock **embutido**, então só `build` não o atualiza:
  se o instalador importa, rode `npm run instalador`.

## Regras

- **Sem `<React.StrictMode>`** em `main.jsx`: ele monta os effects duas vezes em desenvolvimento e abriria a conexão com o
  Streamer.bot em dobro.
- **Sem `window.confirm`, `alert` ou `prompt`:** não dá para contar com esses diálogos no navegador do OBS. Confirmações ficam
  dentro da página (o Banir usa a barra `#confirmacao`).
- **Arquivo único:** o build inlina tudo (`vite-plugin-singlefile`). Nada de imagens ou scripts ao lado; ícones e imagens entram
  inline (SVG ou `data:`).
- **Recurso que mexe na live vem desligado:** o aviso de anúncio, que pode adiar um anúncio de verdade, só liga nas configurações
  (`config.anuncio.ligado`). Faça o mesmo com qualquer recurso novo desse tipo.
- **Nada sensível no repositório:** `src/config.js` fica com as senhas vazias. Sem caminhos, contas ou endereços pessoais em código,
  comentários ou documentação. A única identificação pessoal permitida é o crédito de autoria (`LICENSE`, seção "Licença e créditos"
  do README e `author` do `package.json`), inclusive a coautoria do Claude no README e em `contributors`: não os remova.

## Contrato com o Streamer.bot

O dock pede coisas por `DoAction` (`src/acoes.js`), e o código C# em `acoes-streamerbot/` lê os argumentos. **Nomes de ação e de
argumento têm que ser idênticos nos dois lados.** Mudou um, mude o outro e a tabela de ações de `docs/INSTRUCOES.md`.

| Ação | Argumentos |
|---|---|
| `Painel: Twitch`, `Painel: Kick`, `Painel: YouTube` | `tituloLive`, `categoriaLive` |
| `Painel: Tags` | `acao` (`ler`, `definir`, `limpar`; sem `acao` vale `definir`), `tagsLive` (separadas por `\|`), `pedido` |
| `Painel: Momentos` | `linha`, `arquivo`, `pasta` |
| `Painel: Anuncio` (**sem acento** e **sem código**: só a sub-ação `Twitch > Ads > Snooze Next Ad`) | nenhum |
| `Painel: Chat` | `acao` (`enviar`, `apagar`, `silenciar`, `banir`, `reverter`, `limpar`, `enquete`, `previsao`, `encerrar_enquete`, `travar_previsao`, `cancelar_previsao`, `resolver_previsao`), `plataforma`, `mensagem`, `mensagemId`, `usuario`, `usuarioId`, `segundos`, `titulo`, `opcoes`, `duracao`, `id`, `vencedorId` |

- O código C# é conferido contra `Streamer.bot.Plugin.Interface.dll` (métodos `CPH`, versão 1.0.7). Ao mudar, recompile contra ela;
  um `CPH` falso (por exemplo com `DispatchProxy`) permite rodar o `Execute()` e ver o que ele grava.
- Existe a variante sem código `Painel: Enviar|Silenciar|Banir <Plataforma>` (sub-ação nativa); o dock usa a da plataforma quando
  existe e a `Painel: Chat` quando não.
- **As ações são o limite de confiança:** qualquer cliente do WebSocket pode chamá-las, com argumentos que o dock não controla. Valide
  no C# o que for arriscado (a `Painel: Momentos` só grava `.txt` em pasta local com letra de unidade, sem `..` nem caminho de rede,
  uma linha de até 300 letras) e espelhe a regra no dock para avisar o usuário (`src/pastaClipes.js`).

## Conexão e dados

- `streamerbot.js` abre **uma** conexão compartilhada (`assinarStreamerbot`, `pedirStreamerbot`), reconecta sozinha e se inscreve
  de novo a cada abertura. Só faça pedidos depois do evento `conexao` (o `App.jsx` espera antes de ler ações e plataformas). Senha
  errada vira o evento `recusada`. `reconectarStreamerbot` refaz a conexão com a configuração atual.
- **O `DoAction` responde "ok" ao enfileirar**, não quando a ação termina, e não devolve dados.
- **Devolver dados ao dock:** a ação grava numa variável global **não persistente** e o dock a lê com `GetGlobal`
  (`persisted: false`). A resposta real é `{ variables: { nome: { value } } }`. Case a leitura pelo `pedido` (identificador novo a
  cada leitura, para não aceitar valor antigo) e repita até chegar (`aguardarLeitura`).
- **Confirmação de título e categoria** vem dos eventos `StreamUpdate` (Twitch: `status`, `game.name`) e `ChannelUpdate` (Kick:
  `title`, `categoryName`), convertidos em `atualizacao` e entregues por `notificarAtualizacao`.
- `converterEventoStreamerbot` é puro. Campos sem esquema documentado são lidos de forma defensiva (vários candidatos, vazio se
  faltar). Só `Twitch.ChatMessage`, `Kick.ChatMessage` e `Twitch.Follow` foram vistos com dados reais.
- **Resgates de pontos:** `Twitch.RewardRedemption` (recompensa personalizada: `reward.title`, `reward.cost`, `user`), `Twitch.AutomaticRewardRedemption`
  (recompensas padrão: `rewardType`, `channelPoints`, `user`; os tipos têm nome em português em `RECOMPENSAS_PADRAO`) e `Kick.RewardRedemption`
  (sem esquema documentado: `redeemer` ou `user`, título e custo por vários candidatos). Todos viram o alerta `reward`; sem nome de quem resgatou ele
  aparece como "Alguém" em vez de sumir (`nomePadrao`; o aviso no console lista os campos recebidos). `usuarioDe` aceita o objeto `user`, um texto no lugar dele
  e os campos soltos (`user_name`, `userName`...). O texto que a pessoa escreveu junto (`userInput` na Twitch, `text` nas recompensas padrão, candidatos na Kick) vai
  em `alerta.mensagem` e o `ChatPanel` o mostra entre aspas abaixo do alerta. Power-ups pagos com Bits (`PowerUpRedemption`) não são assinados.
- **Cor do nick:** a plataforma manda `user.color` (Twitch e Kick); sem ela (YouTube, e quem nunca escolheu na Twitch) `corPadraoDoNome` sorteia uma cor da paleta
  padrão da Twitch pelo id ou nome, sempre a mesma para a mesma pessoa (`nameColor` da mensagem).
- `Twitch.UpcomingAd` dispara **uma vez por minuto nos 5 minutos** antes do anúncio. Segundo a documentação do Streamer.bot traz
  `minutes`, `nextAdAt` (hora exata, UTC), `adLength` (s) e `snoozesLeft`; `streamerbot.js` os lê (`segundosDe`, `anuncioDe`) e o
  alerta leva `segundos` e `anuncio`. O formato no WebSocket ainda não foi visto com um anúncio real: confirme (Test Trigger no
  Streamer.bot) antes de mudar a leitura.
- A conexão com o OBS (`obs.js`) abre, autentica, pergunta e fecha a cada uso. O tempo vale o da transmissão; sem transmissão, o da
  gravação.

## Estado e configuração

- Preferências usam `ler`/`gravar` (`armazenamento.js`, prefixo `livehelm.`), que nunca lançam: sem armazenamento, o dock só não
  lembra de nada.
- Configurações ficam em `configuracoes.js`, **por seção** (`lerConfig` mescla o salvo com o padrão seção por seção): `tema`,
  `streamerbot`, `obs`, `momentos`, `alertasNoChat` e `anuncio`. Opção nova = seção nova ali e um bloco em `Configuracoes.jsx`. Endereço e senha: a URL
  (`?streamerbot=`, `?sbsenha=`) vale antes do salvo, e este antes de `config.js`.
- O tema é escrito por `aplicarTema` em variáveis CSS no `<html>` (`--acento`, `--acento-claro`, `--acento-rgb`,
  `--acento-texto` e as de fundo), e `main.jsx` o aplica antes do primeiro quadro. O CSS usa `rgba(var(--acento-rgb), x)`, nunca
  uma cor de destaque fixa.

## Recursos

- **Tags** (`Tags.jsx`, `tagsLista.js`): só Twitch (não há método de tags na Kick e a do YouTube precisa do id da transmissão). O
  painel mostra as tags do canal num rascunho; só o Aplicar manda (`definir`, ou `limpar` com a lista vazia).
- **Momentos** (`Momentos.jsx`): a linha (`Clipe N - HH:MM:SS` ou `<título> - HH:MM:SS`) é montada no dock e escrita pela ação. Como
  o Streamer.bot não devolve resultado, **o dock é o responsável pela numeração** (`contador.<arquivo>`).
- **Chat** (`ChatPanel.jsx`, `punicoes.js`): `punicoes.js` junta o que o dock fez e o que a plataforma avisou. O verbo `reverter`
  responde ok mesmo com código antigo, então o item só ganha a hora do pedido. O feed guarda no máximo `MAX_ITENS` linhas. O dock
  assina os eventos direto e recebe mesmo com o painel escondido.
- **Abas do chat** (`alertas.js`, puro): a aba Tudo mostra as mensagens e os alertas escolhidos; o padrão é `ALERTAS_NO_CHAT_GERAL` (seguidor,
  subs, presentes, Bits, raid, resgate de pontos, Hype Chat, Super Chat e afins), uma lista **permitida**: um alerta novo de `ALERTAS` (em
  `streamerbot.js`) fica só na aba Alertas até entrar nela. Todo alerta também precisa constar em `TIPOS_DE_ALERTA` (o catálogo que as
  configurações oferecem, com um teste que cobra isso). O usuário liga ou desliga cada tipo em Configurações > Alertas no chat
  (`config.alertasNoChat.escolhas`: só o que difere do padrão é gravado); a aba Alertas mostra todos, sempre. Anúncio, hype train, votação, previsão e os avisos de moderação do dock
  (`evento: 'moderacao'`: banido, silenciado, chat limpo) também ficam só nessa aba, que mostra todos os alertas. As abas de plataforma mostram o mesmo que a Tudo, só daquela plataforma (`passaNaAba`). `ChatPanel.jsx`
  guarda o tipo no item (`evento`), usa `passaNaAba` com as escolhas e fica **montado, só escondido** (`oculto`) com as configurações abertas, para
  o feed não se perder; ele relê as escolhas quando volta a aparecer; o resgate de pontos ganha a classe `linha-resgate` (fundo na cor da plataforma).
- **Título e categoria** (`LivePanel.jsx`, `atualizarLive` em `acoes.js`): o resultado de cada plataforma some sozinho em `SEGUNDOS_DOS_AVISOS` (10 s) se for ok ou aviso; o erro fica até a próxima ação. O evento de confirmação sem título ou categoria (vazio) não conta como "ficou diferente".
- **Primeira mensagem** (etiqueta no chat): vem da marca da própria mensagem (`ehPrimeiraMensagem` em `streamerbot.js`: Twitch `meta.firstMessage`, Kick `FirstMessage`, YouTube `meta.FirstMessage`), que vale pro canal inteiro. O gatilho First Words do Streamer.bot só vale pra sessão (zera em 12 h ou ao entrar no ar) e não é mais assinado.
- **Painel de Multistream** (`PainelMultistream.jsx`; config `multistream: { ligado }`, **vem desligado** (os botões mexem na live): mostra `SaudeDoObs.jsx` (fps, CPU, rede e qualidade, abaixo dos botões de plataforma no alto) e põe o painel dos botões Iniciar e Parar lives (`PainelMultistream.jsx`, um painel comum) na lista das bolinhas azuis; `TempoDeLive.jsx` põe o tempo ao lado do símbolo de cada plataforma no alto; `useSaudeDoObs.js` mantém a leitura do OBS no `App`; `obsSaude.js`, `lives.js`): espectadores (`ViewerCountUpdate`, `StatisticsUpdated`) e início/fim (`StreamOnline`/`StreamOffline`, `BroadcastStarted`/`Ended`) viram os eventos `espectadores` e `transmissao` em `streamerbot.js`; `lives.js` (puro) guarda o estado por plataforma e soma os espectadores (aviso com mais de 5 min não conta). `obsSaude.js` lê o OBS a cada 3 s (`GetStats`, `GetStreamStatus`, `GetOutputList`). A **Twitch é a transmissão principal do OBS** (botão nativo) e a fonte do tempo e da rede dela (`msPrincipal`); YouTube e Kick são destinos do obs-multi-rtmp, saídas **com o mesmo nome**, então só se consulta o status da primeira (`GetOutputStatus`, `msDestinos`), que serve de reserva. No alto, `App.jsx` escolhe o início de cada plataforma (`tempoDaPlataforma`): Twitch = principal do OBS, depois o aviso da Twitch, depois os destinos; YouTube/Kick = o aviso delas, depois os destinos, depois a principal. O painel Multistream fica logo abaixo do chat. `pararTransmissoes` pede a parada uma vez (`StopStream` na principal, com os destinos acompanhando pelo "sincronizar início e fim"; sem a principal, um `StopOutput`), nunca força, lê o delay do OBS (`GetProfileParameter` Output/DelayEnable e DelaySec) e espera as saídas deixarem de estar no ar, em até o delay mais 15 s, mostrando o andamento. Iniciar ou parar **um** destino do multistream por fora não existe: todos se chamam `multi-output`, o plugin não tem API (WebSocket, atalhos) e o OBS só alcança o primeiro por nome. Os botões Iniciar lives (`StartStream`) e Parar lives confirmam dentro da página e fazem o mesmo que os do OBS (os destinos do multistream acompanham pelo "sincronizar início e fim" do plugin); a linha de qualidade vem de `qualidadeDeQuadros` e `problemasDaTransmissao` (`lives.js`, a partir de `GetStats` e do congestionamento). Não há como abrir o painel do plugin de multistream pelo WebSocket do OBS. No chat, `filtro` é `'tudo'`, `'alertas'` ou uma **lista** de plataformas marcadas (clique em mais de uma aba de plataforma), e é para essa lista que `enviar` manda. O SHA-256 da senha é próprio (`sha256.js`): o navegador do OBS pode não ter `crypto.subtle`.
- **Subs de presente** (`presenteou`, `listaDePresenteados` em `streamerbot.js`): o alerta diz "Fulano presenteou" e, embaixo, "Para Beltrano" (Twitch `GiftSub.recipient`, Kick `GiftSubscription.recipient`, YouTube `GiftMembershipReceived.user`) ou a lista com "e mais N" (Twitch `GiftBomb.recipients`, Kick `MassGiftSubscription.recipients`), com a quantidade e o nível quando vêm. Presente anônimo da Kick vira "Anônimo".
- **Título da live**: `Emojis.jsx` é o seletor de emojis: busca por texto (nome e palavras-chave em português e inglês, o nome mais parecido primeiro; Enter escolhe o primeiro), abas por grupo do Unicode, jogos e RPG, usados por último e tom de pele, e insere no cursor. A lista com **todos** os emojis é `emojisDados.js`, **gerado** por `npm run emojis` (`scripts/gerar-emojis.mjs`, a partir do `emojibase-data`, devDependency): não edite à mão. `emojiBusca.js` (puro) faz a busca; `emojiSuporte.js` desenha cada emoji num canvas e esconde os que o sistema não sabe desenhar (os novos no Windows 10 e as bandeiras, que o Windows não tem). `atualizarLive` descreve título e categoria separadamente (atualizado, ficou diferente, sem confirmação) com o motivo provável; categoria vazia não é enviada como pedido nem gera aviso.
- **Aviso de anúncio** (`AvisoAnuncio.jsx`, `anuncios.js`): pop-up de uma linha, fixo por cima do dock e montado no `App`, então não
  depende do painel de chat estar visível. É pequeno de propósito para cobrir o mínimo do chat. `anuncios.js` (puro) guarda o último
  aviso `upcoming_ad` (`alerta.anuncio`: `quandoMs`, `duracaoS`, `adiamentos`) e decide quando mostrar (`deveMostrar`: faltando
  `antecedencia` s ou menos, até 3 s depois da hora). "Deixar rodar" (`dispensar`) vale para os avisos seguintes do mesmo anúncio
  (horas a menos de 45 s uma da outra). "Adiar" (`adiado`) assume +5 min e −1 adiamento na hora: o pedido sai pela ação
  `Painel: Anuncio` (`adiarAnuncio` em `acoes.js`), que o Streamer.bot responde "ok" sem dizer se a Twitch aceitou, e o próximo aviso
  corrige a hora. A Twitch só **adia 5 min** (não cancela) e só ela tem o aviso. O botão "Testar o aviso" das configurações mostra um
  anúncio de mentira (`teste: true`) sem chamar a ação.
- **Enquetes e previsões** (`Interacoes.jsx`): a que está no ar vem de `alerta.interacao` (id e opções com id, montados em
  `streamerbot.js`); os controles são os verbos `encerrar_enquete`, `travar_previsao`, `resolver_previsao` e `cancelar_previsao`.

## Instalador

`instalador/` (C#, .NET Framework 4.8) gera `Instalar LiveHelm.exe` com `dist/livehelm.html` embutido. Ele copia o dock para
`%LOCALAPPDATA%\LiveHelm` e grava o dock em `ExtraBrowserDocks` (JSON numa linha da seção `[BasicWindow]`) de `user.ini` (OBS 31 em
diante) e de `global.ini` (anteriores), com cópia `.livehelm.bak` na primeira vez.

- O OBS reescreve esses arquivos ao fechar: só se mexe neles com o OBS fechado.
- O OBS grava o uuid sem hífens; reaproveitar o uuid de um dock existente preserva o lugar dele na janela.
- O nome do dock no OBS é só `LiveHelm`: símbolos fora do Latin aparecem como `?`.
- Opções de teste: `--obs <pasta>`, `--destino <pasta>`, `--sem-pausa` (sem janelas; saída 0 ok, 1 OBS aberto, 2 sem configuração,
  3 erro) e `--remover`.

## Testes

- Lógica pura (sem React, rede ou DOM) vive em módulos testáveis, com testes em `tests/*.test.js` (`node --test`): `alertas.js`,
  `anuncios.js`, `pastaClipes.js`, `tagsLista.js` e `converterEventoStreamerbot` (`streamerbot.js`).
- Dependência de rede entra por parâmetro (como `aguardarLeitura(buscar, ...)`), para testar sem WebSocket.
- Formato de resposta de um serviço externo: ao descobri-lo, vire teste com a **resposta real** como exemplo. Um servidor falso que
  usa a suposição do código só confirma a suposição.
- Interface: confira no Chrome contra um Streamer.bot falso (um servidor WebSocket mínimo), cobrindo ao menos o fluxo que mudou.

## Documentação

- Mudou comportamento, ação ou argumento? Atualize o README.md e as Instruções na mesma mudança.
- Passo a passo para o usuário vai em `docs/INSTRUCOES.md`; o README descreve o que o projeto faz e como estender.

## Política de comentários

O comentário descreve o código **como ele está agora**: um porquê que o código não mostra (restrição, ordem, workaround, unidade de
constante, contrato de função). Sem histórico ("antes era", "agora", "removido"), sem código comentado, sem estado do momento, sem
referência por número de linha, sem emojis. Português com acentuação, presente do indicativo, uma a quatro linhas, acima do
código. Mudou o código? Atualize ou apague o comentário na mesma edição.
