using System;
using System.Collections.Generic;
using System.Text;

public class CPHInline
{
    // Global (nao persistente) onde o resultado fica para o LiveHelm buscar pelo WebSocket.
    const string VariavelDeResposta = "painelYoutube";
    const int VERSAO = 2;                 // 2: tambem le e muda tags e descricao (o LiveHelm confere, para avisar de um codigo antigo)
    const int MAX_DESCRICAO = 5000;       // letras da descricao (limite do YouTube)
    const int MAX_LETRAS_DAS_TAGS = 500;  // soma das letras das tags (limite do YouTube)

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

    // O que a acao devolve ao LiveHelm. Descricao e Tags so vem preenchidos na leitura (acao = ler).
    class Resultado
    {
        public string Pedido = "", Erro = "", Titulo = "", Categoria = "", Avisos = "", Descricao = "";
        public bool Ok, SemTransmissao, DescricaoOk = true, TagsOk = true;
        public List<string> Tags = new List<string>();
    }

    // Guarda o resultado em VariavelDeResposta. O LiveHelm so aceita a resposta que traz o pedido dele; semTransmissao diz que nao havia transmissao
    // para mudar (o LiveHelm guarda o que foi pedido e o aplica quando a live comecar).
    void Responder(Resultado r)
    {
        StringBuilder json = new StringBuilder("{\"pedido\":" + Aspas(r.Pedido) + ",\"ok\":" + (r.Ok ? "true" : "false") + ",\"erro\":" + Aspas(r.Erro)
            + ",\"titulo\":" + Aspas(r.Titulo) + ",\"categoria\":" + Aspas(r.Categoria) + ",\"avisos\":" + Aspas(r.Avisos)
            + ",\"semTransmissao\":" + (r.SemTransmissao ? "true" : "false") + ",\"versao\":" + VERSAO
            + ",\"descricao\":" + Aspas(r.Descricao) + ",\"descricaoOk\":" + (r.DescricaoOk ? "true" : "false") + ",\"tagsOk\":" + (r.TagsOk ? "true" : "false") + ",\"tags\":[");
        for (int i = 0; i < r.Tags.Count; i++) json.Append(i > 0 ? "," : "").Append(Aspas(r.Tags[i]));
        json.Append("]}");
        CPH.SetGlobalVar(VariavelDeResposta, json.ToString(), false);
    }

    // A descricao do YouTube nao aceita < nem > e tem no maximo MAX_DESCRICAO letras.
    string LimparDescricao(string texto)
    {
        string limpo = (texto ?? "").Replace("\r\n", "\n").Replace("\r", "\n").Replace("<", "").Replace(">", "").TrimEnd();
        return limpo.Length > MAX_DESCRICAO ? limpo.Substring(0, MAX_DESCRICAO) : limpo;
    }

    // "uma|outra|mais uma" -> lista de tags sem < > e virgulas, sem repetir, e que cabe nas MAX_LETRAS_DAS_TAGS letras que o YouTube aceita (a tag com espaco
    // conta mais duas, das aspas, e cada uma mais uma, da virgula).
    List<string> LerTags(string texto)
    {
        List<string> tags = new List<string>();
        int soma = 0;
        foreach (string bruta in (texto ?? "").Split('|'))
        {
            string tag = bruta.Replace("<", "").Replace(">", "").Replace(",", " ").Trim();
            while (tag.Contains("  ")) tag = tag.Replace("  ", " ");
            if (tag == "" || tags.Exists(t => string.Equals(t, tag, StringComparison.OrdinalIgnoreCase))) continue;
            int custo = tag.Length + 1 + (tag.Contains(" ") ? 2 : 0);
            if (soma + custo > MAX_LETRAS_DAS_TAGS) break;
            soma += custo;
            tags.Add(tag);
        }
        return tags;
    }

    // Args:
    //   acao: vazia = muda a transmissao; ler = so devolve o que a transmissao tem agora (titulo, categoria, descricao e tags)
    //   pedido: devolvido na resposta
    //   tituloLive: o novo titulo (vazio = nao mexe)
    //   categoriaYoutube: uma categoria da lista do YouTube, como Gaming (vazia = nao mexe)
    //   descricaoDefinir = true: troca a descricao por descricaoLive (que pode ser vazia, para apagar)
    //   tagsAcao: definir (troca as tags por tagsYoutube, separadas por |), limpar (tira todas) ou vazio (nao mexe)
    public bool Execute()
    {
        Resultado r = new Resultado { Pedido = Texto("pedido") };
        string acao = Texto("acao").Trim().ToLowerInvariant();
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
                CPH.LogWarn("Painel: o Streamer.bot nao esta monitorando nenhuma transmissao do YouTube (nao ha transmissao para mudar).");
                r.Erro = "o Streamer.bot nao esta monitorando nenhuma transmissao do YouTube (a live precisa estar criada ou no ar e o YouTube conectado em Platforms > YouTube)";
                r.SemTransmissao = true;
                Responder(r);
                return false;
            }

            if (acao == "ler")
            {
                r.Ok = true;
                r.Titulo = live.Title ?? "";
                r.Categoria = live.CategoryName ?? "";
                r.Descricao = live.Description ?? "";
                if (live.Tags != null) r.Tags.AddRange(live.Tags);
                Responder(r);
                return true;
            }

            bool tituloOk = true;
            if (titulo != "")
            {
                tituloOk = CPH.YouTubeSetTitle(titulo, live.Id);
                if (!tituloOk) CPH.LogWarn("Painel: o YouTube recusou o titulo \"" + titulo + "\".");
            }

            if (categoria != "")
            {
                if (CPH.YouTubeSetCategory(categoria, live.Id)) r.Categoria = categoria;
                else
                {
                    r.Avisos = "o YouTube nao aceitou a categoria \"" + categoria + "\" (ele so tem categorias fixas, como Gaming)";
                    CPH.LogWarn("Painel: " + r.Avisos);
                }
            }

            if (Texto("descricaoDefinir").Trim().ToLowerInvariant() == "true")
            {
                r.DescricaoOk = CPH.YouTubeSetDescription(LimparDescricao(Texto("descricaoLive")), live.Id);
                if (!r.DescricaoOk) CPH.LogWarn("Painel: o YouTube recusou a descricao.");
            }

            string tagsAcao = Texto("tagsAcao").Trim().ToLowerInvariant();
            if (tagsAcao == "definir" || tagsAcao == "limpar")
            {
                List<string> tags = tagsAcao == "definir" ? LerTags(Texto("tagsYoutube")) : new List<string>();
                bool limpou = CPH.YouTubeClearTags(live.Id);
                bool adicionou = tags.Count == 0 || CPH.YouTubeAddTags(tags, live.Id);
                if (!limpou && tags.Count > 0) CPH.LogWarn("Painel: nao consegui limpar as tags antigas do YouTube; as novas foram somadas a elas.");
                r.TagsOk = adicionou && (limpou || tags.Count > 0);
                if (!r.TagsOk) CPH.LogWarn("Painel: o YouTube recusou as tags.");
            }

            r.Ok = tituloOk;
            r.Erro = tituloOk ? "" : "o YouTube recusou o titulo (confira se ele tem menos de 100 caracteres e nao usa < nem >)";
            r.Titulo = tituloOk ? titulo : "";
            Responder(r);
            return tituloOk && r.DescricaoOk && r.TagsOk;
        }
        catch (Exception e)
        {
            CPH.LogError("Painel: nao foi possivel mudar a live do YouTube (" + e.Message + ")");
            r.Ok = false;
            r.Erro = e.Message;
            Responder(r);
            return false;
        }
    }
}
