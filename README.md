# MSAR CDN

An open CDN for Bangla web fonts, served at [cdn.msar.me](https://cdn.msar.me).

```html
<link rel="preconnect" href="https://cdn.msar.me">
<link rel="stylesheet" href="https://cdn.msar.me/fonts/kalpurush/font.css">
```

```css
body { font-family: 'Kalpurush', sans-serif; }
```

Every family has a specimen page with its styles, glyphs and embed code at `/fonts/<name>/`.

## Development

```bash
npm install
npm run dev      # local site with live reload
npm run build    # production build in dist/
npm run preview  # serve dist/ locally
```

## How it is put together

| Path | What it holds |
| --- | --- |
| `data/fonts.json` | The manifest: one entry per family with its metadata and `@font-face` faces |
| `public/fonts/<name>/` | The files the CDN serves: font files and `font.css`. These URLs are public and must not change |
| `build/` | Vite plugin that renders the catalogue and one specimen page per family from the manifest |
| `scripts/` | Tools for adding fonts and regenerating `font.css` |
| `src/` | Styles and the small script behind search, preview text and copy buttons |

`font.css` files are generated from the manifest, so edit `data/fonts.json` and run `npm run fonts:sync` instead of editing them by hand. Families marked `"managedCss": false` keep a hand-written stylesheet.

## Adding a font

Only add fonts whose licence allows redistribution, and record the licence in the manifest.

**From Google Fonts (via Fontsource):**

```bash
npm i --no-save @fontsource/hind-siliguri   # plus @fontsource-variable/<id> if the family has one
npm run fonts:import -- hind-siliguri
npm run fonts:sync
```

This copies the `woff2` files and licence into `public/fonts/<id>/`, and adds the family to the manifest. Fill in `designer` and `description` there.

**From your own files:** put the `.ttf` in `public/fonts/<name>/`, add an entry to `data/fonts.json` listing a `woff2` source next to it, and run `npm run fonts:sync`. The script compresses the `.ttf` to `woff2` and writes `font.css`.

When a family's files change, bump its `version` in the manifest. The version is appended to every font URL (`?v=`), so cached copies are replaced.

## Deployment

The site is static: build it and publish `dist/`.

- **GitHub Pages:** `.github/workflows/deploy.yml` builds and deploys on every push to `main`. The repository's Pages source must be set to "GitHub Actions".
- **Cloudflare Pages:** build command `npm run build`, output directory `dist`. `public/_headers` sets long cache lifetimes for font files and open CORS headers.

## Credits

Maintained by [Saiful Alam Rakib](https://msar.me/). Inspired by Maksudur Rahman Maateen's [Bangla Web Fonts](https://fonts.maateen.me/). The fonts are the work of their designers, credited on each family's page.
