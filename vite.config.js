import { defineConfig, loadEnv } from "vite";
import { existsSync } from "node:fs";

// Pages: home, the career timeline, the résumé generator, projects, and the secrets. Built with
// relative asset paths so the site works from any folder, including a
// GitHub Pages project URL (username.github.io/repo-name/).
//
// My private jobs studio lives in resumes/studio/, which is its own private
// repo and isn't in this one. On my machine the dev server loads it (at
// /studio); anywhere else, like the GitHub build, it isn't there and the
// site builds exactly the same.
const studioServer = new URL("./resumes/studio/server.js", import.meta.url);

export default defineConfig(async ({ mode }) => ({
  base: "./",
  plugins: existsSync(studioServer) ? [(await import(studioServer.href)).studio({ env: loadEnv(mode, process.cwd(), "") })] : [],
  server: {
    watch: {
      // old_projects/ is my archive of past projects (many GB); the studio's
      // data changes as it saves, and shouldn't reload the page
      ignored: ["**/old_projects/**", "**/resumes/engine/**", "**/resumes/*.docx", "**/resumes/.git/**"],
    },
  },
  build: {
    rollupOptions: {
      input: { main: "index.html", career: "career.html", resume: "resume.html", projects: "projects.html", eggs: "eggs.html" },
    },
  },
}));
