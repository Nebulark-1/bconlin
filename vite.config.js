import { defineConfig } from "vite";

// Pages: home, the career timeline, the résumé generator and the secrets. Built with
// relative asset paths so the site works from any folder, including a
// GitHub Pages project URL (username.github.io/repo-name/).
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: { main: "index.html", career: "career.html", resume: "resume.html", eggs: "eggs.html" },
    },
  },
});
