import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const root = document.getElementById('root');

if (!root) throw new Error('Elemento raiz do React não encontrado.');

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Vitalis</h1>
      <p>Estrutura inicial do sistema desktop.</p>
    </main>
  </StrictMode>,
);
