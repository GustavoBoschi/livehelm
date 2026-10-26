using System;
using System.Text;

public class CPHInline
{
    // Global (nao persistente) onde o resultado fica para o LiveHelm buscar pelo WebSocket.
    const string VariavelDeResposta = "painelControles";
    const int VERSAO = 2; // 2: tambem cumpre e reembolsa resgates, responde mensagens e le o perfil de quem escreve
    // false: as respostas saem com a sua conta; true: com a conta do bot
    const bool USAR_BOT = false;

    string Texto(string nome)
    {
        object valor;
        return args.TryGetValue(nome, out valor) && valor != null ? valor.ToString() : "";
    }

    // Numero inteiro de um argumento, preso entre minimo e maximo; sem numero valido, o padrao.
    int Numero(string nome, int padrao, int minimo, int maximo)
    {
        int n;
        if (!int.TryParse(Texto(nome).Trim(), out n)) n = padrao;
        return Math.Max(minimo, Math.Min(maximo, n));
    }

    // Texto entre aspas para JSON (barra, aspas e caracteres de controle escapados).
    string Aspas(string texto)
    {
        StringBuilder s = new StringBuilder("\"");
        foreach (char c in texto ?? "")
        {
            if (c == '\\' || c == '"') s.Append('\\').Append(c);
            else if (c < ' ') s.Append("\\u").Append(((int)c).ToString("x4"));
            else s.Append(c);
        }
        return s.Append('"').ToString();
    }

    string Bool(bool valor)
    {
        return valor ? "true" : "false";
    }

    // Guarda { pedido, ok, erro, url, versao, perfil } em VariavelDeResposta. O LiveHelm so aceita a resposta que traz o pedido dele; url e o link do clipe criado e
    // perfil (um objeto JSON ja pronto, ou null) e o perfil de quem escreve.
    void Responder(string pedido, bool ok, string erro, string url, string perfil = null)
    {
        string json = "{\"pedido\":" + Aspas(pedido) + ",\"ok\":" + Bool(ok) + ",\"erro\":" + Aspas(erro) + ",\"url\":" + Aspas(url)
            + ",\"versao\":" + VERSAO + ",\"perfil\":" + (perfil ?? "null") + "}";
        CPH.SetGlobalVar(VariavelDeResposta, json, false);
    }

    // Um id (de mensagem, usuario, recompensa ou resgate) so tem letras, numeros, hifen, sublinhado e dois-pontos: o pedido vem pelo WebSocket, entao nao se confia no que chega.
    bool IdValido(string id)
    {
        if (string.IsNullOrEmpty(id) || id.Length > 120) return false;
        foreach (char c in id)
            if (!(char.IsLetterOrDigit(c) || c == '-' || c == '_' || c == ':')) return false;
        return true;
    }

    // Os controles do LiveHelm que nao cabem nas outras acoes. Args:
    //   acao = modo_chat | clipe | resgate | responder | perfil_twitch | ping
    //   pedido (devolvido na resposta)
    //   modo_chat: modo (emotes, lento, seguidores ou inscritos), ligar (true ou false), segundos (modo lento, 3 a 120), minutos (so seguidores, 0 a 129600)
    //   clipe: titulo (vazio = o titulo da live), duracao (5 a 60 segundos)
    //   resgate: decisao (cumprir ou reembolsar), rewardId, redemptionId (so Twitch)
    //   responder: plataforma (twitch, kick ou youtube), mensagemId, mensagem, usuario (o YouTube nao tem resposta: a mensagem sai com @usuario)
    //   perfil_twitch: usuarioId
    // Modo do chat, clipe, resgate e perfil existem so na Twitch: o Streamer.bot nao tem isso para a Kick nem para o YouTube.
    public bool Execute()
    {
        string pedido = Texto("pedido");
        string acao = Texto("acao").Trim().ToLowerInvariant();
        try
        {
            if (acao == "modo_chat") return ModoDoChat(pedido);
            if (acao == "clipe") return Clipe(pedido);
            if (acao == "resgate") return Resgate(pedido);
            if (acao == "responder") return ResponderMensagem(pedido);
            if (acao == "perfil_twitch") return PerfilDaTwitch(pedido);
            if (acao == "ping")
            {
                Responder(pedido, true, "", "");
                return true;
            }
            CPH.LogWarn("Painel: Controles recebeu uma acao desconhecida (\"" + acao + "\").");
            Responder(pedido, false, "acao desconhecida: " + acao, "");
            return false;
        }
        catch (Exception e)
        {
            CPH.LogError("Painel: Controles falhou (" + e.Message + ")");
            Responder(pedido, false, e.Message, "");
            return false;
        }
    }

    bool ModoDoChat(string pedido)
    {
        string modo = Texto("modo").Trim().ToLowerInvariant();
        bool ligar = Texto("ligar").Trim().ToLowerInvariant() == "true";
        switch (modo)
        {
            case "emotes":
                CPH.TwitchEmoteOnly(ligar);
                break;
            case "lento":
                CPH.TwitchSlowMode(ligar, Numero("segundos", 30, 3, 120));
                break;
            case "seguidores":
                CPH.TwitchFollowMode(ligar, Numero("minutos", 0, 0, 129600));
                break;
            case "inscritos":
                CPH.TwitchSubscriberOnly(ligar);
                break;
            default:
                CPH.LogWarn("Painel: Controles recebeu um modo de chat desconhecido (\"" + modo + "\").");
                Responder(pedido, false, "modo de chat desconhecido: " + modo, "");
                return false;
        }
        Responder(pedido, true, "", "");
        return true;
    }

