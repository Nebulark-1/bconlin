# Ben Conlin: Career

A scroll-driven portfolio of my career so far, from Michigan Tech to a law firm, a surgical department and my own startup, plus a résumé generator.

- **Career** (`index.html`): four illustrated chapters on a timeline. Flip the "Behind the scenes" switch to see wireframes and the code behind each scene.
- **Résumé** (`resume.html`): a tailoring tool. Every line comes from a bank of my real résumé bullets (`src/resume/bank.js`), scored by role type. Pick a focus and the page re-ranks itself.

## Run it

```bash
npm install
npm run dev
```

## Deploy

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

The default résumé PDF (`public/resume/Ben-Conlin-Resume.pdf`) is printed from the résumé page. Regenerate it after editing the bank.
