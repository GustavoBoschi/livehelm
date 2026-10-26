using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// Ação "LivePix" do Streamer.bot: consulta as mensagens (doações) que a sua conta do LivePix recebeu e avisa o LiveHelm (o dock) e o Overlay Dinâmico de Lives de cada
// nova, para o alerta ser o NOSSO (o do dock e o do overlay), não o do LivePix. Passo a passo: docs/INSTRUCOES.md do LiveHelm, seção "LivePix".
//   disparada pelo Timed Action de 10 s  consulta a API e avisa as doações novas (a primeira rodada só marca as antigas como vistas)
//   argumento acao = ultima  avisa de novo a doação mais recente (para testar o alerta com uma doação de verdade)
//   argumento acao = ler     só escreve nos logs o que a API devolve (quantas, a ordem, a primeira e o limite de chamadas), sem avisar nada
//   disparada por um COMANDO do chat (ou pelo Test Trigger dele), ou argumento acao = teste: manda uma doação de mentira (Fulano de Teste, R$ 10,00) direto ao dock e ao overlay,
//   sem falar com o LivePix: o teste mais simples, para ver o alerta antes de a API funcionar
// Precisa das referências System.dll, System.Core.dll, System.Net.Http.dll e Newtonsoft.Json.dll na aba References do código.
public class CPHInline
{
    // ---- O que você pode mudar ----
    const int POR_PAGINA = 20;                       // quantas mensagens pedir de cada vez
    const int PAUSA_TOKEN_S = 300;                   // depois de o LivePix recusar a chave de acesso, espera isto antes de pedir de novo (pedir token demais pode custar a conta)
    const int PAUSA_ERRO_S = 60;                     // depois de qualquer outro erro da consulta automática (limite de chamadas, LivePix fora do ar...)
    const int MAX_IDADE_MIN = 30;                    // uma doação mais velha que isto (a do tempo em que o Streamer.bot estava fechado) é marcada como vista, sem alerta
    // O nome da permissão (escopo) não está na documentação do LivePix: o código tenta estes, na ordem ("-" = pedir sem escopo), e guarda o que funcionou em livepixEscopoCerto.
    // Para fixar outro nome, crie a global persistente livepixScope (vale sempre; aí nada é tentado).
    static readonly string[] ESCOPOS_PARA_TENTAR = { "messages:read", "messages", "-" };

