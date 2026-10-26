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
- **Kick:** `Platforms > Kick`, entre com a conta do canal. Depois ligue também a conta da Kick no site do Streamer.bot
  (**Account > Connections**), pois as mensagens do chat e os alertas da Kick dependem desse login do site, além do login no
  aplicativo. **Depois de conectar com o site, reinicie o Streamer.bot** (feche e abra de novo); sem isso ele não passa a receber a Kick.

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

As ações `Painel: Tags`, `Painel: Momentos`, `Painel: Chat` e (recomendada) `Painel: YouTube`, e as opcionais `Painel: Sem Categoria`,
`Painel: Controles` e `LivePix`, usam código pronto que vem neste projeto, na pasta [`acoes-streamerbot/`](../acoes-streamerbot).

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

**Para poder confirmar só o título (categoria vazia):** o dock manda `%categoriaLive%` vazio, e a sub-ação *Set Channel Game* falha com um jogo vazio. Ponha uma condição **If** em volta dela: `%categoriaLive%` *não é vazio*. O mesmo vale para a Kick.

### `Painel: Kick`: título e categoria na Kick

| Sub-ação | Campo | Valor |
|---|---|---|
| `Kick > Channel > Set Channel Title` | título | `%tituloLive%` |
| `Kick > Channel > Set Channel Category` | categoria | `%categoriaLive%` |

### `Painel: YouTube`: título (e categoria) no YouTube

> **A ação `Painel: YouTube` com o código C# precisa ter SÓ a sub-ação do código.** Se ela ainda tiver a sub-ação antiga **`YouTube > Set Title`** (da receita "sem código", mais abaixo), **apague-a**: o Streamer.bot a roda a cada pedido do dock, **até na leitura e ao mudar só a descrição ou as tags**, e como esses pedidos não levam título, o nome do argumento vira o título da live (**`%tituloLive%`**). O log do Streamer.bot avisa quando o título da live está assim ("o titulo da transmissao esta como …"). Para apagar: abra a ação, clique com o botão direito em `YouTube > Set Title` e escolha **Delete**; deixe só `Execute C# Code`. Depois escreva o título certo no painel Live.

**Recomendado:** receita de **ação com código C#**, colando o conteúdo de
[`acoes-streamerbot/Painel-YouTube.cs`](../acoes-streamerbot/Painel-YouTube.cs). Ela muda o título da transmissão que o Streamer.bot está
monitorando e, se você deixar uma categoria em **Configurações > YouTube** (padrão `Gaming`), a categoria também. Depois grava o resultado
numa variável global (`painelYoutube`) e o dock o mostra: título atualizado, ou o motivo de o YouTube ter recusado (por exemplo, nenhuma
transmissão monitorada). Argumentos que o dock manda:

| Argumento | O que é |
|---|---|
| `tituloLive` | o título, já sem `<` e `>` e com até 100 caracteres (regras do YouTube) |
| `categoriaYoutube` | uma categoria da lista fixa do YouTube, como `Gaming` (vazia: não mexe) |
| `acao` | vazia: muda a transmissão; `ler`: só devolve o que ela tem agora (título, categoria, descrição e tags) |
| `descricaoDefinir` | `true`: troca a descrição por `descricaoLive` (sem `<` e `>`, até 5000 letras; vazia apaga) |
| `tagsAcao` | `definir`: troca as tags por `tagsYoutube` (separadas por `\|`, até 500 letras no total); `limpar`: tira todas; vazio: não mexe |
| `pedido` | um identificador, devolvido junto da resposta |

**Tags e descrição (opcional, desligado por padrão):** em **Configurações > YouTube**, ligue **Mostrar tags e descrição do YouTube no painel Tags**. O painel passa a se chamar
**Tags e descrição** e ganha um bloco **YouTube**: ele lê as tags e a descrição da transmissão, você edita (as tags do YouTube são palavras ou frases soltas, separadas por vírgula,
e ficam escondidas: ajudam nas buscas) e **Aplicar no YouTube** manda só o que mudou. Sem live do YouTube aberta, o que você escrever fica guardado e é aplicado quando ela abrir.
Isso usa a versão nova do código (`Painel-YouTube.cs`, versão 4): quem tem o código antigo vê o aviso "atualize o código da ação Painel: YouTube". Não é o "Título do jogo" do YouTube Studio,
que a API não deixa preencher.

**Sem transmissão não há título para mudar.** O título pertence a uma transmissão do YouTube, e o Streamer.bot só consegue mudar a que ele está
monitorando (a live criada ou agendada no YouTube Studio, ou no ar, e o YouTube conectado). Se o dock confirmar o título sem nenhuma transmissão
monitorada, ele mostra o aviso, **guarda o título e o aplica sozinho quando a live do YouTube começar** (o resultado aparece no painel Live). Se
quiser mudar antes, crie ou agende a live no YouTube Studio e confira em *Platforms > YouTube* do Streamer.bot se ela aparece.

