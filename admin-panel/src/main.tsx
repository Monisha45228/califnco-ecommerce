import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AdminAuthGate } from './components/AdminAuthGate';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AdminAuthGate>
      <App />
    </AdminAuthGate>
  </React.StrictMode>
);
