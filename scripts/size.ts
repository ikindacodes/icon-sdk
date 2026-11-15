import { gzipSync } from 'node:zlib'
import esbuild from 'esbuild'

const result = await esbuild.build({
  entryPoints: ['packages/core/src/index.ts'],
  bundle: true,
  minify: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
})

const file = result.outputFiles[0]
if (!file) {
  throw new Error('size bundle was empty')
}

const minified = file.contents.byteLength
const gzip = gzipSync(file.contents).byteLength
console.log(`minified bytes: ${minified}`)
console.log(`gzip bytes: ${gzip}`)

if (gzip > 4096) {
  console.error(`gzip bytes ${gzip} exceed 4096`)
  process.exit(1)
}
