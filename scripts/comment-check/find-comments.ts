import { LanguageVariant, SyntaxKind } from 'typescript/unstable/ast'
import {
  createScanner,
  getShebang,
  tokenIsIdentifierOrKeyword,
  type Scanner,
} from 'typescript/unstable/ast/scanner'

export type SourceLanguage = 'js' | 'jsx'

export type CommentKind = 'line' | 'block'

export type CommentHit = {
  readonly line: number
  readonly column: number
  readonly kind: CommentKind
}

type Slot = 'expr' | 'done'

type Opener =
  | { tag: 'paren'; role: 'header' | 'group' }
  | { tag: 'brace'; role: 'block' | 'object' }
  | { tag: 'bracket' }
  | { tag: 'template' }
  | { tag: 'type-args'; depth: number }

type Region =
  | { tag: 'code'; slot: Slot; pendingHeader: boolean; openers: Opener[] }
  | { tag: 'jsx-text' }
  | { tag: 'jsx-tag'; sawSlash: boolean; closing: boolean }

type CodeRegion = Extract<Region, { tag: 'code' }>
type JsxTagRegion = Extract<Region, { tag: 'jsx-tag' }>

type CursorState = {
  regions: Region[]
  jsx: boolean
}

type TokenKind = ReturnType<Scanner['scan']>

type Lexeme =
  | { tag: 'comment'; start: number; kind: CommentKind }
  | { tag: 'atom' }
  | { tag: 'end' }

type Cursor = {
  pull(): Lexeme
}

export function findComments(text: string, language: SourceLanguage): readonly CommentHit[] {
  const cursor = openCursor(text, language)
  const hits: CommentHit[] = []
  for (;;) {
    const lexeme = cursor.pull()
    switch (lexeme.tag) {
      case 'end':
        return hits
      case 'comment':
        hits.push(hitAt(text, lexeme.start, lexeme.kind))
        break
      case 'atom':
        break
      default: {
        const unreachable: never = lexeme
        return unreachable
      }
    }
  }
}

function openCursor(text: string, language: SourceLanguage): Cursor {
  const shebang = getShebang(text)
  const scanner = createScanner(false, variantFor(language), text, shebang?.length ?? 0)
  const state: CursorState = {
    regions: [{ tag: 'code', slot: 'expr', pendingHeader: false, openers: [] }],
    jsx: language === 'jsx',
  }
  return {
    pull: () => nextLexeme(state, scanner),
  }
}

function variantFor(language: SourceLanguage) {
  switch (language) {
    case 'js':
      return LanguageVariant.Standard
    case 'jsx':
      return LanguageVariant.JSX
    default: {
      const unreachable: never = language
      return unreachable
    }
  }
}

function nextLexeme(state: CursorState, scanner: Scanner): Lexeme {
  const region = state.regions.at(-1)
  if (!region) return { tag: 'end' }
  const kind = pullKind(region, scanner)
  if (kind === SyntaxKind.EndOfFile) return { tag: 'end' }
  if (region.tag === 'code') {
    const comment = commentKind(kind)
    if (comment) return { tag: 'comment', start: scanner.getTokenStart(), kind: comment }
  }
  settle(state, kind, scanner)
  return { tag: 'atom' }
}

function pullKind(region: Region, scanner: Scanner): TokenKind {
  switch (region.tag) {
    case 'code':
    case 'jsx-tag':
      return scanner.scan()
    case 'jsx-text':
      return scanner.scanJsxToken()
    default: {
      const unreachable: never = region
      return unreachable
    }
  }
}

function commentKind(kind: TokenKind): CommentKind | undefined {
  if (kind === SyntaxKind.SingleLineCommentTrivia) return 'line'
  if (kind === SyntaxKind.MultiLineCommentTrivia) return 'block'
  return undefined
}

function settle(state: CursorState, kind: TokenKind, scanner: Scanner): void {
  if (isTrivia(kind)) return
  const region = state.regions.at(-1)
  if (!region) return
  switch (region.tag) {
    case 'code':
      settleCode(state, region, kind, scanner)
      return
    case 'jsx-tag':
      settleJsxTag(state, region, kind)
      return
    case 'jsx-text':
      settleJsxText(state, kind)
      return
    default: {
      const unreachable: never = region
      return unreachable
    }
  }
}

