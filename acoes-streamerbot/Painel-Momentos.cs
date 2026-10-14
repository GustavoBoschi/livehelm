using System;
using System.IO;
using System.Text;

public class CPHInline
{
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

    // Tira do nome do arquivo o que o Windows nao aceita.
    string NomeSeguro(string nome)
    {
        foreach (char c in Path.GetInvalidFileNameChars()) nome = nome.Replace(c, '-');
        nome = nome.Trim().TrimEnd('.');
        return nome == "" ? "Clipes - Sem titulo" : nome;
    }

    // Args: linha (o texto da marcacao, por exemplo "Clipe 3 - 00:12:34"), arquivo (nome sem .txt, "Clipes - <titulo da live>")
    // e pasta (vazia = padrao). Cria a pasta e o arquivo se faltarem e acrescenta a linha no fim.
    public bool Execute()
    {
        string linha = Texto("linha");
        if (linha == "")
        {
            CPH.LogWarn("Painel: Momentos recebeu uma marcacao vazia.");
            return false;
        }
        string pasta = Texto("pasta");
        if (pasta == "") pasta = PastaPadrao();
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
