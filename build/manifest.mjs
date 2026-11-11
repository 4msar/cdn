// Reads data/fonts.json and derives the CSS each family serves.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const MANIFEST = ROOT + 'data/fonts.json'
export const SITE = 'https://cdn.msar.me'

export function loadFonts() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8'))
}

/** Directory of a family under /fonts/ (defaults to its slug). */
export const dirOf = (font) => font.dir ?? font.slug

const FORMAT_ORDER = ['woff2', 'woff', 'truetype', 'opentype', 'svg', 'embedded-opentype']

function srcUrl(font, file, base) {
  const v = font.version ? `?v=${font.version}` : ''
  if (file.format === 'svg') return `${base}${file.path}${v}#${font.family.replace(/\s+/g, '')}`
  if (file.format === 'embedded-opentype') return `${base}${file.path}${v ? v + '&' : '?'}#iefix`
  return `${base}${file.path}${v}`
}

/** One @font-face rule. `base` prefixes file paths ('' for font.css, absolute for inline use). */
export function faceCss(font, face, base = '') {
  const files = [...face.src].sort((a, b) => FORMAT_ORDER.indexOf(a.format) - FORMAT_ORDER.indexOf(b.format))
  const eot = files.find((f) => f.format === 'embedded-opentype')
  const lines = [
    `  font-family: '${face.family}';`,
    `  font-style: ${face.style};`,
    `  font-weight: ${face.weight};`,
    `  font-display: swap;`,
  ]
  if (eot) lines.push(`  src: url('${base}${eot.path}');`)
  lines.push(
    '  src: ' +
      files.map((f) => `url('${srcUrl(font, f, base)}') format('${f.format}')`).join(',\n       ') +
      ';',
  )
  if (face.unicodeRange) lines.push(`  unicode-range: ${face.unicodeRange};`)
  return `@font-face {\n${lines.join('\n')}\n}`
}

/** Family names a font defines, variable first. */
export function familiesOf(font) {
  return [...new Set(font.faces.map((f) => f.family))].sort(
    (a, b) => Number(isVariableFamily(font, b)) - Number(isVariableFamily(font, a)),
  )
}

export const isVariableFamily = (font, family) =>
  font.faces.some((f) => f.family === family && String(f.weight).includes(' '))

export const staticFamily = (font) =>
  familiesOf(font).find((f) => !isVariableFamily(font, f)) ?? font.family
export const variableFamily = (font) => familiesOf(font).find((f) => isVariableFamily(font, f))

/** The full font.css served at /fonts/<dir>/font.css. */
export function fontCss(font) {
  const fams = familiesOf(font)
  const fallback = font.category === 'serif' ? 'serif' : 'sans-serif'
  const st = staticFamily(font)
  const vr = variableFamily(font)
  const header = [
    '/*',
    `${font.name} — ${SITE}/fonts/${dirOf(font)}/`,
    font.license ? `License: ${font.license}` : null,
    '',
    'Font families defined by this CSS:',
    ...fams.map((f) => `  - ${f}${isVariableFamily(font, f) ? '  (variable font, for modern browsers)' : ''}`),
    '',
    'Usage example:',
    `  :root { font-family: '${st}', ${fallback}; }`,
    ...(vr
      ? ['  @supports (font-variation-settings: normal) {', `    :root { font-family: '${vr}', ${fallback}; }`, '  }']
      : []),
    '*/',
  ].filter((l) => l !== null)
  return header.join('\n') + '\n' + font.faces.map((f) => faceCss(font, f)).join('\n') + '\n'
}
