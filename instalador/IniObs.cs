using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

namespace InstaladorLiveHelm
{
    // Um arquivo .ini do OBS (global.ini, user.ini). Só a linha do dock é trocada: o resto do texto, a marca de ordem de bytes
    // e o tipo de quebra de linha ficam como estavam.
    sealed class IniObs
    {
        const string Secao = "BasicWindow";
        const string Chave = "ExtraBrowserDocks"; // a lista de docks de navegador, em JSON, numa linha só

        readonly string _caminho;
        readonly bool _comBom;
        readonly string _quebra;
        readonly List<string> _linhas;

        public string Caminho { get { return _caminho; } }

        public IniObs(string caminho)
        {
            _caminho = caminho;
            var bytes = File.ReadAllBytes(caminho);
            _comBom = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;
            var texto = new UTF8Encoding(false).GetString(bytes, _comBom ? 3 : 0, bytes.Length - (_comBom ? 3 : 0));
            _quebra = texto.Contains("\r\n") ? "\r\n" : "\n";
            _linhas = texto.Split(new[] { _quebra }, StringSplitOptions.None).ToList();
        }

        // Intervalo [inicio, fim) das linhas da seção BasicWindow (sem o cabeçalho), ou -1 se ela não existe.
        int InicioDaSecao(out int fim)
        {
            fim = -1;
            int inicio = _linhas.FindIndex(l => l.Trim() == "[" + Secao + "]");
            if (inicio < 0) return -1;
            fim = _linhas.Count;
            for (int i = inicio + 1; i < _linhas.Count; i++)
                if (_linhas[i].TrimStart().StartsWith("[")) { fim = i; break; }
            return inicio + 1;
        }

        // Docks gravados hoje: cada um é um dicionário (title, url, uuid, e o que mais o OBS pôs).
        public List<Dictionary<string, string>> LerDocks()
        {
            int fim;
            int inicio = InicioDaSecao(out fim);
            var resultado = new List<Dictionary<string, string>>();
            if (inicio < 0) return resultado;
            for (int i = inicio; i < fim; i++)
            {
                if (!_linhas[i].StartsWith(Chave + "=")) continue;
                var json = _linhas[i].Substring(Chave.Length + 1).Trim();
                if (json == "") break;
                var itens = new JavaScriptSerializer().DeserializeObject(json) as object[];
                if (itens == null) break;
                foreach (var item in itens.OfType<Dictionary<string, object>>())
                    resultado.Add(item.ToDictionary(p => p.Key, p => Convert.ToString(p.Value)));
                break;
            }
            return resultado;
        }

        public void GravarDocks(List<Dictionary<string, string>> docks)
        {
            int fim;
            int inicio = InicioDaSecao(out fim);
            if (inicio < 0) throw new InvalidOperationException("O arquivo " + Path.GetFileName(_caminho) + " não tem a seção [" + Secao + "].");
            var linha = Chave + "=" + Serializar(docks);
            int atual = -1;
            for (int i = inicio; i < fim; i++)
                if (_linhas[i].StartsWith(Chave + "=")) { atual = i; break; }
            if (atual >= 0) _linhas[atual] = linha;
            else _linhas.Insert(inicio, linha);
            var texto = string.Join(_quebra, _linhas);
            var corpo = new UTF8Encoding(false).GetBytes(texto);
            using (var arquivo = File.Create(_caminho))
            {
                if (_comBom) arquivo.Write(new byte[] { 0xEF, 0xBB, 0xBF }, 0, 3);
                arquivo.Write(corpo, 0, corpo.Length);
            }
        }

        // JSON no formato que o OBS grava ([{"title":"...","url":"...","uuid":"..."}]), com os textos escapados à mão pra não
        // trocar < > & ' por \uXXXX nos endereços dos outros docks.
        static string Serializar(List<Dictionary<string, string>> docks)
        {
            var sb = new StringBuilder("[");
            for (int i = 0; i < docks.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append('{');
                sb.Append(string.Join(",", docks[i].Select(p => Texto(p.Key) + ":" + Texto(p.Value))));
                sb.Append('}');
            }
            return sb.Append(']').ToString();
        }

        static string Texto(string valor)
        {
            var sb = new StringBuilder("\"");
            foreach (var c in valor ?? "")
            {
                if (c == '"') sb.Append("\\\"");
                else if (c == '\\') sb.Append("\\\\");
                else if (c < 0x20) sb.Append("\\u" + ((int)c).ToString("x4"));
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }
    }
}
