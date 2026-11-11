// Renders the catalogue and the per-family specimen pages to HTML strings.
import { statSync } from 'node:fs'
import * as fontkit from 'fontkit'
import { ROOT, SITE, dirOf, faceCss, isVariableFamily, staticFamily, variableFamily } from './manifest.mjs'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const WEIGHT_NAMES = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
}

const LINES = {
  bangla: [
    'নদীর ধারে সকাল', 'বাংলা হরফের সৌন্দর্য', 'মেঘলা দিনের গল্প', 'শব্দের ভেতর আলো', 'পুরোনো বইয়ের ঘ্রাণ',
    'বৃষ্টিভেজা শহর', 'অক্ষরে অক্ষরে গাঁথা', 'দূরের পথের যাত্রী', 'কাগজের নৌকা ভাসে', 'সন্ধ্যার প্রথম তারা',
  ],
  latin: [
    'Morning by the river', 'Quiet letterforms', 'Stories for a grey day', 'Light inside the words', 'The smell of old books',
    'A city after rain', 'Set letter by letter', 'Travellers on a long road', 'Paper boats afloat', 'First star of the evening',
  ],
}

const ALPHABET = {
  bangla: ['অআইঈউঊঋএঐওঔ', 'কখগঘঙচছজঝঞ', 'টঠডঢণতথদধন', 'পফবভমযরলশষসহ', '০১২৩৪৫৬৭৮৯ ৳।'],
  latin: ['ABCDEFGHIJKLMN', 'OPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz', '0123456789 &!?'],
}

const PASSAGE = {
  bangla: [
    'বাংলা লিপির ইতিহাস হাজার বছরের পুরোনো। তালপাতার পুঁথি থেকে ছাপাখানা, আর ছাপাখানা থেকে আজকের পর্দা — প্রতিটি যুগে হরফের রূপ বদলেছে, কিন্তু তার ছন্দ রয়ে গেছে একই। একটি ভালো ফন্ট পাঠককে থামায় না; সে চুপচাপ লেখার অর্থকে সামনে এগিয়ে দেয়। মাত্রা, যুক্তাক্ষর আর কারচিহ্নের সূক্ষ্ম ভারসাম্যই বাংলা টাইপোগ্রাফির প্রাণ।',
    'ওয়েবে বাংলা লেখা এখন আগের চেয়ে অনেক সহজ। ইউনিকোডের কল্যাণে একই লেখা ফোন, ট্যাবলেট ও কম্পিউটারে একইভাবে পড়া যায়। তবু সুন্দর হরফ ছাড়া সেই লেখা অসম্পূর্ণ থেকে যায়। এই সংগ্রহের উদ্দেশ্য তাই সহজ: দ্রুত, নির্ভরযোগ্য ও উন্মুক্ত উপায়ে ভালো বাংলা ফন্ট সবার কাছে পৌঁছে দেওয়া।',
    'যুক্তাক্ষর: ক্ষ জ্ঞ ঞ্চ ঙ্গ ষ্ণ হ্ম ত্র ন্ত্র স্ত্র ক্ত দ্ধ ম্প ল্প শ্চ। সংখ্যা: ০ ১ ২ ৩ ৪ ৫ ৬ ৭ ৮ ৯।',
  ],
  latin: [
    'Type on a screen has one job before any other: to get out of the reader’s way. A good headline face earns attention in a few words, then hands the reader on to the text without a jolt. Weight, contrast and spacing do that work quietly, long before anyone notices the shapes themselves.',
    'Serving a font well matters as much as drawing it well. A small file, a long cache lifetime and a stylesheet that swaps in without hiding the text are the difference between a page that reads at once and one that makes people wait.',
  ],
}

const fallbackOf = (font) => (font.category === 'serif' ? 'serif' : 'sans-serif')

/** CSS font-family value that shows the family, variable first. */
function stack(font) {
  const v = variableFamily(font)
  return [v, staticFamily(font)].filter(Boolean).map((f) => `'${f}'`).join(', ') + `, var(--ui)`
}

/** Distinct static styles, lightest first, upright before italic. */
function stylesOf(font) {
  const fam = staticFamily(font)
  const seen = new Map()
  for (const f of font.faces) {
    if (f.family === fam) seen.set(`${f.weight}|${f.style}`, { weight: Number(f.weight), style: f.style })
  }
  return [...seen.values()].sort((a, b) => (a.style === b.style ? a.weight - b.weight : a.style === 'normal' ? -1 : 1))
}

const styleName = (s) => `${WEIGHT_NAMES[s.weight] ?? s.weight}${s.style === 'italic' ? ' Italic' : ''}`

function weightRange(font) {
  const ws = [...new Set(stylesOf(font).map((s) => s.weight))]
  return { min: ws[0], max: ws[ws.length - 1], count: ws.length, list: ws }
}

