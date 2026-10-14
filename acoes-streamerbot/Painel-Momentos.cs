using System;
using System.IO;
using System.Text;

public class CPHInline
{
    const int MAX_LINHA = 300;   // letras de uma marcacao
    const int MAX_NOME = 120;    // letras do nome do arquivo

    // Pasta padrao quando o LiveHelm nao manda uma: Documentos\LiveHelm\Clipes
    string PastaPadrao()
    {
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "LiveHelm", "Clipes");
    }

    string Texto(string nome)
    {
        object valor;
        return args.TryGetValue(nome, out valor) && valor != null ? valor.ToString() : "";
    }

    // Tira do nome do arquivo o que o Windows nao aceita e limita o tamanho.
    string NomeSeguro(string nome)
    {
        foreach (char c in Path.GetInvalidFileNameChars()) nome = nome.Replace(c, '-');
        if (nome.Length > MAX_NOME) nome = nome.Substring(0, MAX_NOME);
        nome = nome.Trim().TrimEnd('.');
        return nome == "" ? "Clipes - Sem titulo" : nome;
    }

    bool EhLetra(char c)
    {
        return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
    }

    // O pedido chega pelo WebSocket do Streamer.bot, entao a acao so grava em pasta local com letra de unidade (C:\Clipes), sem ".."
    // e sem caminho de rede (\\servidor\...), que faria o Windows tentar autenticar em outro computador.
    bool PastaLocalValida(string pasta)
    {
        if (pasta.Length < 3 || !EhLetra(pasta[0]) || pasta[1] != ':' || (pasta[2] != '\\' && pasta[2] != '/')) return false;
        foreach (string parte in pasta.Split('\\', '/'))
            if (parte == "..") return false;
        return true;
    }

    // Args: linha (o texto da marcacao, por exemplo "Clipe 3 - 00:12:34"), arquivo (nome sem .txt, "Clipes - <titulo da live>")
    // e pasta (vazia = padrao). Cria a pasta e o arquivo se faltarem e acrescenta a linha no fim.
    public bool Execute()
    {
        // uma marcacao e sempre uma linha so
        string linha = Texto("linha").Replace("\r", " ").Replace("\n", " ").Trim();
        if (linha.Length > MAX_LINHA) linha = linha.Substring(0, MAX_LINHA);
        if (linha == "")
        {
            CPH.LogWarn("Painel: Momentos recebeu uma marcacao vazia.");
            return false;
        }
        string pasta = Texto("pasta").Trim();
        if (pasta == "") pasta = PastaPadrao();
        if (!PastaLocalValida(pasta))
        {
            CPH.LogWarn("Painel: Momentos recusou a pasta (use um caminho completo de uma unidade local, como C:\\Clipes).");
            return false;
        }
        try
        {
            Directory.CreateDirectory(pasta);
            string caminho = Path.Combine(pasta, NomeSeguro(Texto("arquivo")) + ".txt");
            // UTF-8 com marca de ordem: o Bloco de Notas abre os acentos certo
            File.AppendAllText(caminho, linha + Environment.NewLine, new UTF8Encoding(true));
            CPH.LogInfo("Painel: momento salvo em " + caminho);
            return true;
        }
        catch (Exception e)
        {
            CPH.LogError("Painel: nao foi possivel salvar o momento (" + e.Message + ")");
            return false;
        }
    }
}
