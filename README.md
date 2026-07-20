# Tradewinds ⚓

*A merchant's saga of the Caribbean Sea — trade, sail, fight, and grow a fleet in an endless sandbox.*

Buy low and sell high across eight ports. Choose safe Trade Lanes or the dangerous Smuggler's Run. Fight pirates, hostile navies, krakens, and sharks in turn-based type-triangle combat. Sign freight contracts, hunt bounties, challenge level-scaled bosses, gamble with the Bosun's Mate, collect ten legendary relics — and when your flagship sinks, your fleet fights on.

Read the full player's guide in [HOW-TO.md](./HOW-TO.md).

## Play it

Once GitHub Pages is enabled (see below), the game is playable at:

```
https://<your-username>.github.io/<repo-name>/
```

Progress autosaves in your browser (localStorage) whenever you make port.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a static site in `dist/`.

## Deploy to GitHub Pages (one-time setup)

1. Push this repository to GitHub (all files, including the `.github` folder).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push any commit to `main` (or run the workflow from the **Actions** tab). The included workflow builds the site and publishes it automatically.
5. Your play URL appears in **Settings → Pages** when the first deploy finishes.

Every future commit to `main` redeploys automatically.

## Project structure

```
index.html                  entry page
vite.config.js              build config (relative base for Pages)
src/Tradewinds.jsx          the entire game (single React component)
src/storage-shim.js         maps the game's save API onto localStorage
src/main.jsx                mounts the game
.github/workflows/deploy.yml auto-deploys to GitHub Pages
HOW-TO.md                   the Captain's Handbook (player guide)
```

## Notes

- All artwork is original inline SVG; fonts (IM Fell English, Alegreya) load from Google Fonts under the SIL Open Font License.
- Built with React + Vite (MIT-licensed tooling).
- Before promoting a public release, consider renaming the project — "Tradewinds" collides with an existing game series title — and add a LICENSE file (MIT is a common choice) to state your terms.