/** The faces a catalogue row needs: the variable font, or the weight nearest 400. */
function previewFaces(font) {
  const v = variableFamily(font)
  if (v) return font.faces.filter((f) => f.family === v && f.style === 'normal')
  const w = weightRange(font).list.reduce((a, b) => (Math.abs(b - 400) < Math.abs(a - 400) ? b : a))
  return font.faces.filter((f) => Number(f.weight) === w && f.style === 'normal')
}

/** The file that best represents the family: Bangla subset of the preview face. */
function primaryFile(font) {
  const faces = previewFaces(font)
  const face = faces.find((f) => f.src.some((s) => s.path.includes('-bengali-'))) ?? faces[0]
  const src = face.src.find((s) => ['woff2', 'opentype', 'truetype'].includes(s.format))
  return { ...src, abs: `${ROOT}public/fonts/${dirOf(font)}/${src.path}` }
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`

const BANGLA_MARKS = [[0x981, 0x983], [0x9bc, 0x9bc], [0x9be, 0x9cd], [0x9d7, 0x9d7], [0x9e2, 0x9e3], [0x9fe, 0x9fe]]
const isMark = (cp) => BANGLA_MARKS.some(([a, b]) => cp >= a && cp <= b)
const GLYPH_LIMIT = 360

function glyphs(font) {
  const set = fontkit.openSync(primaryFile(font).abs).characterSet
  const visible = set.filter((cp) => cp > 0x20 && !(cp >= 0x7f && cp <= 0xa0) && !(cp >= 0x2000 && cp <= 0x200f) && cp !== 0xfeff && cp !== 0x25cc)
  const inBangla = (cp) => cp >= 0x980 && cp <= 0x9ff
  const ordered = font.script === 'bangla'
    ? [...visible.filter(inBangla), ...visible.filter((cp) => !inBangla(cp))]
    : visible
  return { total: ordered.length, shown: ordered.slice(0, GLYPH_LIMIT) }
}

const code = (text) =>
  `<div class="code"><pre>${esc(text)}</pre><button type="button" class="copy" data-copy>Copy</button></div>`

function usage(font) {
  const st = staticFamily(font)
  const vr = variableFamily(font)
  const fb = fallbackOf(font)
  const html = [
    `<!-- HTML in your document's head -->`,
    `<link rel="preconnect" href="${SITE}">`,
    `<link rel="stylesheet" href="${SITE}/fonts/${dirOf(font)}/font.css">`,
  ].join('\n')
  const css = [
    '/* CSS */',
    `:root { font-family: '${st}', ${fb}; }`,
    ...(vr ? ['@supports (font-variation-settings: normal) {', `  :root { font-family: '${vr}', ${fb}; }`, '}'] : []),
  ].join('\n')
  return code(html) + code(css)
}

const nav = (links) => `
<header class="nav">
  <a class="nav-home" href="/">MSAR CDN</a>
  <nav>${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</nav>
</header>`

const footer = `
<footer class="footer">
  <span>Open source · served through Cloudflare</span>
  <span><a href="https://github.com/4msar/cdn">GitHub</a> · <a href="https://msar.me/">msar.me</a></span>
</footer>`

const uiFont = `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/anek-bangla/font-files/anek-bangla-latin-wght-normal.woff2?v=16">
<link rel="stylesheet" href="/fonts/anek-bangla/font.css">`

function summary(font) {
  const w = weightRange(font)
  const parts = [w.count > 1 ? `${stylesOf(font).length} styles` : '1 style']
  if (variableFamily(font)) parts.push('Variable')
  return parts.join(' · ')
}

