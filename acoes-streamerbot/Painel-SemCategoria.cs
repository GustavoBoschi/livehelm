using System;

public class CPHInline
{
    // Tira a categoria do canal na Twitch, mandando o id de jogo 0 (a API da Twitch entende 0 como "sem categoria").
    // Testado: a Twitch aceita isso por aqui e o canal fica sem categoria.
    // Voce pode trocar o id por outro (por exemplo, o da categoria "Just Chatting", 509658) se preferir ter sempre uma categoria.
    const string IdSemCategoria = "0";

    public bool Execute()
    {
        try
        {
            bool ok = CPH.SetChannelGameById(IdSemCategoria);
            if (!ok) CPH.LogWarn("Painel: a Twitch nao aceitou tirar a categoria (id " + IdSemCategoria + ").");
            return ok;
        }
        catch (Exception e)
        {
            CPH.LogError("Painel: nao foi possivel tirar a categoria (" + e.Message + ")");
            return false;
        }
    }
}