    bool Clipe(string pedido)
    {
        string titulo = Texto("titulo").Trim();
        if (titulo.Length > 100) titulo = titulo.Substring(0, 100);
        var clipe = CPH.CreateClip(titulo == "" ? null : titulo, Numero("duracao", 30, 5, 60));
        if (clipe == null || string.IsNullOrEmpty(clipe.Url))
        {
            CPH.LogWarn("Painel: a Twitch nao criou o clipe (a live precisa estar no ar na Twitch).");
            Responder(pedido, false, "a Twitch nao criou o clipe (a live precisa estar no ar)", "");
            return false;
        }
        Responder(pedido, true, "", clipe.Url);
        return true;
    }

    // Cumpre ou reembolsa um resgate de pontos da Twitch que esta na fila de resgates. Resgate que se completa sozinho (skip queue) ou ja resolvido nao aceita.
    bool Resgate(string pedido)
    {
        string decisao = Texto("decisao").Trim().ToLowerInvariant();
        string recompensa = Texto("rewardId").Trim();
        string resgate = Texto("redemptionId").Trim();
        if ((decisao != "cumprir" && decisao != "reembolsar") || !IdValido(recompensa) || !IdValido(resgate))
        {
            CPH.LogWarn("Painel: Controles recebeu um pedido de resgate invalido.");
            Responder(pedido, false, "pedido de resgate invalido", "");
            return false;
        }
        bool feito = decisao == "cumprir" ? CPH.TwitchRedemptionFulfill(recompensa, resgate) : CPH.TwitchRedemptionCancel(recompensa, resgate);
        if (!feito) CPH.LogWarn("Painel: a Twitch nao aceitou " + (decisao == "cumprir" ? "cumprir" : "reembolsar") + " o resgate (ja resolvido, ou a recompensa se resolve sozinha).");
        Responder(pedido, feito, feito ? "" : "a Twitch nao aceitou (o resgate ja foi resolvido ou a recompensa se resolve sozinha)", "");
        return feito;
    }

    // Responde a uma mensagem do chat. A Twitch e a Kick tem resposta de verdade (ligada a mensagem); o YouTube nao tem, entao a mensagem sai com @usuario.
    bool ResponderMensagem(string pedido)
    {
        string plataforma = Texto("plataforma").Trim().ToLowerInvariant();
        string mensagem = Texto("mensagem").Trim();
        string mensagemId = Texto("mensagemId").Trim();
        string usuario = Texto("usuario").Trim();
        if (mensagem.Length > 480) mensagem = mensagem.Substring(0, 480);
        if (mensagem == "")
        {
            Responder(pedido, false, "mensagem vazia", "");
            return false;
        }
        if (plataforma == "twitch" || plataforma == "kick")
        {
            if (!IdValido(mensagemId))
            {
                Responder(pedido, false, "faltou o id da mensagem a responder", "");
                return false;
            }
            if (plataforma == "twitch") CPH.TwitchReplyToMessage(mensagem, mensagemId, USAR_BOT, true);
            else CPH.KickReplyToMessage(mensagem, mensagemId, USAR_BOT, true);
        }
        else if (plataforma == "youtube")
        {
            var live = CPH.YouTubeGetLatestMonitoredBroadcast();
            if (live == null)
            {
                CPH.LogWarn("Painel: nao respondi no YouTube porque o Streamer.bot nao esta monitorando nenhuma transmissao.");
                Responder(pedido, false, "o Streamer.bot nao esta monitorando nenhuma transmissao do YouTube", "");
                return false;
            }
            CPH.SendYouTubeMessageToLatestMonitored((usuario != "" ? "@" + usuario + " " : "") + mensagem, USAR_BOT);
        }
        else
        {
            Responder(pedido, false, "plataforma desconhecida: " + plataforma, "");
            return false;
        }
        Responder(pedido, true, "", "");
        return true;
    }

    // O perfil de quem escreve na Twitch (idade da conta, se segue, se e sub, moderador ou VIP...), em JSON, para o cartao do dock.
    bool PerfilDaTwitch(string pedido)
    {
        string id = Texto("usuarioId").Trim();
        if (!IdValido(id))
        {
            Responder(pedido, false, "faltou o id do usuario", "");
            return false;
        }
        var u = CPH.TwitchGetExtendedUserInfoById(id);
        if (u == null)
        {
            Responder(pedido, false, "a Twitch nao devolveu o perfil", "");
            return false;
        }
        string criada = u.CreatedAt.Year > 1990 ? u.CreatedAt.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'") : "";
        string perfil = "{\"nome\":" + Aspas(u.UserName) + ",\"login\":" + Aspas(u.UserLogin) + ",\"descricao\":" + Aspas(u.Description) + ",\"foto\":" + Aspas(u.ProfileImageUrl)
            + ",\"criadaEm\":" + Aspas(criada) + ",\"seguindo\":" + Bool(u.IsFollowing) + ",\"inscrito\":" + Bool(u.IsSubscribed) + ",\"nivelSub\":" + Aspas(u.SubscriptionTier)
            + ",\"moderador\":" + Bool(u.IsModerator) + ",\"vip\":" + Bool(u.IsVip) + ",\"afiliado\":" + Bool(u.IsAffiliate) + ",\"parceiro\":" + Bool(u.IsPartner) + "}";
        Responder(pedido, true, "", "", perfil);
        return true;
    }
}