export function renderHome(fonts) {
  const styleCount = fonts.reduce((n, f) => n + stylesOf(f).length, 0)
  const faces = fonts
    .map((f) => previewFaces(f).map((face) => faceCss(f, face, `/fonts/${dirOf(f)}/`)).join('\n'))
    .join('\n')
  const rows = fonts
    .map((font, i) => {
      const line = LINES[font.script][i % LINES[font.script].length]
      return `
    <a class="row" href="/fonts/${dirOf(font)}/" data-name="${esc(`${font.name} ${font.family} ${font.designer} ${font.category}`.toLowerCase())}">
      <span class="row-meta"><span class="row-name">${esc(font.name)}</span><span>${esc(summary(font))}</span></span>
      <span class="row-sample" lang="${font.script === 'bangla' ? 'bn' : 'en'}" data-font="${esc(stack(font))}" data-default="${esc(line)}">${esc(line)}</span>
    </a>`
    })
    .join('')
  const example = fonts[0]
  const body = `
${nav([['#fonts', 'Fonts'], ['#usage', 'Usage'], ['#about', 'About'], ['https://github.com/4msar/cdn', 'GitHub ↗']])}
<main>
  <section class="hero">
    <h1>Bangla web fonts, delivered&nbsp;fast</h1>
    <div class="cols">
      <p class="label">${fonts.length} families<br>${styleCount} styles</p>
      <p>An open CDN for Bengali typography. Every family is one stylesheet away: add a single <code>&lt;link&gt;</code> tag, name the font in your CSS, and the files arrive compressed as <code>woff2</code> from a global edge network.</p>
      <p>The collection pairs the classic Bangla Unicode faces with modern open-licensed families, several of them variable fonts that cover every weight in one file. Pick a family below to see its styles, glyphs and embed code.</p>
    </div>
  </section>

  <section id="fonts">
    <div class="controls">
      <input id="search" type="search" placeholder="Search families" aria-label="Search families" autocomplete="off">
      <input id="preview" type="text" placeholder="Type your own preview text" aria-label="Preview text" autocomplete="off">
      <label class="range"><span>Size</span><input id="size" type="range" min="24" max="120" value="72" aria-label="Preview size"></label>
    </div>
    <div class="rows">${rows}
    </div>
    <p class="empty" id="empty" hidden>No family matches that search.</p>
  </section>

  <section class="split" id="usage">
    <h2>Usage</h2>
    <div>
      <p>Every family lives at <code>/fonts/&lt;name&gt;/font.css</code>. Link the stylesheet, then use the family name it defines. For example, ${esc(example.name)}:</p>
      ${usage(example)}
      <p class="dim">Stylesheets set <code>font-display: swap</code>, so text stays visible while the font loads. Files are served with open CORS headers and can be used from any origin.</p>
    </div>
  </section>

  <section class="split" id="about">
    <h2>About</h2>
    <div class="prose">
      <p>The aim of this project is to make the web more beautiful, fast and open through great Bengali typography. It is maintained by <a href="https://msar.me/">Saiful Alam Rakib</a> and inspired by Maksudur Rahman Maateen’s <a href="https://fonts.maateen.me/">Bangla Web Fonts</a>.</p>
      <p>The fonts themselves are the work of their designers, credited on each family’s page along with its licence. To add a family or report a problem, open an issue on <a href="https://github.com/4msar/cdn">GitHub</a>.</p>
    </div>
  </section>
</main>
${footer}`
  return {
    title: 'MSAR CDN — Bangla web fonts',
    description: 'An open CDN for Bangla web fonts: classic Unicode faces and modern variable families, one stylesheet each.',
    path: '/',
    head: `${uiFont}\n<style>${faces}</style>`,
    body,
  }
}

