import {
  accessibleName,
  compose,
  defineIcon,
  durationMs,
  type IconDefinition,
} from '@icon-sdk/core'

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
// @ts-expect-error an object literal is not an IconDefinition
const branded: IconDefinition = literal
void branded

// @ts-expect-error a behavior without a trigger does not compile
compose({
  icon,
  a11y: { purpose: 'decorative' },
  preference: 'full',
  behavior: { kind: 'stroke-draw', durationMs: durationMs(600) },
})

// @ts-expect-error a trigger without a behavior does not compile
compose({
  icon,
  a11y: { purpose: 'decorative' },
  preference: 'full',
  trigger: { kind: 'on-load' },
})

compose({
  icon,
  a11y: {
    purpose: 'decorative',
    // @ts-expect-error a decorative use cannot include a name
    name: accessibleName('Saved'),
  },
  preference: 'full',
})

// @ts-expect-error a meaningful name rejects a raw string
compose({ icon, a11y: { purpose: 'meaningful', name: 'Saved' }, preference: 'full' })

// @ts-expect-error a meaningful use requires a name
compose({ icon, a11y: { purpose: 'meaningful' }, preference: 'full' })
