import { defineConfig } from "vite";

// Two pages: the career timeline and the résumé generator. Built with
// relative asset paths so the site works from any folder, including a
// GitHub Pages project URL (username.github.io/repo-name/).
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: { main: "index.html", resume: "resume.html" },
    },
  },
});