O jogo (por exemplo, "Marvel Rivals") **não dá para escolher pela API do YouTube nem pelo Streamer.bot**: o "Título do jogo" do YouTube Studio não tem
campo nenhum nelas (a API só tem a categoria fixa, como Gaming), então ele continua sendo escolhido à mão no Studio. O que o dock faz é **trocar a categoria
conforme a live**: em **Configurações > YouTube**, "Trocar a categoria conforme a live" tem uma linha por tipo de live, cada uma com as **palavras** que o
identificam (separadas por vírgula) e a **categoria do YouTube, escolhida numa lista** (você não digita o nome). De fábrica: Just Chatting, Conversando, Bate-papo = People &
Blogs; qualquer jogo = Gaming; Software, Tecnologia, Technology, Ciência, Science = Science & Technology; Music, Música = Music; Sports, Esportes = Sports. Se a categoria
digitada no painel Live tem uma dessas palavras (sem diferenciar maiúsculas, acentos nem plural, e só como palavra inteira), o YouTube recebe a categoria da linha; sem
categoria digitada, vale a linha cujas palavras aparecem no título. Qualquer outro nome digitado é um jogo e **vai para a categoria da linha "Qualquer jogo"** (Gaming), então a live
nunca fica com a categoria da anterior. Para um jogo que tenha uma dessas palavras no nome (por exemplo, "Music Rush"), escreva o nome na linha "Qualquer jogo": os nomes dela
ganham das outras linhas. **+ Nova regra** acrescenta uma linha e **Voltar ao padrão** devolve as de fábrica. Quando uma regra escolhe a categoria, o resultado do painel Live a mostra, como em
"atualizado (People & Blogs)". Se o YouTube recusar o nome da categoria, o dock avisa e o título continua valendo.

**Sem código (o jeito antigo, ainda funciona, mas sem confirmação):**

| Sub-ação | Campo | Valor |
|---|---|---|
| `YouTube > Set Title` | título | `%tituloLive%` |
| `YouTube > Set Title` | **Broadcast** | **`All`** |

Com a ação sem código o dock não sabe se o título mudou e o resultado diz isso. O título do YouTube **não pode ter `<` nem `>`** (o dock troca
`->` por `→` e tira os demais) e vai até 100 caracteres.

