# icon-sdk

`@icon-sdk/core` builds a `PaintRoot` from an icon definition. You sample that tree with `frameAt` and a clock you own.

## Compose a check

```ts
import { accessibleName, compose, defineIcon, durationMs } from '@icon-sdk/core'

const check = defineIcon({
  viewBox: { minX: 0, minY: 0, width: 24, height: 24 },
  nodes: [{ name: 'path', attrs: { d: 'M5 12l5 5L20 7' } }],
})

const still = compose({
  icon: check,
  a11y: { purpose: 'meaningful', name: accessibleName('Saved') },
  preference: 'full',
})

const hidden = compose({
  icon: check,
  a11y: { purpose: 'decorative' },
  preference: 'reduce',
})

const drawn = compose({
  icon: check,
  a11y: { purpose: 'meaningful', name: accessibleName('Saved') },
  preference: 'full',
  behavior: { kind: 'stroke-draw', durationMs: durationMs(600) },
  trigger: { kind: 'on-load' },
})

const reduced = compose({
  icon: check,
  a11y: { purpose: 'meaningful', name: accessibleName('Saved') },
  preference: 'reduce',
  behavior: { kind: 'stroke-draw', durationMs: durationMs(600) },
  trigger: { kind: 'on-load' },
})

still.frameAt({ nowMs: 0, mountedAtMs: null })
drawn.frameAt({ nowMs: 300, mountedAtMs: 0 })
reduced.frameAt({ nowMs: 0, mountedAtMs: 0 })
```

`still.motion.kind` is `static`. `hidden.motion.kind` is `static` too. A still icon ignores the preference and ignores the clock. `drawn.motion.kind` is `play`. `reduced.motion.kind` is `reduced`.

Module boundaries are in `docs/architecture.md`.
