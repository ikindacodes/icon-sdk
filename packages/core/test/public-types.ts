import {
  type AccessibleName,
  accessibleName,
  compose,
  defineIcon,
  durationMs,
  type IconDefinition,
  type IconUse,
} from '@icon-sdk/core'

function expectTrue<T extends true>(value: T): T {
  return value
}

type NotAssignable<A, B> = [A] extends [B] ? false : true

type HasExtraKey<Value, Shape> = Exclude<keyof Value, keyof Shape> extends never ? false : true

type ComposeInput = Parameters<typeof compose>[0]

type MeaningfulUse = Extract<IconUse, { readonly purpose: 'meaningful' }>

type DecorativeUse = Extract<IconUse, { readonly purpose: 'decorative' }>

const icon = defineIcon({
  viewBox: { minX: 0, minY: 0, width: 24, height: 24 },
  nodes: [{ name: 'path', attrs: { d: 'M5 12l5 5L20 7' } }],
})

const still = compose({
  icon,
  a11y: { purpose: 'meaningful', name: accessibleName('Saved') },
  preference: 'reduce',
})
still.frameAt({ nowMs: 0, mountedAtMs: null })

const played = compose({
  icon,
  a11y: { purpose: 'meaningful', name: accessibleName('Saved') },
  preference: 'full',
  behavior: { kind: 'stroke-draw', durationMs: durationMs(600) },
  trigger: { kind: 'on-load' },
})
played.frameAt({ nowMs: 300, mountedAtMs: 0 })

declare const preference: 'full' | 'reduce'
compose({
  icon,
  a11y: { purpose: 'decorative' },
  preference,
  behavior: { kind: 'stroke-draw', durationMs: durationMs(600) },
  trigger: { kind: 'on-load' },
})

const literal = { viewBox: icon.viewBox, nodes: icon.nodes }
expectTrue<NotAssignable<typeof literal, IconDefinition>>(true)

const behaviorOnly = {
  icon,
  a11y: { purpose: 'decorative' as const },
  preference: 'full' as const,
  behavior: { kind: 'stroke-draw' as const, durationMs: durationMs(600) },
}
expectTrue<NotAssignable<typeof behaviorOnly, ComposeInput>>(true)

const triggerOnly = {
  icon,
  a11y: { purpose: 'decorative' as const },
  preference: 'full' as const,
  trigger: { kind: 'on-load' as const },
}
expectTrue<NotAssignable<typeof triggerOnly, ComposeInput>>(true)

expectTrue<
  HasExtraKey<{ readonly purpose: 'decorative'; readonly name: AccessibleName }, DecorativeUse>
>(true)

expectTrue<NotAssignable<{ readonly purpose: 'meaningful'; readonly name: string }, MeaningfulUse>>(
  true,
)

expectTrue<NotAssignable<{ readonly purpose: 'meaningful' }, MeaningfulUse>>(true)
