using System;
using System.Collections.Generic;
using System.Text;

public class CPHInline
{
    // Global (nao persistente) onde o resultado da leitura fica para o LiveHelm buscar pelo WebSocket.
    const string VariavelDeLeitura = "painelTags";

    string Texto(string nome)
    {
        object valor;
        return args.TryGetValue(nome, out valor) && valor != null ? valor.ToString() : "";
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

    // Guarda { pedido, ok, tags, erro, titulo, categoria, afiliado, parceiro, youtube } em VariavelDeLeitura. O LiveHelm so aceita a resposta que
    // traz o pedido dele. titulo e categoria sao os atuais da Twitch (o LiveHelm os poe nos campos ao abrir); youtube leva os do YouTube, a reserva.
    void Responder(string pedido, bool ok, List<string> tags, string erro, string titulo, string categoria, bool afiliado, bool parceiro, string tituloYt, string categoriaYt)
    {
        StringBuilder json = new StringBuilder("{\"pedido\":" + Aspas(pedido) + ",\"ok\":" + (ok ? "true" : "false") + ",\"tags\":[");
        if (tags != null)
            for (int i = 0; i < tags.Count; i++)
                json.Append(i > 0 ? "," : "").Append(Aspas(tags[i]));
        json.Append("],\"erro\":" + Aspas(erro));
        json.Append(",\"titulo\":" + Aspas(titulo) + ",\"categoria\":" + Aspas(categoria));
        json.Append(",\"afiliado\":" + (afiliado ? "true" : "false") + ",\"parceiro\":" + (parceiro ? "true" : "false"));
        json.Append(",\"youtube\":{\"titulo\":" + Aspas(tituloYt) + ",\"categoria\":" + Aspas(categoriaYt) + "}}");
        CPH.SetGlobalVar(VariavelDeLeitura, json.ToString(), false);
    }

    // acao = ler: anota as tags, o titulo e a categoria que o canal tem agora na Twitch e, de reserva, o titulo e a categoria da transmissao
    // do YouTube que o Streamer.bot esta monitorando (arg: pedido, devolvido junto na resposta).
    bool Ler()
    {
        string pedido = Texto("pedido");
        string tituloYt = "";
        string categoriaYt = "";
        try
        {
            var yt = CPH.YouTubeGetLatestMonitoredBroadcast();
            if (yt != null)
            {
                tituloYt = yt.Title ?? "";
                categoriaYt = yt.CategoryName ?? "";
            }
        }
        catch (Exception) { /* YouTube desconectado ou sem transmissao monitorada: so nao ha reserva */ }
        try
        {
            var eu = CPH.TwitchGetBroadcaster();
            var canal = eu == null ? null : CPH.TwitchGetExtendedUserInfoById(eu.UserId);
            if (canal == null)
            {
                Responder(pedido, false, null, "nao consegui ler o canal (a Twitch esta conectada no Streamer.bot?)", "", "", false, false, tituloYt, categoriaYt);
                return false;
            }
            Responder(pedido, true, canal.Tags, "", canal.ChannelTitle ?? "", canal.Game ?? "", canal.IsAffiliate, canal.IsPartner, tituloYt, categoriaYt);
            return true;
        }
        catch (Exception e)
        {
            CPH.LogError("Painel: nao foi possivel ler as tags (" + e.Message + ")");
            Responder(pedido, false, null, e.Message, "", "", false, false, tituloYt, categoriaYt);
            return false;
        }
    }

    // acao = limpar: tira todas as tags do canal.
    bool Limpar()
    {
        bool ok = CPH.TwitchClearChannelTags();
        if (!ok) CPH.LogWarn("Painel: a Twitch recusou limpar as tags.");
        return ok;
    }

    // acao = definir (ou sem acao): troca as tags do canal pelas de tagsLive.
    // Arg: tagsLive, as tags separadas por | (sem #, sem espacos, no maximo 10 de ate 25 letras: o LiveHelm ja entrega assim).
    // O Streamer.bot 1.0.7 nao tem como mudar tags na Kick.
    bool Definir()
    {
        List<string> tags = new List<string>();
        foreach (string t in Texto("tagsLive").Split('|'))
            if (t.Trim() != "") tags.Add(t.Trim());
        if (tags.Count == 0)
        {
            CPH.LogWarn("Painel: Tags recebeu uma lista vazia; nada foi mudado.");
            return false;
        }
        bool ok = CPH.TwitchSetChannelTags(tags);
        if (!ok) CPH.LogWarn("Painel: a Twitch recusou as tags (maximo 10, ate 25 letras ou numeros, sem espacos).");
        return ok;
    }

    public bool Execute()
    {
        string acao = Texto("acao");
        if (acao == "ler") return Ler();
        if (acao == "limpar") return Limpar();
        return Definir();
    }
}