function settleCode(
  state: CursorState,
  region: CodeRegion,
  kind: TokenKind,
  scanner: Scanner,
): void {
  if (kind === SyntaxKind.SlashToken || kind === SyntaxKind.SlashEqualsToken) {
    settleSlash(region, kind, scanner)
    return
  }
  if (kind === SyntaxKind.OpenParenToken) {
    region.openers.push({ tag: 'paren', role: region.pendingHeader ? 'header' : 'group' })
    finish(region, 'expr')
    return
  }
  if (kind === SyntaxKind.CloseParenToken) {
    const top = region.openers.at(-1)
    if (top?.tag === 'paren') region.openers.pop()
    finish(region, top?.tag === 'paren' && top.role === 'header' ? 'expr' : 'done')
    return
  }
  if (kind === SyntaxKind.OpenBracketToken) {
    region.openers.push({ tag: 'bracket' })
    finish(region, 'expr')
    return
  }
  if (kind === SyntaxKind.CloseBracketToken) {
    const top = region.openers.at(-1)
    if (top?.tag === 'bracket') region.openers.pop()
    finish(region, 'done')
    return
  }
  if (kind === SyntaxKind.OpenBraceToken) {
    region.openers.push({ tag: 'brace', role: braceRole(region.slot) })
    finish(region, 'expr')
    return
  }
  if (kind === SyntaxKind.CloseBraceToken) {
    settleCloseBrace(state, region, scanner)
    return
  }
  if (kind === SyntaxKind.TemplateHead) {
    region.openers.push({ tag: 'template' })
    finish(region, 'expr')
    return
  }
  if (kind === SyntaxKind.LessThanSlashToken) {
    region.pendingHeader = false
    state.regions.push({ tag: 'jsx-tag', sawSlash: false, closing: true })
    return
  }
  if (kind === SyntaxKind.LessThanToken) {
    settleLessThan(state, region, scanner)
    return
  }
  if (kind === SyntaxKind.GreaterThanToken && closeTypeArgs(region)) return
  if (isHeaderKeyword(kind)) {
    region.pendingHeader = true
    region.slot = 'expr'
    return
  }
  finish(region, slotAfter(region.slot, kind))
}

function settleSlash(region: CodeRegion, kind: TokenKind, scanner: Scanner): void {
  if (region.slot === 'expr') {
    scanner.reScanSlashToken()
    finish(region, 'done')
    return
  }
  finish(region, slotAfter(region.slot, kind))
}

function settleLessThan(state: CursorState, region: CodeRegion, scanner: Scanner): void {
  const top = region.openers.at(-1)
  if (top?.tag === 'type-args') {
    top.depth += 1
    finish(region, 'expr')
    return
  }
  if (region.slot === 'done') {
    finish(region, 'expr')
    return
  }
  region.pendingHeader = false
  if (state.jsx && angleOpensJsx(scanner)) {
    const closing = scanner.lookAhead(() => nextSignificant(scanner) === SyntaxKind.SlashToken)
    state.regions.push({ tag: 'jsx-tag', sawSlash: false, closing })
    return
  }
  region.openers.push({ tag: 'type-args', depth: 0 })
  region.slot = 'expr'
}

function closeTypeArgs(region: CodeRegion): boolean {
  const top = region.openers.at(-1)
  if (top?.tag !== 'type-args') return false
  if (top.depth === 0) region.openers.pop()
  else top.depth -= 1
  finish(region, 'expr')
  return true
}

function settleCloseBrace(state: CursorState, region: CodeRegion, scanner: Scanner): void {
  const top = region.openers.at(-1)
  if (top?.tag === 'template') {
    const resumed = scanner.reScanTemplateToken(false)
    if (resumed === SyntaxKind.TemplateTail) {
      region.openers.pop()
      finish(region, 'done')
      return
    }
    finish(region, 'expr')
    return
  }
  if (top?.tag === 'brace') {
    region.openers.pop()
    finish(region, top.role === 'object' ? 'done' : 'expr')
    return
  }
  region.pendingHeader = false
  if (region.openers.length === 0 && state.regions.length > 1) state.regions.pop()
}

function settleJsxTag(state: CursorState, region: JsxTagRegion, kind: TokenKind): void {
  if (kind === SyntaxKind.SlashToken) {
    region.sawSlash = true
    return
  }
  if (kind === SyntaxKind.OpenBraceToken) {
    pushExpression(state)
    return
  }
  if (kind === SyntaxKind.GreaterThanToken) finishJsxTag(state, region)
}

function finishJsxTag(state: CursorState, tag: JsxTagRegion): void {
  const ends = tag.closing || tag.sawSlash
  state.regions.pop()
  if (!ends) {
    state.regions.push({ tag: 'jsx-text' })
    return
  }
  if (tag.closing) {
    const parent = state.regions.at(-1)
    if (parent?.tag === 'jsx-text') state.regions.pop()
  }
  const code = state.regions.at(-1)
  if (code?.tag === 'code') code.slot = 'done'
}

function settleJsxText(state: CursorState, kind: TokenKind): void {
  if (kind === SyntaxKind.OpenBraceToken) {
    pushExpression(state)
    return
  }
  if (kind === SyntaxKind.LessThanToken) {
    state.regions.push({ tag: 'jsx-tag', sawSlash: false, closing: false })
    return
  }
  if (kind === SyntaxKind.LessThanSlashToken) {
    state.regions.push({ tag: 'jsx-tag', sawSlash: false, closing: true })
  }
}

function pushExpression(state: CursorState): void {
  state.regions.push({ tag: 'code', slot: 'expr', pendingHeader: false, openers: [] })
}

function finish(region: CodeRegion, slot: Slot): void {
  region.pendingHeader = false
  region.slot = slot
}

