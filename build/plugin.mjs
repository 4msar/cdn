// Vite plugin: fills index.html with the catalogue and turns font.html into
// one specimen page per family at /fonts/<family>/.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MANIFEST, ROOT, dirOf, loadFonts } from './manifest.mjs'
import { fillTemplate, renderFont, renderHome, sitemap } from './render.mjs'

export default function cdnPages() {
  let outDir
  return {
    name: 'cdn-pages',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return ctx.path === '/index.html' ? fillTemplate(html, renderHome(loadFonts())) : html
      },
    },
    configureServer(server) {
      server.watcher.add(MANIFEST)
      server.watcher.on('change', (file) => {
        if (file === MANIFEST) server.ws.send({ type: 'full-reload' })
      })
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (path === '/fonts' || path === '/fonts/') {
          req.url = '/index.html'
          return next()
        }
        const dir = path.match(/^\/fonts\/([^/]+)\/?$/)?.[1]
        const font = dir && loadFonts().find((f) => dirOf(f) === dir)
        if (!font) return next()
        try {
          const page = fillTemplate(readFileSync(ROOT + 'font.html', 'utf8'), renderFont(font))
          res.setHeader('Content-Type', 'text/html')
          res.end(await server.transformIndexHtml(path, page))
        } catch (error) {
          next(error)
        }
      })
    },
    closeBundle() {
      const fonts = loadFonts()
      const template = readFileSync(`${outDir}/font.html`, 'utf8')
      for (const font of fonts) {
        const dir = `${outDir}/fonts/${dirOf(font)}`
        mkdirSync(dir, { recursive: true })
        writeFileSync(`${dir}/index.html`, fillTemplate(template, renderFont(font)))
      }
      rmSync(`${outDir}/font.html`)
      copyFileSync(`${outDir}/index.html`, `${outDir}/fonts/index.html`)
      writeFileSync(`${outDir}/sitemap.xml`, sitemap(fonts))
    },
  }
}
