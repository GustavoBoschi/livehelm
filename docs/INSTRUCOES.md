# Instruções de instalação e configuração

Este guia leva você do zero até o LiveHelm funcionando dentro do OBS. Se quiser entender primeiro o que ele faz e como as
peças se encaixam, comece pelo [README](../README.md).

O LiveHelm não fala direto com a Twitch, a Kick nem o YouTube. Quem fala é o **Streamer.bot**, que roda no seu computador; o
LiveHelm só pede coisas a ele. Por isso a maior parte da configuração é no Streamer.bot: ligar o servidor WebSocket e criar
algumas **ações** com nomes exatos.

## Índice

1. [O que você vai precisar](#1-o-que-você-vai-precisar)
2. [Preparar o Streamer.bot](#2-preparar-o-streamerbot)
3. [Criar as ações no Streamer.bot](#3-criar-as-ações-no-streamerbot)
4. [Preparar o OBS (só para a marcação de momentos)](#4-preparar-o-obs-só-para-a-marcação-de-momentos)
5. [Instalar o dock no OBS](#5-instalar-o-dock-no-obs)
6. [Configurar o dock](#6-configurar-o-dock)
7. [Conferir se está tudo certo](#7-conferir-se-está-tudo-certo)
8. [Problemas comuns](#8-problemas-comuns)
9. [Atualizar, mudar de computador e desinstalar](#9-atualizar-mudar-de-computador-e-desinstalar)

---

## 1. O que você vai precisar

| O quê | Para quê | Observação |
|---|---|---|
| **Windows 10 ou 11** | O instalador e o Streamer.bot rodam nele | O dock em si é uma página web; o instalador automático é só para Windows |
| **OBS Studio 28 ou mais novo** | Onde o dock fica | Testado no 32.2.2. Do 28 em diante o servidor WebSocket já vem dentro do OBS |
| **[Streamer.bot](https://streamer.bot)** | Fala com Twitch, Kick e YouTube | Testado na versão 1.0.7 |
| Contas das plataformas | O que você quer controlar | Use a conta do canal (broadcaster). Não precisa ter as três |

Nada disso é pago. O LiveHelm não precisa de internet própria, de chave de API nem de cadastro: ele só conversa com programas do
seu próprio computador.

## 2. Preparar o Streamer.bot

### 2.1. Baixar e abrir

Baixe o Streamer.bot no [site oficial](https://streamer.bot), extraia numa pasta e abra o `Streamer.bot.exe`. Os guias oficiais
(<https://docs.streamer.bot>) cobrem a instalação em detalhes; o essencial para o LiveHelm está nos passos abaixo.

### 2.2. Entrar com a conta de cada plataforma

No Streamer.bot, vá em **Platforms** e entre com a conta do canal em cada plataforma que você usa:

- **Twitch:** `Platforms > Twitch > Accounts`, em **Broadcaster Account** aperte **Login** e aceite as permissões.
- **YouTube:** `Platforms > YouTube > Accounts`, em **Broadcaster Account** aperte **Sign in with Google**, aceite as permissões e
  ligue **Auto Connect**.
- **Kick:** `Platforms > Kick`, entre com a conta do canal. Se alertas de seguidor da Kick não chegarem, ligue também a conta da
  Kick no site do Streamer.bot (**Account > Connections**), além do login no aplicativo.

A conta **Bot** é opcional. Ela só serve se você quiser que as mensagens enviadas pelo dock saiam com o nome do bot (veja
`USAR_BOT` na [seção 3](#painel-chat-chat-moderação-enquetes-e-previsões)).

### 2.3. Ligar o servidor WebSocket

É por aqui que o dock conversa com o Streamer.bot.

1. Vá em **Servers/Clients > WebSocket Server**.
2. Deixe **Address** em `127.0.0.1` e **Port** em `8080` (os valores padrão).
3. Ligue **Auto Start**: com ele, o servidor sobe sozinho sempre que o Streamer.bot abre. Se a tela tiver um botão para iniciar o
   servidor, clique nele agora (ou reinicie o Streamer.bot).
4. **Senha (recomendada):** ligue **Authentication** e preencha **Password**. Sem senha, qualquer programa do seu computador (e
   páginas abertas no navegador podem tentar) que consiga conectar no servidor pode pedir as ações do LiveHelm, como banir alguém,
   enviar mensagem ou gravar a anotação de um momento. Depois você coloca a mesma senha nas configurações do dock. Se ligar
   **Enforce**, todos os pedidos exigem a senha (o dock se autentica sozinho quando a senha está preenchida nas configurações).

> **Cuidado com o endereço:** `127.0.0.1` só aceita conexões do próprio computador, que é o que você quer. Não troque por
> `0.0.0.0` a menos que saiba o que está fazendo, porque isso abre o servidor para sua rede (use senha nesse caso).

## 3. Criar as ações no Streamer.bot

O dock pede ao Streamer.bot que execute **ações**. Cada ação é criada **uma única vez**. O dock lê a lista de ações a cada 15 segundos e
reconhece as que existem. Se alguma faltar, o painel que a usa mostra um aviso amarelo dizendo qual.

> **O nome da ação precisa ser EXATAMENTE igual ao das Instruções.** O dock compara letra por letra: maiúsculas e minúsculas, o
> dois-pontos, o espaço depois dele e qualquer espaço sobrando no fim contam. `Painel: YouTube` funciona; `Painel: Youtube`,
> `Painel:YouTube`, `painel: youtube` e `Painel: YouTube ` (com um espaço no fim) **não** funcionam. O jeito mais seguro é **copiar o nome
> daqui e colar** no campo **Name**.

### Receita: criar uma ação

1. No Streamer.bot, vá em **Actions & Queues > Actions**.
2. Clique com o botão direito na área de ações e escolha **Add**.
3. No campo **Name**, cole o nome da ação **exatamente** como está nestas Instruções (por exemplo `Painel: Twitch`) e confirme.
4. Clique na ação nova para selecioná-la. O painel **Sub-Actions** (à direita) fica ativo.
5. Clique com o botão direito no painel de sub-ações e escolha a sub-ação indicada em cada receita abaixo. Para configurar uma
   sub-ação, dê dois cliques nela.

### Receita: ação com código C#

As ações `Painel: Tags`, `Painel: Momentos` e `Painel: Chat` usam código pronto que vem neste projeto, na pasta
[`acoes-streamerbot/`](../acoes-streamerbot).

1. Crie a ação com a receita acima (passos 1 a 4).
2. No painel de sub-ações, botão direito, **Core > C# > Execute C# Code**.
3. Na janela do código, **apague tudo** que vier e cole o conteúdo do arquivo `.cs` indicado.
4. Clique em **Save and Compile**. Tem que compilar sem erro.
5. Confirme com **OK**.

Se o código do projeto mudar numa versão nova, abra a sub-ação e cole o arquivo de novo (o passo 3 vale para atualizar).

---

### `Painel: Twitch`: título e categoria na Twitch

Sub-ações (nessa ordem), com estes valores:

| Sub-ação | Campo | Valor |
|---|---|---|
| `Twitch > Channel > Set Channel Title` | título | `%tituloLive%` |
| `Twitch > Channel > Set Channel Game` | jogo/categoria | `%categoriaLive%` |

`%tituloLive%` e `%categoriaLive%` são os **argumentos** que o dock manda. Escreva-os exatamente assim, com os dois `%`.

### `Painel: Kick`: título e categoria na Kick

| Sub-ação | Campo | Valor |
|---|---|---|
| `Kick > Channel > Set Channel Title` | título | `%tituloLive%` |
| `Kick > Channel > Set Channel Category` | categoria | `%categoriaLive%` |

### `Painel: YouTube`: título no YouTube

| Sub-ação | Campo | Valor |
|---|---|---|
| `YouTube > Set Title` | título | `%tituloLive%` |
| `YouTube > Set Title` | **Broadcast** | **`All`** |

O YouTube não muda de categoria por aqui; só o título.

> **Atenção ao campo Broadcast:** ele precisa ficar em **All**. Ao criar a sub-ação, a janela costuma vir em **From Variable**: o Streamer.bot
> então lê a variável `broadcast.id`, que só existe quando a ação é disparada por um evento do YouTube. Como quem dispara a ação é o dock,
> essa variável não existe e **o título não muda** (sem mostrar erro). Além disso, o YouTube precisa estar conectado no Streamer.bot
> ([seção 2.2](#22-entrar-com-a-conta-de-cada-plataforma)): se a janela da sub-ação mostrar **Not Connected**, entre em
> `Platforms > YouTube > Accounts`. O Streamer.bot também avisa que mudar as informações do YouTube é uma chamada "cara" (gasta cota da
> API do YouTube), então mude o título com moderação.

> **Dica:** você não precisa criar as três. Crie só as das plataformas que usa. O botão **Confirmar** do painel Live atualiza só as
> plataformas ligadas no alto do dock, e o painel avisa se uma ligada não tem ação.

### `Painel: Tags`: tags da Twitch

Receita de **ação com código C#**, colando o conteúdo de
[`acoes-streamerbot/Painel-Tags.cs`](../acoes-streamerbot/Painel-Tags.cs).

Ela lê, troca e limpa as tags (#) do canal na Twitch. Argumentos que o dock manda:

| Argumento | Quando | O que é |
|---|---|---|
| `acao` | sempre | `ler`, `definir` ou `limpar` |
| `pedido` | `ler` | um identificador; a ação o devolve junto da resposta |
| `tagsLive` | `definir` | as tags separadas por `\|`, sem `#` |

Para ler, a ação grava as tags numa variável global do Streamer.bot chamada `painelTags` e o dock a busca pelo WebSocket. Você
não precisa criar essa variável.

### `Painel: Momentos`: marcação de momentos

Receita de **ação com código C#**, colando o conteúdo de
[`acoes-streamerbot/Painel-Momentos.cs`](../acoes-streamerbot/Painel-Momentos.cs).

Um navegador não grava arquivos no disco, então quem escreve a linha no `.txt` é o Streamer.bot. Argumentos:

| Argumento | O que é |
|---|---|
| `linha` | o texto da marcação, por exemplo `Clipe 3 - 00:12:34` |
| `arquivo` | o nome do arquivo, sem `.txt` (`Clipes - <título da live>`) |
| `pasta` | a pasta onde gravar: um caminho local completo com letra de unidade, como `C:\Clipes` (vazia: `Documentos\LiveHelm\Clipes`). A ação recusa caminho de rede (`\\servidor\...`), caminho relativo e `..` |

A ação cria a pasta e o arquivo se faltarem e grava em UTF-8. Cada marcação é uma linha só, de até 300 letras.

### `Painel: Chat`: chat, moderação, enquetes e previsões

Receita de **ação com código C#**, colando o conteúdo de
[`acoes-streamerbot/Painel-Chat.cs`](../acoes-streamerbot/Painel-Chat.cs).

Uma ação só faz tudo: enviar mensagem, apagar, silenciar, banir, desfazer, limpar o chat e criar/controlar enquetes e
previsões. O argumento `acao` diz o que fazer:

| `acao` | O que faz | Argumentos extras |
|---|---|---|
| `enviar` | Envia uma mensagem no chat | `plataforma`, `mensagem` |
| `apagar` | Apaga uma mensagem (não existe no YouTube) | `plataforma`, `mensagemId` |
| `silenciar` | Silencia um usuário | `plataforma`, `usuario`, `usuarioId`, `segundos` |
| `banir` | Bane um usuário | `plataforma`, `usuario`, `usuarioId` |
| `reverter` | Desfaz silêncio ou banimento (Twitch e Kick) | `plataforma`, `usuario` |
| `limpar` | Limpa o chat (só Twitch) | `plataforma` |
| `enquete` / `previsao` | Cria uma enquete ou previsão (só Twitch) | `titulo`, `opcoes` (separadas por `\|`), `duracao` |
| `encerrar_enquete` | Encerra a enquete no ar | `id` |
| `travar_previsao` / `cancelar_previsao` | Trava as apostas / cancela | `id` |
| `resolver_previsao` | Diz qual opção venceu | `id`, `vencedorId` |

No alto do código há a constante **`USAR_BOT`**. Com `false` (o padrão), as mensagens e punições saem **com a sua conta**; com
`true`, saem com a conta do bot, que precisa ser **moderador** do canal.

**Sem as ações, o chat funciona só para ler.** Ler o chat e os alertas não depende de nenhuma ação, só do WebSocket ligado.

#### Opcional, sem código

Enviar, silenciar e banir também existem como sub-ações prontas em cada plataforma. Se preferir, crie uma ação por combinação,
com a sub-ação nativa e o nome **exatamente** igual, por exemplo:

- `Painel: Enviar Twitch`: `Twitch > Chat > Send Message` com `%mensagem%`.
- `Painel: Silenciar Kick`: o *timeout* da Kick com `%usuario%` e `%segundos%`.
- `Painel: Banir YouTube`: o banimento do YouTube com `%usuario%`.

O dock usa a ação da plataforma quando ela existe e a `Painel: Chat` quando não existe. Apagar mensagem, enquetes e previsões só
funcionam pela `Painel: Chat`.

## 4. Preparar o OBS (só para a marcação de momentos)

Esta parte só é necessária se você quiser o painel **Momentos**. Ele precisa ler o tempo da live no OBS, e para isso usa o servidor
WebSocket do próprio OBS. (Ele é separado do Streamer.bot: você **não** precisa ligar o OBS dentro do Streamer.bot para o
LiveHelm funcionar.)

1. No OBS, abra o menu **Ferramentas** (em inglês, **Tools**) e escolha **Configurações do servidor WebSocket** (**WebSocket
   Server Settings**). Se não aparecer, confirme que o OBS é o 28 ou mais novo.
2. Marque **Ativar servidor WebSocket** (**Enable WebSocket server**).
3. Deixe a porta em `4455` (padrão).
4. Se quiser, ative a autenticação e anote a senha (o botão para mostrá-la ajuda). Você vai colocar essa senha nas configurações do
   dock. Sem autenticação, deixe a senha do dock em branco.

## 5. Instalar o dock no OBS

### Jeito automático (recomendado, Windows)

1. **Feche o OBS por completo**, inclusive o ícone perto do relógio, se ele ficar lá.
2. Dê dois cliques em **`Instalar LiveHelm.exe`**. Você o baixa na página de *Releases* do projeto, ou gera sozinho com
   `npm run instalador` (veja o [README](../README.md#desenvolvimento)).
3. Abra o OBS. O dock **LiveHelm** aparece na janela; se não aparecer, use o menu **Docks > LiveHelm**.

O instalador copia a página para `%LOCALAPPDATA%\LiveHelm\livehelm.html` e registra o dock na lista de docks do OBS. Antes de mexer
na configuração do OBS, ele guarda uma cópia de segurança de cada arquivo (`user.ini.livehelm.bak` e `global.ini.livehelm.bak`, na
mesma pasta). Se o OBS estiver aberto, o instalador avisa e espera: com o OBS aberto ele reescreveria os arquivos ao fechar e a
mudança se perderia.

### Jeito manual (qualquer sistema)

1. Tenha o arquivo `livehelm.html` (da página de *Releases* ou gerado por `npm run build`, em `dist/livehelm.html`).
2. No OBS: **Docks > Custom Browser Docks**.
3. Em **Dock Name**, escreva `LiveHelm`. Em **URL**, o endereço do arquivo:

   ```
   file:///C:/caminho/para/livehelm.html
   ```

   Use barras normais (`/`) e troque cada espaço por `%20`. Exemplo: `file:///C:/Meus%20Programas/LiveHelm/livehelm.html`.
4. Clique em **Apply**. O dock aparece na janela do OBS: arraste para onde quiser ou solte para flutuar.

### Posição e tamanho

O OBS decide onde o dock fica. Se ele tomar o lugar de Propriedades ou Fontes, tire-o do encaixe: clique em **Float** na barra de
título do dock (ele vira uma janela solta, que pode ficar no segundo monitor). Para economizar espaço sem soltar, arraste a barra do
dock por cima da barra de **Cenas**: eles viram abas do mesmo painel. O dock aguenta ser estreito e baixo.

## 6. Configurar o dock

Clique na **bolinha de estado** (a verde, amarela ou vermelha, no canto de cima) para abrir as **Configurações**:

| Seção | O que configurar |
|---|---|
| **Aparência** | Cor de destaque e fundo |
| **Streamer.bot** | **Endereço** (`ws://127.0.0.1:8080`) e **Senha** (a do passo 2.3, ou vazia). Clique em **Salvar e reconectar** |
| **OBS** | **Endereço** (`ws://127.0.0.1:4455`) e **Senha** (a do passo 4, ou vazia). **Salvar e testar** mostra o tempo atual da live |
| **Marcação de momentos** | **Dar título a cada clipe** e a **pasta** dos arquivos (vazia: a pasta `Clipes` ao lado do dock, ou seja, `%LOCALAPPDATA%\LiveHelm\Clipes` no dock instalado; se escolher outra, use o caminho completo, como `C:\Clipes`) |

Se você deixou tudo no padrão e sem senha, normalmente não precisa mudar nada além de abrir o Streamer.bot e o OBS.

### Streamer.bot em outro computador

Coloque o endereço dele (`ws://IP-DO-OUTRO-PC:8080`) em **Streamer.bot > Endereço**. No Streamer.bot, o servidor
precisa estar escutando na rede (`Address` diferente de `127.0.0.1`), e é **fortemente recomendado** usar senha. Para testes rápidos,
`?streamerbot=ws://IP:PORTA` e `?sbsenha=SENHA` no fim da URL do dock valem no lugar do que está salvo (a senha na URL fica visível
nas configurações do dock, então prefira a tela de configurações).

## 7. Conferir se está tudo certo

1. **A bolinha de estado está verde.** Verde = Streamer.bot e todas as plataformas ativas conectados. Amarela = falta alguma
   plataforma ativa (passe o mouse para ver qual). Vermelha = sem conexão com o Streamer.bot.
2. **O chat recebe mensagens.** Escreva algo no chat de uma das plataformas: a mensagem aparece no painel Chat.
3. **Live:** escreva um título, clique em **Confirmar** e confira o resultado por plataforma (✓ verde = aplicado; amarelo = ficou
   diferente do digitado ou sem confirmação).
4. **Tags:** abra o painel Tags: ele lista as tags atuais do canal na Twitch. Se aparecer um aviso sobre a ação, veja o
   [problema correspondente](#8-problemas-comuns).
5. **Momentos:** com a live ou a gravação rodando, clique em **Marcar momento**. Uma linha nova entra em
   `Clipes - <título da live>.txt`.
6. **Chat/moderação:** passe o mouse sobre uma mensagem para ver os botões; envie uma mensagem de teste pela caixa de baixo.

## 8. Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| Bolinha **vermelha**, aviso "Streamer.bot desconectado" | O Streamer.bot está fechado ou o **WebSocket Server** está desligado. Abra-o e ligue (seção 2.3). Confira também o endereço e a porta nas configurações do dock. |
| Aviso "O Streamer.bot recusou a conexão" | A senha está errada ou faltando. Coloque a mesma senha do **Password** do Streamer.bot nas configurações do dock. |
| Bolinha **amarela** | Uma plataforma ligada no alto não está conectada no Streamer.bot. Entre com a conta dela (seção 2.2) ou desligue a plataforma no alto do dock. |
| "Faltam ações no Streamer.bot: …" | O Streamer.bot não tem uma ação com o nome **EXATAMENTE igual** ao esperado: o dock compara letra por letra, então `Painel: Youtube`, `Painel:YouTube` ou um espaço no fim não valem. Copie o nome das Instruções, confirme com **Ok** a janela da sub-ação e espere até 15 s (o dock relê a lista a cada 15 s). Se você não usa aquela plataforma, desligue o botão dela no alto do dock e o aviso some. |
| O título do YouTube não muda (e não aparece erro) | Duas causas comuns: o **Broadcast** da sub-ação `YouTube > Set Title` está em **From Variable** (troque para **All**), ou o YouTube não está conectado no Streamer.bot (a janela da sub-ação mostra **Not Connected** e o pontinho do YouTube no alto do dock fica cinza; entre em `Platforms > YouTube > Accounts`, seção 2.2). |
| Alertas de seguidor da Kick não chegam | Ligue a conta da Kick também no site do Streamer.bot (**Account > Connections**), além do login no aplicativo. |
| Tags: "sem resposta da ação (cole o código novo…)" | A ação `Painel: Tags` está com um código antigo ou não compilou. Cole [`Painel-Tags.cs`](../acoes-streamerbot/Painel-Tags.cs) de novo e use **Save and Compile**. |
| Tags: "nao consegui ler o canal" | A Twitch não está conectada como **Broadcaster** no Streamer.bot (seção 2.2). |
| Momentos: "o OBS não respondeu" | O servidor WebSocket do OBS está desligado ou o endereço está errado (seção 4). Use **Salvar e testar** nas configurações. |
| Momentos: "o OBS pede senha" | O OBS tem autenticação ligada. Coloque a senha nas configurações do dock. |
| Momentos: "o OBS não está transmitindo nem gravando" | Não há tempo de live para ler. Comece a transmitir ou a gravar. |
| Momentos: "A pasta dos clipes precisa ser um caminho completo…" | A pasta escolhida nas configurações não é um caminho local completo. Use algo como `C:\Clipes`, sem `..` e sem caminho de rede. |
| Momentos: a linha não entra no arquivo | A ação `Painel: Momentos` não existe, não compilou, ou a pasta não pode ser criada. Veja o log do Streamer.bot (pasta `logs`). |
| Desbanir/liberar não faz nada | A `Painel: Chat` é de uma versão antiga e não tem o verbo `reverter`. Cole [`Painel-Chat.cs`](../acoes-streamerbot/Painel-Chat.cs) de novo. |
| O dock não aparece no OBS | Veja se o OBS estava fechado ao instalar. Use **Docks > LiveHelm**, ou a instalação manual (seção 5). |
| Ao mudar a categoria ela "fica diferente" | A plataforma não achou uma categoria com esse nome. Digite o nome como ele aparece na plataforma. |

Quando algo não bate, o **log do Streamer.bot** (pasta `logs`, ao lado do executável) é o melhor lugar para olhar: toda ação que o
dock pede aparece lá, com os argumentos recebidos e os erros.

## 9. Atualizar, mudar de computador e desinstalar

- **Atualizar o dock:** feche o OBS e rode o **`Instalar LiveHelm.exe`** novo. Ele troca o arquivo e mantém o lugar do dock na
  janela. Se a nova versão trouxe mudanças nos arquivos `.cs`, cole-os de novo nas ações (seção 3).
- **Mudar de computador:** instale o Streamer.bot, o OBS e o dock, e crie as ações de novo. As configurações do dock (senhas, tema,
  painéis) ficam guardadas no próprio OBS daquele computador.
- **Desinstalar:** feche o OBS e rode **`Remover LiveHelm.bat`** (ou `Instalar LiveHelm.exe --remover`). Ele tira o dock do OBS e apaga
  a página de `%LOCALAPPDATA%\LiveHelm`. As ações do Streamer.bot continuam lá; apague-as à mão se quiser.
