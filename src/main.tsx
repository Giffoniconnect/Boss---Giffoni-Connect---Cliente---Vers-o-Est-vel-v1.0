import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');

if (!root) {
  document.body.innerHTML = '<h1 style="font-family: Arial; padding: 40px;">ERRO CRÍTICO: elemento #root não encontrado no index.html</h1>';
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
