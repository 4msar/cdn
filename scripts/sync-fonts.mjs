#!/usr/bin/env node
// Regenerates public/fonts/<family>/font.css from data/fonts.json and makes
// sure every woff2 file the manifest lists exists (compressed from the .ttf next to it).
//   npm run fonts:sync
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import wawoff2 from 'wawoff2'
import { ROOT, dirOf, fontCss, loadFonts } from '../build/manifest.mjs'

for (const font of loadFonts()) {
  const dir = `${ROOT}public/fonts/${dirOf(font)}/`
  for (const face of font.faces) {
    for (const file of face.src) {
      if (file.format !== 'woff2' || existsSync(dir + file.path)) continue
      const ttf = dir + file.path.replace(/\.woff2$/, '.ttf')
      if (!existsSync(ttf)) throw new Error(`${font.slug}: ${file.path} is missing and there is no .ttf to build it from`)
      writeFileSync(dir + file.path, await wawoff2.compress(readFileSync(ttf)))
      console.log(`woff2  ${dirOf(font)}/${file.path}`)
    }
  }
  if (font.managedCss === false) continue
  const css = fontCss(font)
  const target = dir + 'font.css'
  if (!existsSync(target) || readFileSync(target, 'utf8') !== css) {
    writeFileSync(target, css)
    console.log(`css    ${dirOf(font)}/font.css`)
  }
}
