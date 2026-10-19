import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const dist = resolve(directory, '..', 'dist')
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg', '.png': 'image/png' }

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const candidate = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
  const safe = candidate === dist || candidate.startsWith(`${dist}${sep}`)
  const candidateStat = safe ? await stat(candidate).catch(() => null) : null
  const file = candidateStat?.isFile() ? candidate : resolve(dist, 'index.html')

  try {
    const content = await readFile(file)
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
    response.end(content)
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain' })
    response.end('Appen kunne ikke startes. Kør npm run build først.')
  }
})

server.listen(Number(process.env.PORT ?? 0), '127.0.0.1', () => {
  const address = server.address()
  if (typeof address === 'object' && address) console.log(`\nDet sker i Tistrup kører på http://127.0.0.1:${address.port}\n`)
})