    // Globais persistentes que você cria no Streamer.bot (as chaves NÃO ficam neste código): livepixClientId e livepixClientSecret (do aplicativo que você cria na sua
    // conta do LivePix). Opcional: livepixScope. O código guarda sozinho: livepixAcesso, livepixAcessoAte e livepixPausaAte (não persistentes), livepixEscopoCerto,
    // livepixIniciado, livepixVistos e livepixPagina.
    // livepixApiUrl e livepixTokenUrl existem só para testes (apontam para um servidor de mentira); sem elas valem os endereços do LivePix.
    static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };

    string Texto(string nome)
    {
        object valor;
        return args.TryGetValue(nome, out valor) && valor != null ? valor.ToString() : "";
    }

    // Lê uma global. Se não achar onde era esperado (persistente ou não), tenta a outra: não importa se a variável foi criada com "Persisted" ligado ou desligado.
    string Global(string nome, bool persistente)
    {
        string v = CPH.GetGlobalVar<string>(nome, persistente);
        if (string.IsNullOrEmpty(v)) v = CPH.GetGlobalVar<string>(nome, !persistente);
        return v == null ? "" : v;
    }

    static long Agora() { return DateTimeOffset.UtcNow.ToUnixTimeSeconds(); }
    string UrlDaApi() { string u = Global("livepixApiUrl", true); return u == "" ? "https://api.livepix.gg" : u.TrimEnd('/'); }
    string UrlDoToken() { string u = Global("livepixTokenUrl", true); return u == "" ? "https://oauth.livepix.gg/oauth2/token" : u; }

    // ---- Chave de acesso (client_credentials: a sua própria conta). O token vale uns 60 minutos e é reaproveitado até vencer: o LivePix avisa que pedir token demais pode custar a conta. ----

    int pausa = PAUSA_ERRO_S; // quanto esperar até a próxima consulta automática, se esta falhar (o Acesso sobe para PAUSA_TOKEN_S)

    string Acesso(bool renovar, out string erro)
    {
        erro = "";
        long ate;
        if (!renovar && long.TryParse(Global("livepixAcessoAte", false), out ate) && ate > Agora() && Global("livepixAcesso", false) != "") return Global("livepixAcesso", false);
        pausa = PAUSA_TOKEN_S;
        string id = Global("livepixClientId", true), segredo = Global("livepixClientSecret", true);
        if (id == "" || segredo == "")
        {
            erro = "faltam livepixClientId e livepixClientSecret nas variaveis globais persistentes";
            return "";
        }
        string fixo = Global("livepixScope", true), certo = Global("livepixEscopoCerto", true);
        string[] escopos = fixo != "" ? new[] { fixo } : certo != "" ? new[] { certo } : ESCOPOS_PARA_TENTAR;
        foreach (string escopo in escopos)
        {
            var campos = new Dictionary<string, string> { { "grant_type", "client_credentials" }, { "client_id", id }, { "client_secret", segredo } };
            if (escopo != "-") campos["scope"] = escopo;
            var resp = Http.PostAsync(UrlDoToken(), new FormUrlEncodedContent(campos)).GetAwaiter().GetResult();
            string corpo = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            if (resp.IsSuccessStatusCode)
            {
                if (fixo == "" && certo == "")
                {
                    CPH.SetGlobalVar("livepixEscopoCerto", escopo, true);
                    CPH.LogInfo("LivePix: o LivePix aceitou o escopo " + (escopo == "-" ? "(nenhum)" : "\"" + escopo + "\"") + "; guardei em livepixEscopoCerto.");
                }
                JObject json = JObject.Parse(corpo);
                string token = (string)json["access_token"];
                long expira = json["expires_in"] != null ? (long)json["expires_in"] : 3600;
                CPH.SetGlobalVar("livepixAcesso", token, false);
                CPH.SetGlobalVar("livepixAcessoAte", (Agora() + Math.Max(60, expira - 60)).ToString(), false);
                pausa = PAUSA_ERRO_S; // o token deu certo: um erro daqui para frente é da consulta, não da chave
                return token ?? "";
            }
            erro = "o LivePix recusou o pedido de acesso (" + (int)resp.StatusCode + ", escopo " + (escopo == "-" ? "nenhum" : "\"" + escopo + "\"") + "): " + Corte(corpo, 300);
            // só um escopo recusado merece outra tentativa com outro nome; chave errada ou LivePix fora do ar não
            if ((int)resp.StatusCode != 400 || corpo.IndexOf("scope", StringComparison.OrdinalIgnoreCase) < 0) return "";
            if (certo != "" && fixo == "") CPH.SetGlobalVar("livepixEscopoCerto", "", true); // o que valia deixou de valer: a próxima rodada tenta a lista de novo
        }
        if (escopos.Length > 1) erro += " [tentei os escopos: " + string.Join(", ", escopos.Select(e => e == "-" ? "nenhum" : e)) + "]";
        return "";
    }

    static string Corte(string t, int max) { t = t ?? ""; return t.Length > max ? t.Substring(0, max) + "..." : t; }

    // ---- Mensagens ----

    class Resposta { public JToken Corpo; public string Limite = ""; public int Estado; public string Erro = ""; }

    // GET /v2/messages?page=N&limit=M. Com 401 (token vencido antes da hora), renova uma vez e tenta de novo.
    Resposta PedirMensagens(int pagina)
    {
        Resposta r = new Resposta();
        for (int tentativa = 0; tentativa < 2; tentativa++)
        {
            string erro;
            string token = Acesso(tentativa == 1, out erro);
            if (token == "") { r.Erro = erro; return r; }
            var req = new HttpRequestMessage(HttpMethod.Get, UrlDaApi() + "/v2/messages?page=" + pagina + "&limit=" + POR_PAGINA);
            req.Headers.Add("Authorization", "Bearer " + token);
            var resp = Http.SendAsync(req).GetAwaiter().GetResult();
            string corpo = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            r.Estado = (int)resp.StatusCode;
            IEnumerable<string> limite;
            if (resp.Headers.TryGetValues("X-RateLimit-Limit", out limite)) r.Limite = string.Join(",", limite);
            if (r.Estado == 401 && tentativa == 0) continue;
            if (!resp.IsSuccessStatusCode)
            {
                r.Erro = r.Estado == 429 ? "o LivePix pediu para esperar (limite de chamadas por minuto)" : "o LivePix recusou (" + r.Estado + "): " + Corte(corpo, 300);
                return r;
            }
            // DateParseHandling.None: sem isso o Newtonsoft transforma o createdAt (texto ISO) em data e o ToString() a devolve no formato do Windows ("24/10/2026 21:51:00" em portugues),
            // que o Quando() nao entende: a ordem da lista e a idade das doacoes ficariam erradas.
            try { using (var leitor = new JsonTextReader(new StringReader(corpo)) { DateParseHandling = DateParseHandling.None }) r.Corpo = JToken.ReadFrom(leitor); }
            catch (Exception) { r.Erro = "resposta do LivePix ilegivel: " + Corte(corpo, 200); }
            return r;
        }
        return r;
    }

    // A lista de mensagens, seja a resposta uma lista solta ou um objeto com a lista dentro (data, messages, items ou results).
    List<JObject> Itens(JToken raiz)
    {
        JArray lista = raiz as JArray;
        JObject objeto = raiz as JObject;
        if (lista == null && objeto != null)
            foreach (string chave in new[] { "data", "messages", "items", "results" })
                if (objeto[chave] is JArray) { lista = (JArray)objeto[chave]; break; }
        List<JObject> itens = new List<JObject>();
        if (lista != null) foreach (JToken t in lista) { JObject o = t as JObject; if (o != null) itens.Add(o); }
        return itens;
    }

    static string Campo(JObject o, params string[] nomes)
    {
        foreach (string n in nomes) { JToken t = o[n]; if (t != null && t.Type != JTokenType.Null) return t.ToString(); }
        return "";
    }

    static DateTimeOffset Quando(JObject o)
    {
        DateTimeOffset d;
        return DateTimeOffset.TryParse(Campo(o, "createdAt", "created_at"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out d) ? d : DateTimeOffset.UtcNow;
    }

    string IdDe(JObject o) { return Campo(o, "id", "reference", "proof"); }

    // As mensagens vêm da mais nova para a mais velha ou ao contrário (a documentação não diz): olha a data da primeira e da última.
    static bool NovasPrimeiro(List<JObject> itens)
    {
        if (itens.Count < 2) return true;
        return Quando(itens[0]) >= Quando(itens[itens.Count - 1]);
    }

    // As mensagens de interesse. Se vêm da mais velha para a mais nova, as novas estão nas últimas páginas: segue a partir da página guardada enquanto a página vier cheia.
    // Devolve todas as mensagens vistas (para marcar ou avisar) e atualiza livepixPagina.
    List<JObject> LerTudo(bool desdeOComeco, out string erro)
    {
        erro = "";
        List<JObject> todas = new List<JObject>();
        int pagina = 1;
        Resposta r = PedirMensagens(1);
        if (r.Erro != "") { erro = r.Erro; return todas; }
        List<JObject> itens = Itens(r.Corpo);
        todas.AddRange(itens);
        if (NovasPrimeiro(itens) || itens.Count < POR_PAGINA) { CPH.SetGlobalVar("livepixPagina", "1", true); return todas; }
        // mais velhas primeiro e a página 1 veio cheia: a lista continua nas páginas seguintes
        int guardada;
        if (!desdeOComeco && int.TryParse(Global("livepixPagina", true), out guardada) && guardada > 1)
        {
            todas.Clear();
            pagina = guardada;
            r = PedirMensagens(pagina);
            if (r.Erro != "") { erro = r.Erro; return todas; }
            itens = Itens(r.Corpo);
            todas.AddRange(itens);
        }
        while (itens.Count >= POR_PAGINA && pagina < 500)
        {
            pagina++;
            r = PedirMensagens(pagina);
            if (r.Erro != "") { erro = r.Erro; break; }
            itens = Itens(r.Corpo);
            todas.AddRange(itens);
        }
        CPH.SetGlobalVar("livepixPagina", pagina.ToString(), true);
        return todas;
    }

    // ---- O aviso aos overlays ----

    void Avisar(JObject m, bool teste)
    {
        long centavos = 0;
        double bruto;
        JToken valor = m["amount"];
        // o valor vem em centavos (inteiro); le o numero direto, porque o ToString() de um numero com casas usa a virgula do Windows em portugues
        if (valor != null && (valor.Type == JTokenType.Integer || valor.Type == JTokenType.Float)) centavos = (long)Math.Round((double)valor);
        else if (double.TryParse(Campo(m, "amount"), NumberStyles.Float, CultureInfo.InvariantCulture, out bruto)) centavos = (long)Math.Round(bruto);
        JObject aviso = new JObject
        {
            { "event", new JObject { { "source", "Custom" }, { "type", "LivePix" } } },
            { "data", new JObject
                {
                    { "id", IdDe(m) },
                    { "username", Campo(m, "username", "name") },
                    { "message", Campo(m, "message") },
                    { "amount", centavos },
                    { "currency", Campo(m, "currency") == "" ? "BRL" : Campo(m, "currency") },
                    { "flagged", Campo(m, "flagged").ToLowerInvariant() == "true" },
                    { "createdAt", Quando(m).ToString("o", CultureInfo.InvariantCulture) },
                    { "teste", teste },
                } },
        };
        CPH.WebsocketBroadcastJson(aviso.ToString(Newtonsoft.Json.Formatting.None));
        CPH.LogInfo("LivePix: doacao de \"" + Campo(m, "username", "name") + "\" (" + (centavos / 100.0).ToString("0.00", CultureInfo.InvariantCulture) + " " + Campo(m, "currency") + ") avisada aos overlays" + (teste ? " (teste)" : "") + ".");
    }

    // ---- Os trabalhos ----

    bool Pausado()
    {
        long ate;
        return long.TryParse(Global("livepixPausaAte", false), out ate) && ate > Agora();
    }

    bool Consultar()
    {
        if (Pausado()) return true; // depois de um erro, espera um pouco em vez de repetir o pedido a cada rodada do timer
        string erro;
        pausa = PAUSA_ERRO_S;
        bool primeira = Global("livepixIniciado", true) == "";
        List<JObject> todas = LerTudo(primeira, out erro);
        if (erro != "" && todas.Count == 0)
        {
            CPH.SetGlobalVar("livepixPausaAte", (Agora() + pausa).ToString(), false);
            CPH.LogWarn("LivePix: " + erro + " (nova tentativa em " + pausa + " s)");
            return false;
        }

        HashSet<string> vistos = new HashSet<string>();
        try { foreach (JToken t in JArray.Parse(Global("livepixVistos", true) == "" ? "[]" : Global("livepixVistos", true))) vistos.Add((string)t); }
        catch (Exception) { /* lista ilegivel: comeca de novo, sem repetir o que ja esta na tela (a primeira rodada marca tudo) */ primeira = true; }

        if (primeira)
        {
            foreach (JObject m in todas) vistos.Add(IdDe(m));
            Guardar(vistos);
            CPH.SetGlobalVar("livepixIniciado", "1", true);
            CPH.LogInfo("LivePix: conectado. Marquei " + todas.Count + " doacao(oes) antiga(s) como ja vistas; so as proximas viram alerta.");
            return true;
        }

        List<JObject> novas = todas.Where(m => IdDe(m) != "" && !vistos.Contains(IdDe(m))).OrderBy(m => Quando(m)).ToList();
        DateTimeOffset corte = DateTimeOffset.UtcNow.AddMinutes(-MAX_IDADE_MIN);
        int velhas = 0;
        foreach (JObject m in novas)
        {
            if (Quando(m) < corte) velhas++; // doada com o Streamer.bot fechado, há muito tempo: um alerta agora só confundiria
            else Avisar(m, false);
            vistos.Add(IdDe(m));
        }
        if (velhas > 0) CPH.LogInfo("LivePix: " + velhas + " doacao(oes) de mais de " + MAX_IDADE_MIN + " minutos atras (de quando o Streamer.bot estava fechado) marcada(s) como ja vista(s), sem alerta.");
        if (novas.Count > 0) Guardar(vistos);
        if (erro != "") CPH.LogWarn("LivePix: " + erro);
        return true;
    }

    // Guarda os últimos ids vistos (o suficiente para a próxima consulta não repetir nada).
    void Guardar(HashSet<string> vistos)
    {
        string[] ultimos = vistos.Skip(Math.Max(0, vistos.Count - 200)).ToArray();
        CPH.SetGlobalVar("livepixVistos", new JArray(ultimos).ToString(Newtonsoft.Json.Formatting.None), true);
    }

    bool Ultima()
    {
        string erro;
        List<JObject> todas = LerTudo(false, out erro);
        if (todas.Count == 0) { CPH.LogWarn("LivePix: " + (erro != "" ? erro : "nenhuma doacao para reenviar") + "."); return false; }
        Avisar(todas.OrderBy(m => Quando(m)).Last(), true);
        return true;
    }

    bool Ler()
    {
        Resposta r = PedirMensagens(1);
        if (r.Erro != "") { CPH.LogWarn("LivePix: " + r.Erro); return false; }
        List<JObject> itens = Itens(r.Corpo);
        CPH.LogInfo("LivePix: a API devolveu " + itens.Count + " mensagem(ns) na pagina 1 (" + (NovasPrimeiro(itens) ? "da mais nova para a mais velha" : "da mais velha para a mais nova") + "); limite de chamadas por minuto: " + (r.Limite == "" ? "nao informado" : r.Limite) + ".");
        if (itens.Count > 0) CPH.LogInfo("LivePix: a primeira mensagem tem estes campos: " + string.Join(", ", itens[0].Properties().Select(p => p.Name)) + ".");
        if (r.Corpo is JObject) CPH.LogInfo("LivePix: a resposta tem estes campos no topo: " + string.Join(", ", ((JObject)r.Corpo).Properties().Select(p => p.Name)) + ".");
        return true;
    }

    // Uma doacao de mentira, sem consultar o LivePix (nem precisa das chaves): serve para ver o alerta no dock e no overlay antes de a API estar funcionando.
    bool Teste()
    {
        JObject m = new JObject
        {
            { "id", "teste-" + Agora() },
            { "username", "Fulano de Teste" },
            { "message", "Esta e uma doacao de teste." },
            { "amount", 1000 },
            { "currency", "BRL" },
            { "flagged", false },
            { "createdAt", DateTimeOffset.UtcNow.ToString("o", CultureInfo.InvariantCulture) },
        };
        Avisar(m, true);
        return true;
    }

    public bool Execute()
    {
        try
        {
            string acao = Texto("acao");
            // veio de um comando do chat ou do Test Trigger de um comando (qualquer argumento que comece com "command"; o Spotify.cs decide parecido): doacao de mentira
            bool veioDeComando = false;
            foreach (string chave in args.Keys) if (chave.StartsWith("command", StringComparison.OrdinalIgnoreCase)) veioDeComando = true;
            if (acao == "" && veioDeComando) acao = "teste";
            switch (acao)
            {
                case "": return Consultar();
                case "ultima": return Ultima();
                case "ler": return Ler();
                case "teste": return Teste();
                default:
                    CPH.LogWarn("LivePix: argumento acao desconhecido (use teste, ultima ou ler).");
                    return false;
            }
        }
        catch (Exception e)
        {
            CPH.LogError("LivePix: " + e.Message);
            return false;
        }
    }
}
