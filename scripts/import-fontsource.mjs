#!/usr/bin/env node
// Vendors an open-licensed family from Fontsource (Google Fonts) into public/fonts/
// and adds it to data/fonts.json.
//
//   npm i --no-save @fontsource/hind-siliguri            (and @fontsource-variable/<id> if one exists)
//   npm run fonts:import -- hind-siliguri [more-ids...]
//   npm run fonts:sync
//
// Pass --from <dir> to read packages from another folder's node_modules.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { MANIFEST, ROOT, loadFonts } from '../build/manifest.mjs'

const args = process.argv.slice(2)
const fromAt = args.indexOf('--from')
const from = (fromAt >= 0 ? args.splice(fromAt, 2)[1].replace(/\/?$/, '/') : ROOT) + 'node_modules/'
if (!args.length) throw new Error('usage: import-fontsource.mjs <fontsource-id>... [--from <dir>]')

function parseFaces(pkgDir, cssFile) {
  const css = readFileSync(pkgDir + cssFile, 'utf8')
  return [...css.matchAll(/@font-face\s*{([^}]+)}/g)].map(([, body]) => {
    const get = (prop) => body.match(new RegExp(`${prop}:\\s*([^;]+);`))?.[1].trim()
    return {
      family: get('font-family').replace(/['"]/g, ''),
      style: get('font-style'),
      weight: get('font-weight'),
      file: body.match(/url\(\.\/files\/([^)]+\.woff2)\)/)[1],
      unicodeRange: get('unicode-range'),
    }
  })
}

const fonts = loadFonts()
for (const id of args) {
  const staticDir = `${from}@fontsource/${id}/`
  const variableDir = `${from}@fontsource-variable/${id}/`
  if (!existsSync(staticDir)) throw new Error(`${staticDir} not found — npm i --no-save @fontsource/${id} first`)
  const meta = JSON.parse(readFileSync(staticDir + 'metadata.json', 'utf8'))
  if (!/^(OFL|Apache|UFL)/.test(meta.license.type)) throw new Error(`${id}: unexpected licence ${meta.license.type}`)

  const out = `${ROOT}public/fonts/${id}/`
  mkdirSync(out + 'font-files', { recursive: true })
  const faces = []
  const take = (pkgDir, cssFiles) => {
    for (const cssFile of cssFiles) {
      for (const f of parseFaces(pkgDir, cssFile)) {
        copyFileSync(`${pkgDir}files/${f.file}`, `${out}font-files/${f.file}`)
        faces.push({
          family: f.family,
          style: f.style,
          weight: f.weight,
          unicodeRange: f.unicodeRange,
          src: [{ path: `font-files/${f.file}`, format: 'woff2' }],
        })
      }
    }
  }
  if (existsSync(variableDir)) {
    take(variableDir, readdirSync(variableDir).filter((f) => /^wght(-italic)?\.css$/.test(f)).sort())
  }
  take(staticDir, readdirSync(staticDir).filter((f) => /^\d+(-italic)?\.css$/.test(f)).sort())
  copyFileSync(staticDir + 'LICENSE', out + 'LICENSE.txt')

  const previous = fonts.find((f) => f.slug === id) ?? {}
  const entry = {
    slug: id,
    name: meta.family,
    family: meta.family,
    script: meta.subsets.includes('bengali') ? 'bangla' : 'latin',
    category: meta.category,
    designer: meta.license.attribution,
    description: '',
    license: meta.license.type === 'OFL-1.1' ? 'SIL Open Font License 1.1' : meta.license.type,
    licenseUrl: `/fonts/${id}/LICENSE.txt`,
    source: 'Google Fonts',
    sourceUrl: `https://fonts.google.com/specimen/${meta.family.replace(/ /g, '+')}`,
    ...previous,
    version: meta.version.replace(/^v/, ''),
    faces,
  }
  const at = fonts.findIndex((f) => f.slug === id)
  if (at >= 0) fonts[at] = entry
  else fonts.push(entry)
  console.log(`${id}: ${faces.length} faces`)
}
writeFileSync(MANIFEST, JSON.stringify(fonts, null, 2) + '\n')
