import { createApp } from './ui/app.js';

export function boot() {
  const app = createApp({
    screenEl: document.getElementById('screen'),
    statusEl: document.getElementById('status'),
    navEl: document.getElementById('nav'),
    flashEl: document.getElementById('flash'),
  });
  app.go('title');
}
