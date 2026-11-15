import { collectCommentHits } from './walk.ts'

const entries = process.argv.slice(2)
const hits = collectCommentHits(entries.length === 0 ? [process.cwd()] : entries)
for (const hit of hits) {
  process.stdout.write(`${hit.path}:${hit.line}:${hit.column}: ${hit.kind}\n`)
}
if (hits.length > 0) process.exitCode = 1
