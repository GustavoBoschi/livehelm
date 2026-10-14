// Valores de partida da conexão. A tela de configurações do dock (bolinha de estado) os sobrepõe, e ?streamerbot= e ?sbsenha= no
// endereço do dock valem antes de tudo. Não coloque senhas reais aqui se for publicar o projeto.

// Servidor WebSocket do Streamer.bot (Servers/Clients > WebSocket Server).
export const STREAMERBOT_URL = 'ws://127.0.0.1:8080';

// Senha do servidor WebSocket do Streamer.bot (vazia = sem senha).
export const STREAMERBOT_SENHA = '';

// obs-websocket do OBS (Ferramentas > Configurações do servidor WebSocket), usado só para ler o tempo da transmissão na marcação
// de momentos.
export const OBS_URL = 'ws://127.0.0.1:4455';
export const OBS_SENHA = '';
