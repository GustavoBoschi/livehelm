import { createRoot } from 'react-dom/client';
import './style.css';
import App from './App.jsx';
import { aplicarTema, lerConfig } from './configuracoes.js';

// Sem React.StrictMode: ele monta os effects duas vezes em desenvolvimento e abriria a conexão com o Streamer.bot em dobro.
// O tema salvo vale antes do primeiro quadro, pra a página não piscar com as cores padrão.
aplicarTema(lerConfig().tema);
createRoot(document.getElementById('root')).render(<App />);