function braceRole(slot: Slot): 'block' | 'object' {
  switch (slot) {
    case 'expr':
      return 'object'
    case 'done':
      return 'block'
    default: {
      const unreachable: never = slot
      return unreachable
    }
  }
}

function slotAfter(slot: Slot, kind: TokenKind): Slot {
  if (completesExpression(kind)) return 'done'
  if (
    kind === SyntaxKind.PlusPlusToken ||
    kind === SyntaxKind.MinusMinusToken ||
    kind === SyntaxKind.ExclamationToken
  ) {
    return slot
  }
  return 'expr'
}

function completesExpression(kind: TokenKind): boolean {
  switch (kind) {
    case SyntaxKind.Identifier:
    case SyntaxKind.PrivateIdentifier:
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.BigIntLiteral:
    case SyntaxKind.StringLiteral:
    case SyntaxKind.RegularExpressionLiteral:
    case SyntaxKind.NoSubstitutionTemplateLiteral:
    case SyntaxKind.ThisKeyword:
    case SyntaxKind.SuperKeyword:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.NullKeyword:
    case SyntaxKind.UndefinedKeyword:
      return true
    default:
      return false
  }
}

function isHeaderKeyword(kind: TokenKind): boolean {
  switch (kind) {
    case SyntaxKind.IfKeyword:
    case SyntaxKind.ForKeyword:
    case SyntaxKind.WhileKeyword:
    case SyntaxKind.SwitchKeyword:
    case SyntaxKind.WithKeyword:
    case SyntaxKind.CatchKeyword:
      return true
    default:
      return false
  }
}

function isTrivia(kind: TokenKind): boolean {
  switch (kind) {
    case SyntaxKind.WhitespaceTrivia:
    case SyntaxKind.NewLineTrivia:
    case SyntaxKind.ConflictMarkerTrivia:
    case SyntaxKind.NonTextFileMarkerTrivia:
    case SyntaxKind.Unknown:
    case SyntaxKind.SingleLineCommentTrivia:
    case SyntaxKind.MultiLineCommentTrivia:
      return true
    default:
      return false
  }
}

function angleOpensJsx(scanner: Scanner): boolean {
  return scanner.lookAhead(() => {
    const kind = nextSignificant(scanner)
    if (kind === SyntaxKind.SlashToken || kind === SyntaxKind.GreaterThanToken) return true
    if (!tokenIsIdentifierOrKeyword(kind)) return false
    return !genericArrowFollows(scanner)
  })
}

function genericArrowFollows(scanner: Scanner): boolean {
  let kind = typeParameterTail(scanner)
  while (kind === SyntaxKind.CommaToken) {
    const next = nextSignificant(scanner)
    if (next === SyntaxKind.GreaterThanToken) {
      kind = next
      break
    }
    if (!tokenIsIdentifierOrKeyword(next)) return false
    kind = typeParameterTail(scanner)
  }
  if (kind !== SyntaxKind.GreaterThanToken) return false
  return nextSignificant(scanner) === SyntaxKind.OpenParenToken
}

function typeParameterTail(scanner: Scanner): TokenKind {
  const kind = nextSignificant(scanner)
  if (kind === SyntaxKind.ExtendsKeyword || kind === SyntaxKind.EqualsToken) {
    return skipType(scanner)
  }
  return kind
}

function skipType(scanner: Scanner): TokenKind {
  let angles = 0
  let parens = 0
  let braces = 0
  let brackets = 0
  for (;;) {
    const kind = nextSignificant(scanner)
    if (kind === SyntaxKind.EndOfFile) return kind
    const flat = angles === 0 && parens === 0 && braces === 0 && brackets === 0
    if (flat && (kind === SyntaxKind.GreaterThanToken || kind === SyntaxKind.CommaToken)) {
      return kind
    }
    if (kind === SyntaxKind.LessThanToken) angles += 1
    else if (kind === SyntaxKind.GreaterThanToken && angles > 0) angles -= 1
    else if (kind === SyntaxKind.OpenParenToken) parens += 1
    else if (kind === SyntaxKind.CloseParenToken && parens > 0) parens -= 1
    else if (kind === SyntaxKind.OpenBraceToken) braces += 1
    else if (kind === SyntaxKind.CloseBraceToken && braces > 0) braces -= 1
    else if (kind === SyntaxKind.OpenBracketToken) brackets += 1
    else if (kind === SyntaxKind.CloseBracketToken && brackets > 0) brackets -= 1
  }
}

function nextSignificant(scanner: Scanner): TokenKind {
  for (;;) {
    const kind = scanner.scan()
    if (kind === SyntaxKind.EndOfFile || !isTrivia(kind)) return kind
  }
}

function hitAt(text: string, start: number, kind: CommentKind): CommentHit {
  let line = 1
  let lineStart = 0
  for (let i = 0; i < start; i += 1) {
    const code = text.charCodeAt(i)
    if (code !== 10 && code !== 13) continue
    if (code === 13 && text.charCodeAt(i + 1) === 10) continue
    line += 1
    lineStart = i + 1
  }
  return { line, column: start - lineStart + 1, kind }
}
