import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = path.resolve(__dirname, 'dist/client')
const SERVER_ENTRY = path.resolve(__dirname, 'dist/server/server.js')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
}

async function main() {
  if (!fs.existsSync(SERVER_ENTRY)) {
    console.error(`Build output not found at ${SERVER_ENTRY}. Run "pnpm run build" first.`)
    process.exit(1)
  }

  const serverModule = await import(SERVER_ENTRY)
  const handler = serverModule.default.fetch

  const server = http.createServer(async (req, res) => {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'http'
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
      const url = new URL(req.url, `${protocol}://${host}`)

      // Static assets serving from dist/client
      if (req.method === 'GET' || req.method === 'HEAD') {
        const decodedPath = decodeURIComponent(url.pathname)
        const filePath = path.normalize(path.join(CLIENT_DIR, decodedPath))

        if (filePath.startsWith(CLIENT_DIR) && fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath)
          if (stat.isFile()) {
            const ext = path.extname(filePath).toLowerCase()
            res.statusCode = 200
            res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
            res.setHeader('Content-Length', stat.size)

            if (decodedPath.startsWith('/assets/')) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
            } else {
              res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            if (req.method === 'HEAD') {
              return res.end()
            }
            return fs.createReadStream(filePath).pipe(res)
          }
        }
      }

      // Forward to TanStack Start SSR handler
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v)
        } else {
          headers.set(key, value)
        }
      }

      const init = {
        method: req.method,
        headers,
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = Readable.toWeb(req)
        init.duplex = 'half'
      }

      const webRequest = new Request(url, init)
      const webResponse = await handler(webRequest)

      res.statusCode = webResponse.status
      for (const [key, value] of webResponse.headers.entries()) {
        res.setHeader(key, value)
      }

      if (webResponse.body) {
        Readable.fromWeb(webResponse.body).pipe(res)
      } else {
        res.end()
      }
    } catch (err) {
      console.error('Unhandled request error:', err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    }
  })

  const port = Number.parseInt(process.env.PORT || '3000', 10)
  const host = process.env.HOST || '0.0.0.0'

  server.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`)
  })

  const shutdown = () => {
    console.log('Shutting down server...')
    server.close(() => {
      process.exit(0)
    })
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
