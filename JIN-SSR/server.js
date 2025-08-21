import fs from 'node:fs/promises'
import express from 'express'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Constants
const isProduction = process.env.NODE_ENV === 'production'
const port = process.env.PORT || 6173
const base = process.env.BASE || '/'

const _dirname = path.dirname(fileURLToPath(import.meta.url))
const resolve = (p) => path.resolve(_dirname, p)

// Cached production assets
const templateHtml = isProduction
  ? resolve('./dist/client/index.html')
  : resolve('index.html')

// Create http server
const app = express()

// Add Vite or respective production middlewares
/** @type {import('vite').ViteDevServer | undefined} */
let vite
if (!isProduction) {
  const { createServer } = await import('vite')
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    base,
  })
  app.use(vite.middlewares)
} else {
  const compression = (await import('compression')).default
  const sirv = (await import('sirv')).default
  app.use(compression())
  app.use(base, sirv('./dist/client', { extensions: [] }))
}

// Serve HTML
app.use('*all', async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, '')
    /** @type {string} */
    let template
    /** @type {import('./src/entry-server.ts').render} */
    let render
    template = await fs.readFile(templateHtml, 'utf-8')
    if (!isProduction) {
      // Always read fresh template in development
      template = await vite.transformIndexHtml(url, template)
      render = (await vite.ssrLoadModule('/src/entry-server.ts')).render
    } else {

      render = (await import('./dist/server/entry-server.js')).render
    }

    const manifest = isProduction ?
      JSON.parse(await fs.readFile('./dist/client/.vite/ssr-manifest.json', 'utf-8'))
      : {}

    const [ appHtml, preloadLinks ] = await render(url, manifest)
    const html = template.replace('<!--app-html-->', appHtml).replace('<!--app-preload-links-->', preloadLinks)
    // const [htmlStart, htmlEnd] = template.split('<!--app-html-->')

    res.status(200).set({ 'Content-Type': 'text/html' })

    // res.write(htmlStart)
    // for await (const chunk of stream) {
    //   if (res.closed) break
    //   res.write(chunk)
    // }
    // res.write(htmlEnd)
    res.end(html)
  } catch (e) {
    vite?.ssrFixStacktrace(e)
    console.log(e.stack)
    res.status(500).end(e.stack)
  }
})

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})

export async function createServer() {
  return app
}