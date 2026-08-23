import React from 'react';
import { createRoot } from 'react-dom/client';
import { MyLogApp } from '@/features/MyLogApp';
import '@/app/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('MyLog root element was not found.');

createRoot(root).render(
  <React.StrictMode>
    <MyLogApp />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./service-worker.js');
  });
}
