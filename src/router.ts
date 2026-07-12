import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/", name: "home", component: () => import("./views/HomeView.vue") },
  { path: "/source/url", name: "source-url", component: () => import("./views/SourceUrlView.vue") },
  { path: "/queue", name: "queue", component: () => import("./views/QueueView.vue") },
  { path: "/source/fav", name: "source-fav", component: () => import("./views/SourceFavView.vue") },
  { path: "/result/:id", name: "result", component: () => import("./views/ResultView.vue") },
];

export default createRouter({ history: createWebHistory(), routes });