> **Atenção ao campo Broadcast:** ele precisa ficar em **All**. Ao criar a sub-ação, a janela costuma vir em **From Variable**: o Streamer.bot
> então lê a variável `broadcast.id`, que só existe quando a ação é disparada por um evento do YouTube. Como quem dispara a ação é o dock,
> essa variável não existe e **o título não muda** (sem mostrar erro). Além disso, o YouTube precisa estar conectado no Streamer.bot
> ([seção 2.2](#22-entrar-com-a-conta-de-cada-plataforma)): se a janela da sub-ação mostrar **Not Connected**, entre em
> `Platforms > YouTube > Accounts`. O Streamer.bot também avisa que mudar as informações do YouTube é uma chamada "cara" (gasta cota da
> API do YouTube), então mude o título com moderação.

> **Dica:** você não precisa criar as três. Crie só as das plataformas que usa. O botão **Confirmar** do painel Live atualiza só as
> plataformas ligadas no alto do dock, e o painel avisa se uma ligada não tem ação.

### `Painel: Tags`: tags da Twitch (e leitura do título e da categoria)

Receita de **ação com código C#**, colando o conteúdo de
[`acoes-streamerbot/Painel-Tags.cs`](../acoes-streamerbot/Painel-Tags.cs).

Ela lê, troca e limpa as tags (#) do canal na Twitch. Argumentos que o dock manda:

| Argumento | Quando | O que é |
|---|---|---|
| `acao` | sempre | `ler`, `definir` ou `limpar` |
| `pedido` | `ler` | um identificador; a ação o devolve junto da resposta |
| `tagsLive` | `definir` | as tags separadas por `\|`, sem `#` |

Para ler, a ação grava as tags numa variável global do Streamer.bot chamada `painelTags` e o dock a busca pelo WebSocket. Você
não precisa criar essa variável. Na mesma leitura ela anota o **título e a categoria atuais da Twitch** (e o título da transmissão do
YouTube, de reserva) e se a conta é afiliada ou parceira: ao conectar, o dock põe o título e a categoria da Twitch nos campos da Live (sem
título na Twitch, o do YouTube; a categoria só vem da Twitch). Quem já tinha a ação precisa **colar o código de novo** e usar **Save and
Compile**; sem isso o dock segue com os valores lembrados da última vez. O Streamer.bot não tem como ler o título nem a categoria da Kick.

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

### `Painel: Sem Categoria`: tirar a categoria da Twitch (opcional)

Receita de **ação com código C#**, colando o conteúdo de
[`acoes-streamerbot/Painel-SemCategoria.cs`](../acoes-streamerbot/Painel-SemCategoria.cs). Com ela, o painel Live ganha o link **Sem categoria
(Twitch)**. A ação manda o id de jogo `0` (a API da Twitch o entende como "sem categoria") e **já foi testada: funciona na Twitch**. Se um dia a Twitch recusar, troque a constante `IdSemCategoria` no começo do código pelo
id de uma categoria que você queira usar no lugar (por exemplo, `509658`, a Just Chatting). Kick e YouTube não têm como ficar sem categoria por aqui.

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
| `permitir` / `negar` | Libera ou barra uma mensagem retida pelo AutoMod (só Twitch) | `plataforma`, `mensagemId` |
| `limpar` | Limpa o chat (só Twitch) | `plataforma` |
| `enquete` / `previsao` | Cria uma enquete ou previsão (só Twitch) | `titulo`, `opcoes` (separadas por `\|`), `duracao` |
| `encerrar_enquete` | Encerra a enquete no ar | `id` |
| `travar_previsao` / `cancelar_previsao` | Trava as apostas / cancela | `id` |
| `resolver_previsao` | Diz qual opção venceu | `id`, `vencedorId` |

No alto do código há a constante **`USAR_BOT`**. Com `false` (o padrão), as mensagens e punições saem **com a sua conta**; com
`true`, saem com a conta do bot, que precisa ser **moderador** do canal.

**AutoMod:** o dock assina os eventos `AutoModMessageHeld` e `AutoModMessageUpdate` da Twitch. A mensagem retida aparece no chat com **Permitir** e
**Negar**, que usam o `permitir` e o `negar` acima (`TwitchApproveAutoHeldMessage` e `TwitchDenyAutoHeldMessage`). Cole o código novo de
[`Painel-Chat.cs`](../acoes-streamerbot/Painel-Chat.cs) para eles funcionarem. O Streamer.bot não tem isso para Kick e YouTube.

**Sem as ações, o chat funciona só para ler.** Ler o chat e os alertas não depende de nenhuma ação, só do WebSocket ligado.

Na aba **Tudo** do chat aparecem as mensagens e só os alertas principais (seguidor, sub, presente, apoio, resgate de pontos e raid).
O aviso de anúncio (a Twitch avisa uma vez por minuto nos 5 minutos antes), o hype train, as votações, as previsões e os avisos de
moderação (banido, silenciado e chat limpo) aparecem só na aba **Alertas**. As abas **Twitch**, **Kick** e **YouTube** mostram o mesmo
que a **Tudo**, só daquela plataforma. Você muda isso em **Configurações > Alertas no chat** ([seção 6](#6-configurar-o-dock)).

### `Painel: Controles`: modos do chat, clipe, resgates, resposta e perfil (opcional)

É preciso se você ligar algum destes recursos em Configurações: **Modos do chat**, **botão de clipe** ou **aba Resgates**. Também melhora duas coisas que já funcionam sem ela: **Responder** (com a ação, na Twitch e na Kick a resposta fica ligada à mensagem; sem ela sai com @nome) e **Ver perfil** (com a ação, na Twitch traz a conta: idade, se segue, sub, mod e VIP). Receita de
**ação com código C#**, colando o conteúdo de [`acoes-streamerbot/Painel-Controles.cs`](../acoes-streamerbot/Painel-Controles.cs) (versão 2: quem colou a versão
antiga precisa colar de novo para resgates, resposta e perfil). Ela grava o resultado numa variável global (`painelControles`) e o dock o mostra. Argumentos que o dock manda:

| Argumento | O que é |
|---|---|
| `acao` | `modo_chat`, `clipe`, `resgate`, `responder`, `perfil_twitch` ou `ping` (a verificação da configuração pergunta a versão do código) |
| `modo` | (modo_chat) `emotes`, `lento`, `seguidores` ou `inscritos` |
| `ligar` | (modo_chat) `true` liga o modo, `false` desliga |
| `segundos` | (modo lento) tempo entre as mensagens, de 3 a 120 |
| `minutos` | (só seguidores) há quanto tempo segue, de 0 (todos) a 129600 |
| `titulo` | (clipe) título do clipe; vazio, o título da live |
| `duracao` | (clipe) de 5 a 60 segundos |
| `decisao`, `rewardId`, `redemptionId` | (resgate) `cumprir` ou `reembolsar`, e os ids da recompensa e do resgate (só letras, números, `-`, `_` e `:`) |
| `plataforma`, `mensagemId`, `mensagem`, `usuario` | (responder) a plataforma, o id da mensagem a responder, o texto e o nome de quem escreveu |
| `usuarioId` | (perfil_twitch) o id do usuário na Twitch |

Modos do chat, clipe, cumprir e reembolsar resgates e o perfil existem **só para a Twitch**: o Streamer.bot 1.0.7 não tem isso para a Kick nem para o YouTube. Responder é
resposta de verdade na Twitch e na Kick; no YouTube, que não tem, a mensagem sai com `@nome`. O clipe só sai com a live **no ar na Twitch**. A ação usa a sua conta
(`USAR_BOT = false` no código; mude para `true` para responder com a conta do bot).

### `Painel: Anuncio`: adiar o anúncio da Twitch (opcional)

Receita de **ação sem código**. O nome é **sem acento**, exatamente `Painel: Anuncio`.

| Sub-ação | Campo | Valor |
|---|---|---|
| `Twitch > Ads > Snooze Next Ad` | (nenhum) | |

Ela só serve ao botão **Adiar 5 min** do aviso de anúncio (veja a [seção 6](#6-configurar-o-dock)). Sem ela, o aviso funciona e só o
botão de adiar fica desligado.

> **Sobre o adiamento:** a Twitch não deixa cancelar um anúncio, só **adiar em 5 minutos**, e só enquanto ainda houver adiamentos (o
> aviso mostra quantos restam). O Streamer.bot precisa estar conectado à Twitch com a permissão de gerenciar anúncios; se o botão não
> adiar, entre de novo em `Platforms > Twitch > Accounts` (**Broadcaster Account**, **Login**) e aceite as permissões. O Streamer.bot
> não responde se a Twitch aceitou, então o aviso confere isso no próximo anúncio.

#### Opcional, sem código

Enviar, silenciar e banir também existem como sub-ações prontas em cada plataforma. Se preferir, crie uma ação por combinação,
com a sub-ação nativa e o nome **exatamente** igual, por exemplo:

- `Painel: Enviar Twitch`: `Twitch > Chat > Send Message` com `%mensagem%`.
- `Painel: Silenciar Kick`: o *timeout* da Kick com `%usuario%` e `%segundos%`.
- `Painel: Banir YouTube`: o banimento do YouTube com `%usuario%`.

O dock usa a ação da plataforma quando ela existe e a `Painel: Chat` quando não existe. Apagar mensagem, enquetes e previsões só
funcionam pela `Painel: Chat`.

### `LivePix`: as doações do LivePix no chat e no overlay (opcional)

Só serve para quem recebe doações pelo [LivePix](https://livepix.gg). Cada doação vira um alerta ("Fulano apoiou", o valor e a mensagem) nas abas **Alertas** e **Tudo** do dock, com o **fundo azul do LivePix**
e o símbolo do logo dele. O dock não fala com o LivePix: ele **ouve** o aviso de uma ação do Streamer.bot chamada **`LivePix`**, que consulta a API do LivePix a cada 10 segundos e avisa cada doação nova pelo
WebSocket do Streamer.bot. O projeto *Overlay Dinâmico de Lives* **não usa esta ação**: na tela da live o áudio é do **widget do próprio LivePix** (escondido dentro do overlay) e a janela de alerta aparece no mesmo instante, porque o overlay ouve o aviso que o LivePix manda ao widget (a API só traz o texto, sem som, voz nem vídeo). **Esta ação serve só ao dock.** A mensagem que o LivePix marcar como imprópria
fica retida: só o valor aparece.

O código é o de [`acoes-streamerbot/LivePix.cs`](../acoes-streamerbot/LivePix.cs). Diferente das outras ações, esta usa **chaves** (que ficam em variáveis do Streamer.bot, nunca no código) e precisa de **References**.

1. **Criar o aplicativo no LivePix.** No site do LivePix, nas **configurações da sua conta** (a documentação da API só diz isso, sem o nome exato do menu), crie um aplicativo. O nome pode ser qualquer um. Se
   houver caixas de permissão, marque só a de **ler mensagens** (não marque carteira, conta nem webhooks). Deixe **Redirecionamentos** e **Webhooks** vazios: não são usados. Copie o **ID do cliente** (clicar no
   campo copia) e o **segredo**; se você não copiou o segredo ao criar, use **Redefinir segredo** (o antigo deixa de valer). **Não compartilhe o segredo.**
2. **Guardar as chaves no Streamer.bot**, em duas **variáveis globais persistentes** com estes nomes exatos: `livepixClientId` (o ID do cliente) e `livepixClientSecret` (o segredo). Jeito que funciona: crie uma
   ação temporária `Criar chaves LivePix` (receita acima) e dê a ela um gatilho de comando qualquer (*Core > Commands > Command Triggered*, por exemplo `!lpix`; ele só serve para poder testar). Nas sub-ações, uma
   *Core > Globals > Global (Set)* para cada variável, com o nome, o valor e **Persisted** marcado. Botão direito no gatilho, **Test Trigger**, para rodar uma vez; confira no botão **Global Variables** (barra de
   cima) e **apague a ação** (o segredo ficaria escrito nela).
3. **Criar a ação `LivePix`** pela receita de ação com código C# acima, colando o conteúdo de `acoes-streamerbot/LivePix.cs`. Antes de compilar, na aba **References** da janela do código, acrescente
   `System.dll`, `System.Core.dll` e `System.Net.Http.dll` (de `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\`) e `Newtonsoft.Json.dll` (da pasta do Streamer.bot). **Save and Compile** tem que compilar sem erro.
4. **Timer de 10 segundos.** No menu da esquerda do Streamer.bot, em **Timed Actions** (nas versões novas pode aparecer como **Timers**; **não** fica em Settings), crie um: nome `LivePix a cada 10 s`, intervalo de
   **10 segundos**, **Repeat** marcado e **Enabled marcado**. **Um timer novo pode ficar desligado**: confira que ele está ligado (sem isso a ação nunca roda sozinha). Depois volte na ação `LivePix`: no quadro
   **Triggers**, botão direito, *Core > Timed Actions > Timed Action*, e escolha esse timer.
5. **Conferir o log.** Em até 10 segundos o log do Streamer.bot (os arquivos da pasta `logs` dele) mostra "LivePix: o LivePix aceitou o escopo ..." e "LivePix: conectado. Marquei N doacao(oes) antiga(s) como ja
   vistas". **A primeira rodada só marca as doações que já existem**: nenhuma doação antiga vira alerta, só as novas.
6. **Testar (um passo só).** Na aba **Commands**, crie um comando (por exemplo `!lpteste`; deixe só você com permissão) e ligue-o à ação `LivePix`: no quadro **Triggers** dela, botão direito,
   *Core > Commands > Command Triggered*, e escolha esse comando. Depois **digite `!lpteste` no seu chat** (o jeito mais certo; o **Test Trigger** do gatilho também deve funcionar, mas manda menos informação à
   ação). Isso manda uma **doação de mentira** ("Fulano de Teste", R$ 10,00, com "teste" no detalhe) direto ao dock e ao overlay, **sem falar com o LivePix**: serve para ver o alerta antes de haver uma doação de
   verdade. No log aparece "LivePix: doacao de "Fulano de Teste" (10.00 BRL) avisada aos overlays (teste)"; se esta linha não aparece, o código colado na ação é uma versão antiga: cole de novo. Quando terminar,
   **apague esse comando** (senão qualquer um com permissão no chat dispara alertas falsos). O timer de 10 segundos continua fazendo o trabalho de verdade. Para outros testes, existem dois argumentos (*Core >
   Arguments > Set Argument*, `acao`, numa ação à parte com *Run Action* da `LivePix` e **Use Arguments** ligado): `ultima` reenvia a doação mais recente de verdade do LivePix (precisa de pelo menos uma doação
   na sua conta) e `ler` só escreve no log o que a API devolve. **O botão de teste do próprio site do LivePix provavelmente não serve**: ele toca o alerta dele, no widget dele, e não cria uma doação na lista que a
   API devolve.
7. **Na tela da live o alerta é do overlay** (o widget do próprio LivePix, escondido, mais a nossa janela, na fila dos alertas das plataformas, com o template nosso publicado no LivePix: `livepix-template/LEIA-ME.md` do projeto do overlay): deixe **desligada a fonte separada do LivePix** no OBS, senão a doação toca duas vezes.

Para tirar o alerta da aba **Tudo**, desmarque **Doação (LivePix)** em **Alertas no chat**.

**O que precisa ficar aberto:** só o **Streamer.bot** (é ele que pergunta ao LivePix a cada 10 segundos) e, para ver o alerta, o **dock** e o **overlay** no OBS. **Nada do LivePix precisa ficar aberto**: nem o site,
nem o aplicativo, nem a fonte de navegador deles; o site só é usado uma vez, para criar o aplicativo. O PC precisa de internet. A doação fica registrada no LivePix mesmo com tudo fechado. Com o Streamer.bot
fechado, ela só vira alerta quando você o abrir se tiver **menos de 30 minutos** (`MAX_IDADE_MIN`, no começo do código); as mais antigas só são marcadas como vistas, sem alerta. Com o dock ou o overlay fechado na
hora, o alerta se perde (a doação continua no LivePix).

**Se não aparecer:** leia o log do Streamer.bot.

- "faltam livepixClientId e livepixClientSecret": as variáveis não existem ou o nome está diferente (precisa ser igual, letra por letra).
- "recusou o pedido de acesso (401 ... invalid_client)": ID ou segredo errados, ou trocados entre si.
- "(400 ... scope)": o LivePix não aceitou nenhum dos nomes de permissão que o código tenta (`messages:read`, `messages` e sem permissão; o nome não está na documentação do LivePix). Crie a variável global
  persistente `livepixScope` com o nome que aparece nas configurações do seu aplicativo. O que funcionar fica guardado em `livepixEscopoCerto` (apague essa variável para tentar tudo de novo).
- "o LivePix pediu para esperar": limite de chamadas por minuto; aumente o intervalo do timer.
- `error CS...` ao compilar: falta alguma das References do passo 3.
- Depois de um erro a ação **espera** (5 minutos se foi o acesso, 1 minuto se foi a consulta) antes de tentar de novo, para não pedir acesso a cada 10 segundos (o LivePix avisa que pedir acesso demais pode custar a
  conta). Rodar a ação à mão com `acao` = `ultima` ou `ler` ignora a espera.
- O log diz "avisada aos overlays" e o alerta não aparece: o problema é o dock ou o overlay. O Streamer.bot precisa estar conectado nele (no dock, a bolinha azul > **Streamer.bot** diz "conectado") e, no overlay, o OBS
  precisa atualizar o cache da fonte.

**Limites:** o LivePix não avisa por conta própria (a API só tem consulta e webhook, e o webhook exige um endereço público), então o alerta chega até 10 segundos depois da doação. Só o nome, o valor e a mensagem
aparecem (a API não traz vídeo, GIF nem som da doação). Só entram as doações que chegarem com o dock aberto. **Ainda não conferido com uma conta real do LivePix:** o nome da permissão, a ordem das mensagens (o código
descobre sozinho) e se uma doação sem texto aparece na API. Quem quiser fazer a própria ação: o aviso é um `WebsocketBroadcastJson` com
`{"event":{"source":"Custom","type":"LivePix"},"data":{"id","username","message","amount"(centavos),"currency","flagged","createdAt","teste"}}`.

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

Para o dock ocupar mais altura: no menu **Painéis** do OBS, marque **Expandir painéis na vertical** (os painéis das laterais passam a ir de cima a baixo da janela) e desmarque **Bloquear painéis** para poder arrastar o dock e puxar as bordas.

O OBS decide onde o dock fica. Se ele tomar o lugar de Propriedades ou Fontes, tire-o do encaixe: clique em **Float** na barra de
título do dock (ele vira uma janela solta, que pode ficar no segundo monitor). Para economizar espaço sem soltar, arraste a barra do
dock por cima da barra de **Cenas**: eles viram abas do mesmo painel. O dock aguenta ser estreito e baixo.

## 6. Configurar o dock

Clique na **bolinha de estado** (a verde, amarela ou vermelha, no canto de cima) para abrir as **Configurações**. **Toda seção abre e fecha** com um clique no título (a seta ▸ ▾): as conexões (**Streamer.bot** e **OBS**) vêm abertas e as outras vêm recolhidas. **Abrir tudo** e **Recolher tudo**, no alto, mexem em todas de uma vez, e o dock lembra como você deixou. As opções de um recurso opcional só aparecem com o interruptor dele ligado. **Verificar configuração**, também no alto, confere tudo o que você ligou (as ações do Streamer.bot e a versão do código delas, as plataformas, o OBS e o microfone) e mostra ✓, ! ou ✕ com o que fazer em cada caso:

| Seção | O que configurar |
|---|---|
| **Aparência** | Cor de destaque e fundo |
| **Streamer.bot** | **Endereço** (`ws://127.0.0.1:8080`) e **Senha** (a do passo 2.3, ou vazia). Clique em **Salvar e reconectar** |
| **OBS** | **Endereço** (`ws://127.0.0.1:4455`) e **Senha** (a do passo 4, ou vazia). **Salvar e testar** mostra o tempo atual da live |
| **Marcação de momentos** | **Dar título a cada clipe** e a **pasta** dos arquivos (vazia: a pasta `Clipes` ao lado do dock, ou seja, `%LOCALAPPDATA%\LiveHelm\Clipes` no dock instalado; se escolher outra, use o caminho completo, como `C:\Clipes`) |
| **Abas do chat** | Dois interruptores, desligados: **Aba Resgates** (a fila de resgates da Twitch, ao lado de Alertas, com **Cumprir** e **Reembolsar** e um número com os pendentes; precisa da ação `Painel: Controles`) e **Aba AutoMod** (só as mensagens retidas pelo AutoMod, com Permitir e Negar, e o número das que esperam). **Responder** e **Ver perfil** não têm interruptor: estão sempre no menu da mensagem (e o botão ↪ na linha). Responder faz a caixa responder àquela mensagem em qualquer plataforma (com a ação `Painel: Controles`, na Twitch e na Kick a resposta fica ligada à mensagem; sem ela, e no YouTube, que não tem resposta, a mensagem sai com @nome). **Ver perfil** abre um cartão com a foto, os selos, as mensagens da sessão e as punições e, na Twitch (com a ação), a idade da conta, se segue e se é sub, mod ou VIP; **Copiar link do perfil** copia o endereço |
| **Alertas no chat** | Marque os tipos de alerta que também devem aparecer na aba **Tudo** e nas abas de cada plataforma (seguidor, sub, resgate de pontos, anúncio, banimento...). A aba **Alertas** mostra todos, sempre. **Voltar ao padrão** desfaz as suas escolhas |
| **Saúde do OBS** | **Mostrar fps, CPU e rede do OBS no alto** (vem ligado, só lê o OBS). Também aparece na lista das bolinhas azuis. Usa a conexão com o OBS da seção acima |
| **YouTube** | As **regras da categoria** (veja acima) e **Mostrar tags e descrição do YouTube no painel Tags** (vem desligado) |
| **Painel de Multistream** | **Usar o Painel de Multistream** (vem desligado: os botões mexem na live, então quem os quer liga aqui). Põe o painel Multistream, com **Iniciar lives** e **Parar lives**, na lista das bolinhas azuis para mostrar ou esconder. É independente da Saúde do OBS |
| **Predefinições de live** | **Usar predefinições de live** (vem desligado). Põe o painel **Predefinições**, em que você guarda um modo (título e categoria do painel Live, as tags da Twitch e, se quiser, a categoria do YouTube) e o aplica com um clique: ele muda título e categoria nas plataformas ativas e as tags da Twitch. Guardar com o mesmo nome atualiza |
| **Modos do chat (Twitch)** | **Usar os modos do chat** (vem desligado): painel com **Só emotes**, **Modo lento**, **Só seguidores** e **Só inscritos**, num toque, e o tempo do modo lento e de seguidores. Só na Twitch. Precisa da ação `Painel: Controles` |
| **Clipe da Twitch** | **Mostrar o botão de clipe no painel Momentos** (vem desligado), com a duração (15 a 60 s). O botão leva o símbolo da Twitch, cria o clipe e mostra o link para copiar. Precisa da ação `Painel: Controles` |
| **Mudo do microfone** | **Mostrar o botão de mudo do microfone** (vem desligado) e a **entrada do microfone no OBS** (use **Listar as entradas do OBS** e escolha a sua). A caixinha aparece sempre no alto, ao lado esquerdo da bolinha azul: verde com o microfone aberto, vermelha no mudo, cinza se o OBS não está conectado. **Avisar quando eu falar com o microfone no mudo** (ligado): com o microfone no mudo, a caixinha pisca entre o vermelho e o âmbar e aparece o letreiro "Você está no mudo!" quando há voz na entrada (o dock assina o medidor de volume do OBS só enquanto está no mudo; o limiar acompanha o ruído da sala). **Testar o aviso (fale por 5 s)** ouve o microfone e diz até onde chegou a sua voz e se o aviso teria disparado, com o microfone aberto ou no mudo. Usa a conexão com o OBS |
| **Aviso de anúncio (Twitch)** | **Avisar antes de cada anúncio** (vem desligado) e com quantos segundos de antecedência (15, 30, 45 ou 60). **Testar o aviso** mostra o pop-up de mentira, sem falar com a Twitch |

No alto do dock, ao lado do símbolo de cada plataforma, fica o **tempo de live dela** (00:00 com a live desligada) e, junto das plataformas, o **total de espectadores** de todas. O tempo da **Twitch** é o da transmissão principal do OBS (o botão nativo Iniciar transmissão) e, de reserva, o aviso de início da Twitch e o tempo dos destinos do multistream. O de YouTube e Kick é o aviso de início de cada uma e, de reserva, o tempo dos destinos do multistream.

**Como montar:** deixe a **Twitch** como a transmissão do próprio OBS (Configurações > Transmissão) e ponha só **YouTube e Kick** no plugin de multistream, com *sincronizar início e fim* ligado. Assim o botão do OBS inicia os três e o OBS mostra o tempo e a rede da Twitch. Não repita a Twitch no plugin: duas conexões com a mesma chave derrubam uma à outra.

Logo abaixo dos botões de plataforma fica a **linha de saúde do OBS**, em letra pequena: **fps**, **CPU** e **upload**, e, no fim, o estado da live: **Live On** (no ar e sem problemas), **Live Off** (nada no ar) ou, em português simples, o que está acontecendo (a internet oscilando, o PC com dificuldade de codificar o vídeo, o OBS travando). O **Live On/Off** fica fixo e o aviso aparece **ao lado dele**, em texto curto e numa linha só (a linha não muda de altura, então o chat e os painéis de baixo não se mexem quando a live trava); se faltar espaço o texto corta com "…". Passe o mouse sobre ele para ver o aviso completo e o que ele quer dizer. O painel **Multistream**, logo abaixo do chat, tem só os botões **Iniciar lives** e **Parar lives**, que fazem o mesmo que Iniciar e Parar transmissão do OBS (os destinos do plugin de multistream acompanham quando ele está com *sincronizar início e fim*) e pedem confirmação. **Parar lives** faz como o botão do OBS, sem forçar: se você usa **delay** de transmissão, o OBS termina de enviar o que está no delay antes de fechar a conexão, e o painel mostra "Parando… o OBS espera o delay terminar" até tudo fechar. **Não há botões separados por plataforma** (iniciar ou parar só a Kick, por exemplo): o plugin de multistream chama todos os destinos de "multi-output" e o OBS não deixa escolher um por fora; para isso use a janela do plugin. O dock não consegue abrir o painel do plugin de multistream, porque o OBS não permite; se ele estiver fechado, abra pelo menu **Painéis > Múltiplas saídas** do OBS.

Nos **subs de presente**, o alerta (no chat do dock e no overlay) diz quem presenteou e **para quem foi**; quando é um presente em massa mostra a quantidade e os primeiros nomes ("Para Ana, Beto, Caio e mais 2").

No **título da live**, o botão 🙂 abre o seletor de emojis: escreva na busca o que procura (por exemplo "fogo", "coração" ou "dado", em português ou em inglês) e aperte **Enter** para pegar o primeiro, ou navegue pelas abas. O botão 👋 ao lado da busca troca o tom de pele dos emojis de pessoas e gestos. Aparecem só os emojis que o seu sistema consegue desenhar; no Windows 10 os mais novos e as bandeiras ficam de fora.

No **chat**, as abas de plataforma se somam: clique em mais de uma (Twitch e Kick, por exemplo) para ver e falar só nelas; Tudo e Alertas ficam sozinhas.

O **aviso de anúncio** é um pop-up por cima do dock com a contagem regressiva e dois botões: **Adiar 5 min** (usa a ação
`Painel: Anuncio`, [seção 3](#painel-anuncio-adiar-o-anúncio-da-twitch-opcional)) e **Deixar rodar**, que dispensa o aviso daquele
anúncio. Só existe para a Twitch: o Streamer.bot não avisa de anúncios da Kick nem do YouTube.

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
7. **Alertas:** na aba **Alertas** do chat aparecem seguidores, subs, raids e resgates de pontos (na Twitch e na Kick, o resgate vem
   com um fundo na cor da plataforma, e o texto que a pessoa escreveu junto aparece entre aspas abaixo). Se um tipo que você quer não aparece na aba **Tudo**, marque-o em **Configurações > Alertas
   no chat**.
8. **Aviso de anúncio (opcional):** ligue em **Configurações > Aviso de anúncio** e clique em **Testar o aviso**: o pop-up aparece no
   alto do dock. Para o **Adiar 5 min** funcionar de verdade, crie antes a ação [`Painel: Anuncio`](#painel-anuncio-adiar-o-anúncio-da-twitch-opcional).

## 8. Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| Bolinha **vermelha**, aviso "Streamer.bot desconectado" | O Streamer.bot está fechado ou o **WebSocket Server** está desligado. Abra-o e ligue (seção 2.3). Confira também o endereço e a porta nas configurações do dock. |
| Aviso "O Streamer.bot recusou a conexão" | A senha está errada ou faltando. Coloque a mesma senha do **Password** do Streamer.bot nas configurações do dock. |
| Bolinha **amarela** | Uma plataforma ligada no alto não está conectada no Streamer.bot. Entre com a conta dela (seção 2.2) ou desligue a plataforma no alto do dock. |
| "Faltam ações no Streamer.bot: …" | O Streamer.bot não tem uma ação com o nome **EXATAMENTE igual** ao esperado: o dock compara letra por letra, então `Painel: Youtube`, `Painel:YouTube` ou um espaço no fim não valem. Copie o nome das Instruções, confirme com **Ok** a janela da sub-ação e espere até 15 s (o dock relê a lista a cada 15 s). Se você não usa aquela plataforma, desligue o botão dela no alto do dock e o aviso some. |
| No YouTube, a mensagem do dock não sai | O chat do YouTube só existe para uma transmissão que o Streamer.bot **está monitorando** (a live no ar e o YouTube conectado em `Platforms > YouTube`). Com o código atual de [`Painel-Chat.cs`](../acoes-streamerbot/Painel-Chat.cs) (cole de novo), a mensagem vai para a transmissão monitorada mais recente e, se não houver nenhuma, o motivo aparece no log do Streamer.bot ("não enviei no YouTube porque o Streamer.bot não está monitorando nenhuma transmissão"). |
| Na Twitch, a mensagem do dock só sai depois que alguém fala no chat | O envio da `Painel: Chat` usa o código C# `SendMessage`, que depende do chat da Twitch estar ativo no Streamer.bot. Crie a ação **sem código** `Painel: Enviar Twitch` (`Twitch > Chat > Send Message` com `%mensagem%`, seção 3, *Opcional, sem código*): o dock a usa no lugar quando ela existe. |
| O título do YouTube não muda | Cole o código de [`Painel-YouTube.cs`](../acoes-streamerbot/Painel-YouTube.cs) na ação `Painel: YouTube`: a partir daí o dock mostra o motivo (por exemplo, "o Streamer.bot não está monitorando nenhuma transmissão do YouTube") e o registra nos logs do Streamer.bot. O título também não pode ter `<` nem `>` e vai até 100 caracteres. Se ficar com a ação sem código, duas causas comuns: o **Broadcast** da sub-ação `YouTube > Set Title` está em **From Variable** (troque para **All**), ou o YouTube não está conectado no Streamer.bot (a janela da sub-ação mostra **Not Connected** e o pontinho do YouTube no alto do dock fica cinza; entre em `Platforms > YouTube > Accounts`, seção 2.2). |
| O aviso de anúncio não aparece | Ele vem desligado: ligue em **Configurações > Aviso de anúncio**. Use **Testar o aviso** para ver o pop-up. O Streamer.bot só avisa de anúncios da Twitch, uma vez por minuto nos 5 minutos antes. |
| O botão Adiar 5 min está apagado ou não adia | Falta a ação `Painel: Anuncio` (sem acento, [seção 3](#painel-anuncio-adiar-o-anúncio-da-twitch-opcional)), ou a Twitch não tem mais adiamentos (o aviso mostra quantos restam), ou o Streamer.bot precisa entrar de novo na Twitch para ganhar a permissão de gerenciar anúncios. |
| O resgate de pontos não aparece no chat | Ele aparece na aba **Tudo** e na **Alertas**. Na Twitch chegam as suas recompensas e as padrão (mensagem em destaque, emotes, efeito de mensagem...); Power-ups pagos com Bits não aparecem. Na Kick vale o mesmo cuidado dos alertas: conta ligada no site do Streamer.bot e Streamer.bot reiniciado (próxima linha). O resgate só aparece se o Streamer.bot estiver conectado à plataforma (**Platforms**, seção 2.2). |
| Mensagens ou alertas da Kick não chegam | Ligue a conta da Kick também no site do Streamer.bot (**Account > Connections**), além do login no aplicativo, e **reinicie o Streamer.bot** depois de conectar com o site. |
| Tags: "sem resposta da ação (cole o código novo…)" | A ação `Painel: Tags` está com um código antigo ou não compilou. Cole [`Painel-Tags.cs`](../acoes-streamerbot/Painel-Tags.cs) de novo e use **Save and Compile**. |
| Tags: "nao consegui ler o canal" | A Twitch não está conectada como **Broadcaster** no Streamer.bot (seção 2.2). |
| Momentos: "o OBS não respondeu" | O servidor WebSocket do OBS está desligado ou o endereço está errado (seção 4). Use **Salvar e testar** nas configurações. |
| Momentos: "o OBS pede senha" | O OBS tem autenticação ligada. Coloque a senha nas configurações do dock. |
| Momentos: "o OBS não está transmitindo nem gravando" | Não há tempo de live para ler. Comece a transmitir ou a gravar. |
| Momentos: "A pasta dos clipes precisa ser um caminho completo…" | A pasta escolhida nas configurações não é um caminho local completo. Use algo como `C:\Clipes`, sem `..` e sem caminho de rede. |
| Momentos: a linha não entra no arquivo | A ação `Painel: Momentos` não existe, não compilou, ou a pasta não pode ser criada. Veja o log do Streamer.bot (pasta `logs`). |
| Desbanir/liberar não faz nada | A `Painel: Chat` é de uma versão antiga e não tem o verbo `reverter`. Cole [`Painel-Chat.cs`](../acoes-streamerbot/Painel-Chat.cs) de novo. |
| O dock não aparece no OBS | Veja se o OBS estava fechado ao instalar. Use **Docks > LiveHelm**, ou a instalação manual (seção 5). |
| O título da live do YouTube virou `%tituloLive%` (ou `%titulo%`) ao mudar a descrição, as tags ou ao abrir o painel Tags | A ação `Painel: YouTube` ainda tem a sub-ação antiga `YouTube > Set Title`, que roda a cada pedido. **Apague essa sub-ação** (deixe só `Execute C# Code`; passo a passo na seção da ação `Painel: YouTube`) e escreva o título certo de novo no painel Live. |
| A categoria do YouTube não troca ("categoria recusada") | **Se a transmissão já está na categoria pedida (o log diz o número, `id 20` é Gaming), o código versão 4 não reclama mais:** ela só é recusada de verdade quando é outra. O Streamer.bot não diz quais nomes de categoria aceita, e já recusou até "Gaming" no teste do dono (a lista de categorias dele parece vazia: a transmissão mostra o número da categoria, `CategoryName` vem vazio). Para outras categorias (por exemplo People & Blogs) o jeito seguro é trocar à mão no YouTube Studio; também vale **reconectar a conta do YouTube** em `Platforms > YouTube > Accounts` e reiniciar o Streamer.bot (não confirmado). O código **versão 3** de `Painel-YouTube.cs` tenta o nome em inglês, depois em português (como o YouTube Studio mostra) e o número da categoria, espera um instante depois de trocar o título e tenta uma segunda vez. Se ainda assim o YouTube recusar, o log do Streamer.bot (pasta `logs`) diz o que foi tentado ("tentei: …") e a categoria que a transmissão mostra: mande essa linha. A live precisa existir e estar monitorada (criada ou no ar); com a live desligada nada muda e o dock guarda o pedido para a hora em que ela abrir. |
| Tags ou descrição do YouTube não mudam | Confira se a live do YouTube está criada ou no ar e monitorada (sem ela o dock guarda o pedido e aplica quando abrir) e se o código de `Painel-YouTube.cs` é o da versão 4 (**Verificar configuração** avisa). Com a versão 3 ou 4, depois de aplicar a ação relê a transmissão: se ela ainda mostra o valor antigo, o dock avisa "enviadas, mas a transmissão ainda mostra…: confira no YouTube Studio" (a cópia que o Streamer.bot guarda pode estar velha, então olhe o Studio). O log traz "depois de aplicar, a transmissão mostra…". Aplique as tags e a descrição **depois** de confirmar o título e a categoria. |
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
