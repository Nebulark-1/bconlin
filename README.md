# Ben Conlin: Career

A scroll-driven portfolio of my career so far, from Michigan Tech to a law firm, a surgical department and my own startup, plus a résumé generator.

- **Home** (`index.html`): a scrolling page with a few static structures (rings round my portrait, a timeline, four charts, a set of strings). 400 points race to fill whichever one is in view, and you can pluck them. On wide screens, motes fall down the margins and chime off pegs.
- **Everywhere**: three circles, bottom right: a menu that fans out the pages, "Behind the scenes", and sound. Sound is synthesized in the browser (Karplus-Strong strings, chimes and a pad on each section's chord, all in A major) and is off until you turn it on.
- **Career** (`career.html`): four illustrated chapters on a timeline. Flip the "Behind the scenes" switch to see wireframes and the code behind each scene.
- **Résumé** (`resume.html`): a tailoring tool. Every line comes from a bank of my real résumé bullets (`src/resume/bank.js`), scored by role type. Pick a focus and the page re-ranks itself.

## Run it

```bash
npm install
npm run dev
```

## Deploy

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

The default résumé PDF (`public/resume/Ben-Conlin-Resume.pdf`) is printed from the résumé page. Regenerate it after editing the bank.