export function renderFont(font) {
  const script = font.script
  const lang = script === 'bangla' ? 'bn' : 'en'
  const styles = stylesOf(font)
  const w = weightRange(font)
  const vr = variableFamily(font)
  const file = primaryFile(font)
  const g = glyphs(font)
  const isOpen = /open font|gpl|apache/i.test(font.license)
  const legacyTtf = font.faces[0].src.find((s) => s.format === 'truetype')
  const download = isOpen && legacyTtf
    ? `<a class="button" href="/fonts/${dirOf(font)}/${legacyTtf.path}" download>Download ↓</a>`
    : font.sourceUrl
      ? `<a class="button" href="${esc(font.sourceUrl)}">${esc(font.source)} ↗</a>`
      : ''

  const details = [
    ['Designer', font.designer && esc(font.designer)],
    ['Styles', `${styles.length}${vr ? ' + variable' : ''}`],
    ['Weights', w.count > 1 ? `${w.min}–${w.max}` : String(w.min)],
    ['Format', `${[...new Set(font.faces.flatMap((f) => f.src.map((s) => s.format)))].map((f) => ({ truetype: 'ttf', opentype: 'otf', 'embedded-opentype': 'eot' })[f] ?? f).join(', ')}`],
    ['File size', `${kb(statSync(file.abs).size)} <span class="dim">(${esc(file.path.split('/').pop())})</span>`],
    ['Licence', font.licenseUrl ? `<a href="${esc(font.licenseUrl)}">${esc(font.license)}</a>` : esc(font.license)],
    ['Source', font.sourceUrl ? `<a href="${esc(font.sourceUrl)}">${esc(font.source)}</a>` : font.source && esc(font.source)],
  ].filter(([, v]) => v)

  const styleRows = styles
    .map((s, i) => `
    <div class="style">
      <span class="row-meta"><span>${styleName(s)}</span><span>${s.weight}</span></span>
      <p class="style-sample" lang="${lang}" contenteditable="plaintext-only" spellcheck="false" style="font-weight:${s.weight};font-style:${s.style}">${esc(LINES[script][i % LINES[script].length])}</p>
    </div>`)
    .join('')

  const waterfall = [96, 64, 44, 30, 20, 15]
    .map((px, i) => `
    <div class="style">
      <span class="row-meta"><span>${px}px</span></span>
      <p class="fall" lang="${lang}" style="font-size:${px}px;--fs:${px}px">${esc(LINES[script][(i + 3) % LINES[script].length])}${px <= 30 ? ' — ' + esc(LINES[script][(i + 5) % LINES[script].length]) : ''}</p>
    </div>`)
    .join('')

  const step = w.count > 1 ? (vr ? 1 : w.list.slice(1).reduce((gcd, x, i) => { let a = gcd, b = x - w.list[i]; while (b) [a, b] = [b, a % b]; return a }, 0)) : 0
  const tester = `
  <section id="tester">
    <div class="controls">
      <label class="range"><span>Size</span><input type="range" min="14" max="200" value="64" data-var="--t-size" data-unit="px" aria-label="Size"></label>
      ${w.count > 1 ? `<label class="range"><span>Weight</span><input type="range" min="${w.min}" max="${w.max}" step="${step}" value="${w.list.includes(400) ? 400 : w.min}" data-var="--t-weight" aria-label="Weight"><output>${w.list.includes(400) ? 400 : w.min}</output></label>` : ''}
      <span class="dim hint">Click the text to type your own</span>
    </div>
    <p class="tester" lang="${lang}" contenteditable="plaintext-only" spellcheck="false">${esc(script === 'bangla' ? 'অক্ষরে অক্ষরে গাঁথা বাংলা ভাষার রূপ' : 'Letterforms that carry the story')}</p>
  </section>`

  const body = `
${nav([['#usage', 'Usage'], ['#styles', 'Styles'], ['#sample', 'Sample'], ['#glyphs', 'Glyphs'], ['/#fonts', 'All fonts']])}
<main class="specimen" style="--font:${esc(stack(font))}">
  <section class="hero">
    <h1 class="in-font">${esc(font.name)}</h1>
    <div class="cols">
      <p class="label">${esc(summary(font))}<br>${download}</p>
      <p>${esc(font.description)}</p>
      <dl class="details">${details.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </div>
  </section>

  <section class="alphabet in-font" lang="${lang}" aria-label="Character showcase">
    ${ALPHABET[script].map((l) => `<span>${esc(l)}</span>`).join('')}
  </section>

  <section class="split" id="usage">
    <h2>Usage</h2>
    <div>
      <p>Add the stylesheet to your page, then use the family in your CSS.</p>
      ${usage(font)}
      <p class="dim">Prefer CSS? <code>@import url('${SITE}/fonts/${dirOf(font)}/font.css');</code> does the same thing.</p>
    </div>
  </section>
  ${tester}
  <section id="styles" class="in-font">
    <h2 class="section-title">${styles.length > 1 ? 'Styles' : 'Sizes'}</h2>
    ${styles.length > 1 ? styleRows : waterfall}
  </section>

  <section class="split" id="sample">
    <h2>Sample text</h2>
    <div class="passage in-font" lang="${lang}">${PASSAGE[script].map((p) => `<p>${esc(p)}</p>`).join('')}</div>
  </section>

  <section id="glyphs">
    <h2 class="section-title">Glyphs <span class="dim">${g.total} characters${g.total > g.shown.length ? `, first ${g.shown.length} shown` : ''}</span></h2>
    <div class="glyphs in-font" lang="${lang}">${g.shown
      .map((cp) => `<span title="U+${cp.toString(16).toUpperCase().padStart(4, '0')}">${isMark(cp) ? '&#x25CC;' : ''}&#x${cp.toString(16)};</span>`)
      .join('')}</div>
  </section>
</main>
${footer}`

  return {
    title: `${font.name} — MSAR CDN`,
    description: `${font.name} web font on the MSAR CDN. ${font.description}`,
    path: `/fonts/${dirOf(font)}/`,
    head: `${uiFont}\n<link rel="stylesheet" href="/fonts/${dirOf(font)}/font.css">\n<link rel="preload" as="font" type="font/${file.format === 'woff2' ? 'woff2' : 'otf'}" crossorigin href="/fonts/${dirOf(font)}/${file.path}${font.version ? `?v=${font.version}` : ''}">`,
    body,
  }
}

export function fillTemplate(template, page) {
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace('<!--head-->', `<meta name="description" content="${esc(page.description)}">\n<link rel="canonical" href="${SITE}${page.path}">\n${page.head}`)
    .replace('<!--app-->', page.body)
}

export function sitemap(fonts) {
  const urls = ['/', '/fonts/', ...fonts.map((f) => `/fonts/${dirOf(f)}/`)]
  return `<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${SITE}${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`
}
