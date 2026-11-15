import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { findComments } from './find-comments.ts'
import { collectCommentHits } from './walk.ts'

const commented = fileURLToPath(new URL('./fixtures/commented.ts', import.meta.url))
const clean = fileURLToPath(new URL('./fixtures/clean.ts', import.meta.url))
const root = fileURLToPath(new URL('../../', import.meta.url))

function runCli(entry: string) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/comment-check/cli.ts', entry],
    { cwd: root, encoding: 'utf8' },
  )
}

test('commented fixture reports the line comment and the block comment', () => {
  assert.deepEqual(collectCommentHits([commented]), [
    { path: commented, line: 1, column: 16, kind: 'line' },
    { path: commented, line: 2, column: 1, kind: 'block' },
  ])
})

test('clean fixture has no hits', () => {
  assert.deepEqual(collectCommentHits([clean]), [])
})

test('division keeps a following line comment', () => {
  assert.deepEqual(findComments('1 / 2 // real', 'js'), [{ line: 1, column: 7, kind: 'line' }])
})

test('a regexp body is not a comment', () => {
  assert.deepEqual(findComments('/https?:\\/\\//', 'js'), [])
})

test('a template interpolation does not hide a following line comment', () => {
  assert.deepEqual(findComments('`a$' + '{1}b` // real', 'js'), [
    { line: 1, column: 10, kind: 'line' },
  ])
})

test('a url in a template is not a comment', () => {
  assert.deepEqual(findComments('`http://example.com`', 'js'), [])
})

test('a shebang is not a comment', () => {
  assert.deepEqual(findComments('#!/usr/bin/env node\nconst a = 1\n', 'js'), [])
})

test('jsx text is not a comment and a jsx expression comment is', () => {
  assert.deepEqual(findComments('const el = <div>/* not */{/* yes */}</div>', 'jsx'), [
    { line: 1, column: 27, kind: 'block' },
  ])
})

test('the commented fixture fails the command', () => {
  const result = runCli(commented)
  assert.equal(result.status, 1)
  assert.equal(result.stdout, `${commented}:1:16: line\n${commented}:2:1: block\n`)
})

test('the clean fixture passes the command', () => {
  const result = runCli(clean)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
})
