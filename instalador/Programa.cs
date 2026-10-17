using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;

namespace InstaladorLiveHelm
{
    // Instala o LiveHelm no OBS: grava o arquivo do dock numa pasta fixa e registra o dock na lista de docks de
    // navegador do OBS (ExtraBrowserDocks). O OBS 31 em diante lê essa lista de user.ini e as versões anteriores, de
    // global.ini: os dois recebem o dock. O OBS reescreve esses arquivos ao fechar, então só dá pra mexer neles com o OBS fechado. Sem argumentos instala ou atualiza; --remover desfaz.
    // Opções de teste: --obs <pasta> (no lugar de %APPDATA%\obs-studio), --destino <pasta> (onde fica o .html) e --sem-pausa
    // (sem janelas: devolve o resultado no código de saída, 0 = ok, 1 = OBS aberto, 2 = sem configuração do OBS, 3 = erro).
    static class Programa
    {
        const string Titulo = "LiveHelm";                  // nome do dock no menu Docks do OBS
        const string Arquivo = "livehelm.html";
        const string NomeDoProduto = "LiveHelm";
        const string ProcessoDoObs = "obs64";
        const int ForaDoObs = 1, SemConfiguracao = 2, Falha = 3;

        static string Valor(string[] args, string nome)
        {
            int i = Array.IndexOf(args, nome);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }

        [STAThread]
        static int Main(string[] args)
        {
            bool remover = args.Contains("--remover");
            bool silencioso = args.Contains("--sem-pausa");
            var pastaObs = Valor(args, "--obs") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "obs-studio");
            var destino = Valor(args, "--destino") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LiveHelm");

            Application.EnableVisualStyles();
            try
            {
                if (!Directory.Exists(pastaObs))
                    return Encerrar(silencioso, SemConfiguracao, MessageBoxIcon.Error,
                        "Não achei a configuração do OBS (" + pastaObs + ").\n\nAbra o OBS uma vez, feche e rode este programa de novo.");

                // Com o OBS aberto, ele reescreveria os arquivos ao fechar e apagaria a mudança.
                while (Process.GetProcessesByName(ProcessoDoObs).Length > 0)
                {
                    if (silencioso) return ForaDoObs;
                    var resposta = MessageBox.Show("O OBS está aberto. Feche o OBS por completo (incluindo o ícone perto do relógio, se ele ficar lá) e clique em Tentar novamente.",
                        NomeDoProduto, MessageBoxButtons.RetryCancel, MessageBoxIcon.Information);
                    if (resposta == DialogResult.Cancel) return ForaDoObs;
                }

                var arquivosIni = new[] { "user.ini", "global.ini" }.Select(n => Path.Combine(pastaObs, n)).Where(File.Exists).ToList();
                if (arquivosIni.Count == 0)
                    return Encerrar(silencioso, SemConfiguracao, MessageBoxIcon.Error,
                        "Não achei user.ini nem global.ini em " + pastaObs + ".\n\nAbra o OBS uma vez, feche e rode este programa de novo.");

                var caminhoDoDock = Path.Combine(destino, Arquivo);
                var endereco = new Uri(caminhoDoDock).AbsoluteUri;
                if (!remover) CopiarDock(caminhoDoDock);

                foreach (var caminho in arquivosIni)
                {
                    FazerCopia(caminho);
                    var ini = new IniObs(caminho);
                    var docks = ini.LerDocks();
                    // O dock desta instalação (o mesmo arquivo), se já existir, é trocado e guarda o uuid: o OBS lembra o lugar dele.
                    // O uuid novo vem sem hífens, que é como o OBS o grava.
                    var antigo = docks.FirstOrDefault(d => d.ContainsKey("url") && d["url"].EndsWith(Arquivo, StringComparison.OrdinalIgnoreCase));
                    var uuid = antigo != null && antigo.ContainsKey("uuid") ? antigo["uuid"] : Guid.NewGuid().ToString("N");
                    docks = docks.Where(d => d != antigo).ToList();
                    if (!remover)
                        docks.Add(new Dictionary<string, string> { { "title", Titulo }, { "url", endereco }, { "uuid", uuid } });
                    ini.GravarDocks(docks);
                }

                if (remover)
                {
                    try { if (File.Exists(caminhoDoDock)) File.Delete(caminhoDoDock); if (Directory.Exists(destino) && !Directory.EnumerateFileSystemEntries(destino).Any()) Directory.Delete(destino); }
                    catch (IOException) { /* arquivo em uso: fica lá, sem registro no OBS não faz diferença */ }
                    return Encerrar(silencioso, 0, MessageBoxIcon.Information, "O dock “" + Titulo + "” foi removido do OBS.");
                }
                return Encerrar(silencioso, 0, MessageBoxIcon.Information,
                    "O " + NomeDoProduto + " foi instalado com sucesso!\n\n" +
                    "Para mais informações, consulte o README e as Instruções do " + NomeDoProduto + ".");
            }
            catch (Exception erro)
            {
                return Encerrar(silencioso, Falha, MessageBoxIcon.Error, "Não consegui terminar: " + erro.Message);
            }
        }

        static int Encerrar(bool silencioso, int codigo, MessageBoxIcon icone, string mensagem)
        {
            if (!silencioso) MessageBox.Show(mensagem, NomeDoProduto, MessageBoxButtons.OK, icone);
            return codigo;
        }

        // Guarda uma cópia do arquivo do OBS antes da primeira alteração (e não a sobrescreve nas próximas).
        static void FazerCopia(string caminho)
        {
            var copia = caminho + ".livehelm.bak";
            if (!File.Exists(copia)) File.Copy(caminho, copia);
        }

        static void CopiarDock(string caminho)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(caminho));
            using (var origem = Assembly.GetExecutingAssembly().GetManifestResourceStream(Arquivo))
            {
                if (origem == null) throw new InvalidOperationException("O dock não veio dentro do programa (rode npm run instalador).");
                using (var saida = File.Create(caminho)) origem.CopyTo(saida);
            }
        }
    }
}
