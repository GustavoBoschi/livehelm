using System;
using System.Text;

public class CPHInline
{
    // Global (nao persistente) onde o resultado fica para o LiveHelm buscar pelo WebSocket.
    const string VariavelDeResposta = "painelControles";

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

    // Guarda { pedido, ok, erro, url } em VariavelDeResposta. O LiveHelm so aceita a resposta que traz o pedido dele; url e o link do clipe criado.
    void Responder(string pedido, bool ok, string erro, string url)
    {
        string json = "{\"pedido\":" + Aspas(pedido) + ",\"ok\":" + (ok ? "true" : "false") + ",\"erro\":" + Aspas(erro) + ",\"url\":" + Aspas(url) + "}";
        CPH.SetGlobalVar(VariavelDeResposta, json, false);
    }

    // Os controles do LiveHelm que nao cabem nas outras acoes. Args:
    //   acao = modo_chat | clipe
    //   pedido (devolvido na resposta)
    //   modo_chat: modo (emotes, lento, seguidores ou inscritos), ligar (true ou false), segundos (modo lento, 3 a 120), minutos (so seguidores, 0 a 129600)
    //   clipe: titulo (vazio = o titulo da live), duracao (5 a 60 segundos)
    // So existem estes controles na Twitch: o Streamer.bot nao tem modo do chat nem clipe na Kick nem no YouTube.
    public bool Execute()
    {
        string pedido = Texto("pedido");
        string acao = Texto("acao").Trim().ToLowerInvariant();
        try
        {
            if (acao == "modo_chat") return ModoDoChat(pedido);
            if (acao == "clipe") return Clipe(pedido);
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
}
