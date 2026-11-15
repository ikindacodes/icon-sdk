import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outdir = join(root, 'apps/proof/dist')

await mkdir(outdir, { recursive: true })
await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['apps/proof/src/main.ts'],
  outfile: 'apps/proof/dist/proof.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
})
await cp(join(root, 'apps/proof/index.html'), join(outdir, 'index.html'))
console.log(join(outdir, 'index.html'))
