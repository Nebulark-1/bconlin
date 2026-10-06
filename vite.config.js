import { defineConfig, loadEnv } from "vite";
import { studio } from "./tools/studio.js";

// Pages: home, the career timeline, the résumé generator, projects, about, and the secrets. Built with
// relative asset paths so the site works from any folder, including a
// GitHub Pages project URL (username.github.io/repo-name/).
// studio.html is my private résumé editor: it only runs on the dev server
// and is left out of the build on purpose.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [studio({ env: loadEnv(mode, process.cwd(), "") })],
  // old_projects/ is my archive of past projects (many GB): don't watch it
  server: { watch: { ignored: ["**/old_projects/**", "**/resumes/**"] } },
  build: {
    rollupOptions: {
      input: { main: "index.html", career: "career.html", resume: "resume.html", projects: "projects.html", about: "about.html", eggs: "eggs.html" },
    },
  },
}));
