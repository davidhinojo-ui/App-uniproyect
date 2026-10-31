import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { ThemeSwitcher } from './components/ThemeSwitcher.js';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el elemento raíz con id "root".');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
    <ThemeSwitcher />
  </React.StrictMode>
);
