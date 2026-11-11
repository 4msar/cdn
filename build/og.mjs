// Draws the 1200×630 social cards: one default card for the site and one per
// family, set in the family's own font. Text is shaped with fontkit and drawn
// as outlines, so the result does not depend on fonts installed on the machine.
import * as fontkit from 'fontkit'
import sharp from 'sharp'
import { ROOT, dirOf, loadFonts } from './manifest.mjs'
import { LINES, previewFaces, stylesOf, summary } from './render.mjs'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630
export const DEFAULT_OG = '/og/default.png'
export const ogPath = (font) => `/og/${dirOf(font)}.png`

const PAD = 72
const INNER = OG_WIDTH - PAD * 2
const FG = '#000'
const DIM = '#757575'
const LINE = '#e0e0e0'
const LATIN_SAMPLE = 'AaBbCcDdEeFfGg 0123456789'

const opened = new Map()
function open(path) {
  if (!opened.has(path)) opened.set(path, fontkit.openSync(path))
  return opened.get(path)
}

/** Every readable file of the faces that represent a family. */
function filesOf(font) {
  return previewFaces(font)
    .flatMap((face) => face.src)
    .filter((s) => ['woff2', 'woff', 'truetype', 'opentype'].includes(s.format))
    .map((s) => `${ROOT}public/fonts/${dirOf(font)}/${s.path}`)
}

/** The file that covers the most of `text`; families are split into subsets. */
function fileFor(files, text) {
  const cps = [...text].map((c) => c.codePointAt(0)).filter((cp) => cp > 0x20)
  let best = { missing: Infinity }
  for (const path of files) {
    const f = open(path)
    const missing = cps.filter((cp) => !f.hasGlyphForCodePoint(cp)).length
    if (missing < best.missing) best = { f, missing }
    if (!missing) break
  }
  return best
}

/** Shapes `text` and returns its outline at 1 unit per em, plus its advance. */
function shape(fontFiles, text) {
  let pick = fileFor(fontFiles, text)
  if (pick.missing) {
    const ui = fileFor(uiFiles(), text)
    if (ui.missing < pick.missing) pick = ui
  }
  const f = pick.f
  const run = f.layout(text)
  let x = 0
  let d = ''
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i]
    const path = glyph.path.translate(x + pos.xOffset, pos.yOffset).toSVG()
    if (path) d += path
    x += pos.xAdvance
  })
  return { d, width: x / f.unitsPerEm, scale: 1 / f.unitsPerEm }
}

/**
 * An SVG path for `text` with its baseline at `y`. `size` shrinks until the
 * text fits `maxWidth`; `align` is 'left' or 'right' relative to `x`.
 */
function text(fontFiles, str, { x, y, size, fill = FG, maxWidth = INNER, align = 'left' }) {
  const s = shape(fontFiles, str)
  const px = Math.min(size, maxWidth / s.width)
  const k = px * s.scale
  const left = align === 'right' ? x - s.width * px : x
  return `<path fill="${fill}" transform="translate(${left.toFixed(2)} ${y}) scale(${k} ${-k})" d="${s.d}"/>`
}

let ui
function uiFiles() {
  ui ??= filesOf(loadFonts().find((f) => f.slug === 'anek-bangla'))
  return ui
}

function card({ files, title, sample, bottomLeft, bottomRight }) {
  const u = uiFiles()
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
<rect width="100%" height="100%" fill="#fff"/>
${text(u, 'MSAR CDN', { x: PAD, y: 98, size: 30 })}
${text(u, 'cdn.msar.me', { x: OG_WIDTH - PAD, y: 98, size: 30, fill: DIM, align: 'right' })}
<rect x="${PAD}" y="128" width="${INNER}" height="2" fill="${LINE}"/>
${text(files, title, { x: PAD, y: 330, size: 150 })}
${text(files, sample, { x: PAD, y: 440, size: 58, fill: DIM })}
<rect x="${PAD}" y="500" width="${INNER}" height="2" fill="${LINE}"/>
${text(u, bottomLeft, { x: PAD, y: 556, size: 30, maxWidth: INNER * 0.6 })}
${text(u, bottomRight, { x: OG_WIDTH - PAD, y: 556, size: 30, fill: DIM, align: 'right', maxWidth: INNER * 0.36 })}
</svg>`
}

const toPng = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer()

/** The card for one family. */
export function renderFontOg(font) {
  const bangla = font.script === 'bangla'
  return toPng(
    card({
      files: filesOf(font),
      title: font.name,
      sample: bangla ? LINES.bangla[1] : LATIN_SAMPLE,
      bottomLeft: [summary(font), font.designer].filter(Boolean).join(' · '),
      bottomRight: `${bangla ? 'Bangla' : 'Latin'} · ${font.category}`,
    }),
  )
}

/** The site-wide card, used by the catalogue and as the fallback image. */
export function renderDefaultOg(fonts) {
  const styles = fonts.reduce((n, f) => n + stylesOf(f).length, 0)
  return toPng(
    card({
      files: uiFiles(),
      title: 'Open web fonts',
      sample: LINES.bangla[1],
      bottomLeft: `${fonts.length} families · ${styles} styles`,
      bottomRight: 'Bangla · Latin',
    }),
  )
}
