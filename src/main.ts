import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./styles/tokens.css";
import "./styles/animations.css";
import "./styles/naive-overrides.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
// Global cursor tracking for spotlight effects
document.addEventListener('mousemove', (e) => {
  document.documentElement.style.setProperty('--cursor-x', e.clientX + 'px');
  document.documentElement.style.setProperty('--cursor-y', e.clientY + 'px');
});
document.documentElement.style.setProperty('--cursor-x', '50%');
document.documentElement.style.setProperty('--cursor-y', '50%');
// Per-card reactive glow: tracks cursor relative to each card
document.addEventListener('mousemove', (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const card = target.closest('[data-reactive-glow]') as HTMLElement | null;
  if (card) {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--rx', x + '%');
    card.style.setProperty('--ry', y + '%');
  }
});


