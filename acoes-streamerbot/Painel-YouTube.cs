using System;
using System.Text;

public class CPHInline
{
    // Global (nao persistente) onde o resultado fica para o LiveHelm buscar pelo WebSocket.
    const string VariavelDeResposta = "painelYoutube";

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

    // Guarda { pedido, ok, erro, titulo, categoria, avisos, semTransmissao } em VariavelDeResposta. O LiveHelm so aceita a resposta que traz o
    // pedido dele; semTransmissao diz que nao havia transmissao para mudar (o LiveHelm guarda o titulo e o aplica quando a live comecar).
    void Responder(string pedido, bool ok, string erro, string titulo, string categoria, string avisos, bool semTransmissao)
    {
        string json = "{\"pedido\":" + Aspas(pedido) + ",\"ok\":" + (ok ? "true" : "false") + ",\"erro\":" + Aspas(erro)
            + ",\"titulo\":" + Aspas(titulo) + ",\"categoria\":" + Aspas(categoria) + ",\"avisos\":" + Aspas(avisos)
            + ",\"semTransmissao\":" + (semTransmissao ? "true" : "false") + "}";
        CPH.SetGlobalVar(VariavelDeResposta, json, false);
    }

    // Muda o titulo (e a categoria, se vier) da transmissao do YouTube que o Streamer.bot esta monitorando.
    // Args: tituloLive, categoriaYoutube (uma categoria da lista do YouTube, como Gaming; vazia = nao mexe), pedido (devolvido na resposta).
    public bool Execute()
    {
        string pedido = Texto("pedido");
        string titulo = Texto("tituloLive").Trim();
        string categoria = Texto("categoriaYoutube").Trim();
        try
        {
            var live = CPH.YouTubeGetLatestMonitoredBroadcast();
            if (live == null || string.IsNullOrEmpty(live.Id))
            {
                // Sem "a mais recente", tenta a lista de todas as monitoradas.
                var todas = CPH.YouTubeGetMonitoredBroadcasts();
                if (todas != null && todas.Count > 0) live = todas[todas.Count - 1];
            }
            if (live == null || string.IsNullOrEmpty(live.Id))
            {
                CPH.LogWarn("Painel: o Streamer.bot nao esta monitorando nenhuma transmissao do YouTube (nao ha transmissao para mudar o titulo).");
                Responder(pedido, false, "o Streamer.bot nao esta monitorando nenhuma transmissao do YouTube (a live precisa estar criada ou no ar e o YouTube conectado em Platforms > YouTube)", "", "", "", true);
                return false;
            }

            bool tituloOk = true;
            string avisos = "";
            if (titulo != "")
            {
                tituloOk = CPH.YouTubeSetTitle(titulo, live.Id);
                if (!tituloOk) CPH.LogWarn("Painel: o YouTube recusou o titulo \"" + titulo + "\".");
            }

            string categoriaFeita = "";
            if (categoria != "")
            {
                if (CPH.YouTubeSetCategory(categoria, live.Id)) categoriaFeita = categoria;
                else
                {
                    avisos = "o YouTube nao aceitou a categoria \"" + categoria + "\" (ele so tem categorias fixas, como Gaming)";
                    CPH.LogWarn("Painel: " + avisos);
                }
            }

            Responder(pedido, tituloOk, tituloOk ? "" : "o YouTube recusou o titulo (confira se ele tem menos de 100 caracteres e nao usa < nem >)", tituloOk ? titulo : "", categoriaFeita, avisos, false);
            return tituloOk;
        }
        catch (Exception e)
        {
            CPH.LogError("Painel: nao foi possivel mudar a live do YouTube (" + e.Message + ")");
            Responder(pedido, false, e.Message, "", "", "", false);
            return false;
        }
    }
}
