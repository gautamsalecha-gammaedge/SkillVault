import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider } from './lib/toast.jsx';
import { I18nProvider } from './lib/i18n.jsx';
import { initTheme } from './lib/theme.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);