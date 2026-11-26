import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const output = resolve(root, 'outputs', 'sentinel-dashboard-preview.html')
const source = readFileSync(resolve(dist, 'index.html'), 'utf8')

const cssMatch = source.match(/<link[^>]+href="\.\/assets\/([^"?]+\.css)"[^>]*>/)
const jsMatch = source.match(/<script[^>]+src="\.\/assets\/([^"?]+\.js)"[^>]*><\/script>/)

if (!cssMatch || !jsMatch) {
  throw new Error('Could not locate the Vite CSS and JavaScript bundles.')
}

const css = readFileSync(resolve(dist, 'assets', cssMatch[1]), 'utf8').replace(/<\/style/gi, '<\\/style')
const javascript = readFileSync(resolve(dist, 'assets', jsMatch[1]), 'utf8').replace(/<\/script/gi, '<\\/script')
const standalone = source
  .replace(cssMatch[0], () => `<style>${css}</style>`)
  .replace(jsMatch[0], () => `<script type="module">${javascript}</script>`)

mkdirSync(resolve(root, 'outputs'), { recursive: true })
writeFileSync(output, standalone)
console.log(`Created ${output}`)
