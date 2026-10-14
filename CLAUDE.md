# LiveHelm: regras para quem mexe no código

Dock de navegador do OBS em React (Vite), de arquivo único: título e categoria, tags da Twitch, momentos, enquetes e previsões e
chat com moderação. Fala com o Streamer.bot (WebSocket) e com o OBS (obs-websocket v5). Uso e instalação estão no
[README.md](README.md) e em [docs/INSTRUCOES.md](docs/INSTRUCOES.md); este arquivo guarda só o que é preciso saber para expandir o
código sem quebrar nada.

## Comandos

- `npm run dev` serve em `http://localhost:5173/livehelm.html`. `npm test` roda `node --test` em `tests/`. `npm run build` gera
  `dist/livehelm.html`. `npm run instalador` faz o build e o `Instalar LiveHelm.exe` (precisa do .NET SDK).
- Antes de terminar uma mudança: `npm test` e `npm run build`. O `.exe` leva o dock **embutido**, então só `build` não o atualiza:
  se o instalador importa, rode `npm run instalador`.

## Regras

- **Sem `<React.StrictMode>`** em `main.jsx`: ele monta os effects duas vezes em desenvolvimento e abriria a conexão com o
  Streamer.bot em dobro.
- **Sem `window.confirm`, `alert` ou `prompt`:** não dá para contar com esses diálogos no navegador do OBS. Confirmações ficam
  dentro da página (o Banir usa a barra `#confirmacao`).
- **Arquivo único:** o build inlina tudo (`vite-plugin-singlefile`). Nada de imagens ou scripts ao lado; ícones e imagens entram
  inline (SVG ou `data:`).
- **Nada sensível no repositório:** `src/config.js` fica com as senhas vazias. Sem caminhos, contas ou endereços pessoais em código,
  comentários ou documentação. A única identificação pessoal permitida é o crédito de autoria (`LICENSE`, seção "Licença e créditos"
  do README e `author` do `package.json`): não o remova.

## Contrato com o Streamer.bot

O dock pede coisas por `DoAction` (`src/acoes.js`), e o código C# em `acoes-streamerbot/` lê os argumentos. **Nomes de ação e de
argumento têm que ser idênticos nos dois lados.** Mudou um, mude o outro e a tabela de ações de `docs/INSTRUCOES.md`.

| Ação | Argumentos |
|---|---|
| `Painel: Twitch`, `Painel: Kick`, `Painel: YouTube` | `tituloLive`, `categoriaLive` |
| `Painel: Tags` | `acao` (`ler`, `definir`, `limpar`; sem `acao` vale `definir`), `tagsLive` (separadas por `\|`), `pedido` |
| `Painel: Momentos` | `linha`, `arquivo`, `pasta` |
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
- A conexão com o OBS (`obs.js`) abre, autentica, pergunta e fecha a cada uso. O tempo vale o da transmissão; sem transmissão, o da
  gravação.

## Estado e configuração

- Preferências usam `ler`/`gravar` (`armazenamento.js`, prefixo `livehelm.`), que nunca lançam: sem armazenamento, o dock só não
  lembra de nada.
- Configurações ficam em `configuracoes.js`, **por seção** (`lerConfig` mescla o salvo com o padrão seção por seção). Opção nova =
  seção nova ali e um bloco em `Configuracoes.jsx`. Endereço e senha: a URL (`?streamerbot=`, `?sbsenha=`) vale antes do salvo, e
  este antes de `config.js`.
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

- Lógica pura (sem React, rede ou DOM) vive em módulos testáveis, com testes em `tests/*.test.js` (`node --test`).
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
