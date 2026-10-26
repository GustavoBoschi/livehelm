using System;
using System.Collections.Generic;
using System.Text;

public class CPHInline
{
    // Global (nao persistente) onde o resultado fica para o LiveHelm buscar pelo WebSocket.
    const string VariavelDeResposta = "painelYoutube";
    const int VERSAO = 4;                 // 2: tambem le e muda tags e descricao; 3: tenta outros nomes da categoria e confere o resultado; 4: nao reclama da categoria que a transmissao ja tem e avisa no log se o titulo ficou com um %texto% (o LiveHelm confere a versao, para avisar de um codigo antigo)
    const int MAX_DESCRICAO = 5000;       // letras da descricao (limite do YouTube)
    const int MAX_LETRAS_DAS_TAGS = 500;  // soma das letras das tags (limite do YouTube)

    // O Streamer.bot nao diz quais nomes de categoria aceita (e recusou ate "Gaming" em teste), entao, se o nome pedido for recusado, a acao tenta o mesmo nome em portugues
    // (como o YouTube Studio mostra) e o numero da categoria. Cada nome recusado vai para o log do Streamer.bot, e o que funcionar tambem.
    static readonly Dictionary<string, string[]> OutrosNomes = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        { "Film & Animation", new[] { "Filmes e anima\u00e7\u00f5es", "1" } },
        { "Autos & Vehicles", new[] { "Autom\u00f3veis e ve\u00edculos", "2" } },
        { "Music", new[] { "M\u00fasica", "10" } },
        { "Pets & Animals", new[] { "Animais de estima\u00e7\u00e3o", "15" } },
        { "Sports", new[] { "Esportes", "17" } },
        { "Travel & Events", new[] { "Viagens e eventos", "19" } },
        { "Gaming", new[] { "Jogos", "20" } },
        { "People & Blogs", new[] { "Pessoas e blogs", "22" } },
        { "Comedy", new[] { "Com\u00e9dia", "23" } },
        { "Entertainment", new[] { "Entretenimento", "24" } },
        { "News & Politics", new[] { "Not\u00edcias e pol\u00edtica", "25" } },
        { "Howto & Style", new[] { "Guias e estilo", "26" } },
        { "Education", new[] { "Educa\u00e7\u00e3o", "27" } },
        { "Science & Technology", new[] { "Ci\u00eancia e tecnologia", "28" } },
        { "Nonprofits & Activism", new[] { "ONGs e ativismo", "29" } },
    };

    // Define a categoria tentando o nome pedido e depois os outros nomes dela. Devolve o nome que o Streamer.bot aceitou ("" se nenhum) e, em tentadas, os recusados.
    string DefinirCategoria(string pedida, string idDaLive, List<string> tentadas)
    {
        List<string> nomes = new List<string> { pedida };
        string[] outros;
        if (OutrosNomes.TryGetValue(pedida, out outros)) nomes.AddRange(outros);
        foreach (string nome in nomes)
        {
            if (CPH.YouTubeSetCategory(nome, idDaLive)) return nome;
            tentadas.Add(nome);
        }
        return "";
    }

    // O numero da categoria do YouTube que o nome (ou o numero) pedido representa ("Gaming" -> "20"); "" se nao for uma das conhecidas.
    string IdDaCategoria(string pedida)
    {
        string[] outros;
        if (OutrosNomes.TryGetValue(pedida, out outros)) return outros[outros.Length - 1];
        foreach (string[] nomes in OutrosNomes.Values)
            if (string.Equals(nomes[nomes.Length - 1], pedida, StringComparison.OrdinalIgnoreCase)) return nomes[nomes.Length - 1];
        return "";
    }

    // O titulo parece um argumento do Streamer.bot que ficou sem valor ("%tituloLive%")? Acontece quando a acao tem a sub-acao antiga YouTube > Set Title, que roda a cada pedido.
    bool TituloComArgumento(string titulo)
    {
        int a = (titulo ?? "").IndexOf('%');
        return a >= 0 && (titulo ?? "").IndexOf('%', a + 1) > a + 1;
    }

    // As tags de duas listas sao as mesmas (sem diferenciar maiusculas e sem importar a ordem)?
    bool MesmasTags(List<string> a, IList<string> b)
    {
        int tamanhoB = b == null ? 0 : b.Count;
        if (a.Count != tamanhoB) return false;
        foreach (string t in a)
        {
            bool achou = false;
            foreach (string o in b) if (string.Equals(t, o, StringComparison.OrdinalIgnoreCase)) { achou = true; break; }
            if (!achou) return false;
        }
        return true;
    }

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
        public string CategoriaId = "";
        public string DescricaoConfere = "null", TagsConferem = "null"; // "true", "false" ou "null" (nao conferido): o que a transmissao mostra depois, segundo o Streamer.bot
        public List<string> Tags = new List<string>();
    }

    // Guarda o resultado em VariavelDeResposta. O LiveHelm so aceita a resposta que traz o pedido dele; semTransmissao diz que nao havia transmissao
    // para mudar (o LiveHelm guarda o que foi pedido e o aplica quando a live comecar).
    void Responder(Resultado r)
    {
        StringBuilder json = new StringBuilder("{\"pedido\":" + Aspas(r.Pedido) + ",\"ok\":" + (r.Ok ? "true" : "false") + ",\"erro\":" + Aspas(r.Erro)
            + ",\"titulo\":" + Aspas(r.Titulo) + ",\"categoria\":" + Aspas(r.Categoria) + ",\"avisos\":" + Aspas(r.Avisos)
            + ",\"semTransmissao\":" + (r.SemTransmissao ? "true" : "false") + ",\"versao\":" + VERSAO
            + ",\"descricao\":" + Aspas(r.Descricao) + ",\"descricaoOk\":" + (r.DescricaoOk ? "true" : "false") + ",\"tagsOk\":" + (r.TagsOk ? "true" : "false")
            + ",\"categoriaId\":" + Aspas(r.CategoriaId) + ",\"descricaoConfere\":" + r.DescricaoConfere + ",\"tagsConferem\":" + r.TagsConferem + ",\"tags\":[");
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
                r.CategoriaId = live.CategoryId ?? "";
                r.Descricao = live.Description ?? "";
                if (live.Tags != null) r.Tags.AddRange(live.Tags);
                if (TituloComArgumento(r.Titulo)) CPH.LogWarn("Painel: o titulo da transmissao esta como \"" + r.Titulo + "\" (um argumento sem valor). A acao Painel: YouTube tem a sub-acao antiga YouTube > Set Title: apague-a e deixe so a de codigo C#.");
                CPH.LogInfo("Painel: a transmissao do YouTube mostra categoria \"" + r.Categoria + "\" (id " + r.CategoriaId + "), descricao de " + r.Descricao.Length + " letras e " + r.Tags.Count + " tags.");
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
                // Logo depois de mudar o titulo o YouTube pode recusar a categoria (duas mudancas seguidas no mesmo video): espera um instante e, se todos os nomes forem
                // recusados, espera mais um pouco e tenta tudo de novo uma vez.
                if (titulo != "" && tituloOk) CPH.Wait(700);
                List<string> recusados = new List<string>();
                // Se a transmissao ja esta nessa categoria (o numero bate), nao ha o que mudar: o Streamer.bot recusa qualquer pedido de categoria (ate o que ja vale) e isso so geraria um aviso falso.
                string idPedido = IdDaCategoria(categoria);
                string usada = idPedido != "" && (live.CategoryId ?? "") == idPedido ? categoria : DefinirCategoria(categoria, live.Id, recusados);
                if (idPedido != "" && (live.CategoryId ?? "") == idPedido) CPH.LogInfo("Painel: a transmissao ja esta na categoria \"" + categoria + "\" (id " + idPedido + "); nada a mudar.");
                if (usada == "")
                {
                    CPH.Wait(1500);
                    recusados.Clear();
                    usada = DefinirCategoria(categoria, live.Id, recusados);
                }
                if (usada != "")
                {
                    r.Categoria = usada;
                    if (recusados.Count > 0) CPH.LogInfo("Painel: a categoria so foi aceita com o nome \"" + usada + "\" (recusados: " + string.Join(", ", recusados) + ").");
                }
                else
                {
                    r.Avisos = "o YouTube nao aceitou a categoria \"" + categoria + "\" (tentei: " + string.Join(", ", recusados) + "); ela continua com o numero " + (live.CategoryId ?? "?");
                    CPH.LogWarn("Painel: " + r.Avisos + ". A transmissao mostra a categoria \"" + (live.CategoryName ?? "") + "\" (id " + (live.CategoryId ?? "") + ").");
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

            // Confere o que a transmissao mostra depois (a copia que o Streamer.bot guarda: se ela nao se atualiza, "false" pode ser so a copia velha, e o log diz o que ela mostra).
            bool querDescricao = Texto("descricaoDefinir").Trim().ToLowerInvariant() == "true";
            if (querDescricao || tagsAcao == "definir" || tagsAcao == "limpar")
            {
                var depois = CPH.YouTubeGetLatestMonitoredBroadcast();
                if (depois != null && depois.Id == live.Id)
                {
                    if (querDescricao && r.DescricaoOk) r.DescricaoConfere = (depois.Description ?? "").Trim() == LimparDescricao(Texto("descricaoLive")).Trim() ? "true" : "false";
                    if ((tagsAcao == "definir" || tagsAcao == "limpar") && r.TagsOk)
                        r.TagsConferem = MesmasTags(tagsAcao == "definir" ? LerTags(Texto("tagsYoutube")) : new List<string>(), depois.Tags) ? "true" : "false";
                    CPH.LogInfo("Painel: depois de aplicar, a transmissao mostra descricao de " + (depois.Description ?? "").Length + " letras e " + (depois.Tags == null ? 0 : depois.Tags.Count) + " tags (descricao confere: " + r.DescricaoConfere + ", tags conferem: " + r.TagsConferem + ").");
                }
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
