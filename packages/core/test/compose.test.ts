import assert from 'node:assert/strict'
import { test } from 'node:test'
import { accessibleName, compose, defineIcon, durationMs, IconInputError } from '@icon-sdk/core'

const viewBox = { minX: 0, minY: 0, width: 24, height: 24 }
const checkPath = 'M5 12l5 5L20 7'

function checkIcon() {
  return defineIcon({
    viewBox,
    nodes: [{ name: 'path', attrs: { d: checkPath } }],
  })
}

function strokeDraw(preference: 'full' | 'reduce', icon = checkIcon()) {
  return compose({
    icon,
    a11y: { purpose: 'meaningful', name: accessibleName('Saved') },
    preference,
    behavior: { kind: 'stroke-draw', durationMs: durationMs(600) },
    trigger: { kind: 'on-load' },
  })
}

test('static meaningful frame paints the check and ignores the clock', () => {
  const icon = checkIcon()
  const before = structuredClone(icon)
  const still = compose({
    icon,
    a11y: { purpose: 'meaningful', name: accessibleName('Saved') },
    preference: 'full',
  })
  const frame = still.frameAt({ nowMs: 0, mountedAtMs: null })
  const later = still.frameAt({ nowMs: 900, mountedAtMs: 20 })

  assert.deepEqual(still.motion, { kind: 'static' })
  assert.deepEqual(frame, later)
  assert.equal(frame.viewBox, '0 0 24 24')
  assert.equal(frame.focusable, 'false')
  assert.deepEqual(frame.a11y, { purpose: 'meaningful', role: 'img', ariaLabel: 'Saved' })
  assert.deepEqual(frame.nodes[0], {
    name: 'path',
    attrs: {
      d: checkPath,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    children: [],
  })
  assert.deepEqual(icon, before)
})

test('a still decorative icon stays static when the preference is reduce', () => {
  const icon = checkIcon()
  const before = structuredClone(icon)
  const meaningful = compose({
    icon,
    a11y: { purpose: 'meaningful', name: accessibleName('Saved') },
    preference: 'full',
  })
  meaningful.frameAt({ nowMs: 0, mountedAtMs: null })
  const hidden = compose({
    icon,
    a11y: { purpose: 'decorative' },
    preference: 'reduce',
  })
  const frame = hidden.frameAt({ nowMs: 0, mountedAtMs: null })

  assert.deepEqual(hidden.motion, { kind: 'static' })
  assert.deepEqual(frame.a11y, { purpose: 'decorative', ariaHidden: 'true' })
  assert.equal(frame.nodes[0]?.attrs.pathLength, undefined)
  assert.deepEqual(icon, before)
})

test('names, durations, and geometry reject bad input', () => {
  assert.equal(accessibleName('  Saved  '), 'Saved')
  assert.throws(() => accessibleName('   '), IconInputError)
  assert.throws(() => accessibleName(''), IconInputError)
  assert.throws(() => durationMs(0), IconInputError)
  assert.throws(() => durationMs(-5), IconInputError)
  assert.throws(() => durationMs(Number.POSITIVE_INFINITY), IconInputError)
  assert.throws(
    () =>
      defineIcon({
        viewBox: { minX: 0, minY: 0, width: 0, height: 24 },
        nodes: [{ name: 'path', attrs: { d: checkPath } }],
      }),
    IconInputError,
  )
  assert.throws(
    () => defineIcon({ viewBox, nodes: [{ name: 'path', attrs: { d: '' } }] }),
    IconInputError,
  )
  assert.throws(
    () =>
      defineIcon({
        viewBox: { minX: Number.NaN, minY: 0, width: 24, height: 24 },
        nodes: [{ name: 'path', attrs: { d: checkPath } }],
      }),
    IconInputError,
  )
  assert.throws(
    () => defineIcon({ viewBox, nodes: [{ name: 'circle', attrs: { cx: 0, cy: 0, r: 0 } }] }),
    IconInputError,
  )
  assert.throws(
    () =>
      defineIcon({
        viewBox,
        nodes: [{ name: 'rect', attrs: { x: 0, y: 0, width: -1, height: 1 } }],
      }),
    IconInputError,
  )
  assert.throws(
    () =>
      defineIcon({
        viewBox,
        nodes: [{ name: 'rect', attrs: { x: 0, y: 0, width: 1, height: 1, ry: -2 } }],
      }),
    IconInputError,
  )
  assert.throws(
    () =>
      defineIcon({
        viewBox,
        nodes: [{ name: 'line', attrs: { x1: Number.NaN, y1: 0, x2: 1, y2: 1 } }],
      }),
    IconInputError,
  )
  assert.throws(
    () =>
      defineIcon({
        viewBox,
        nodes: [{ name: 'path', attrs: { d: checkPath, 'stroke-width': -1 } }],
      }),
    IconInputError,
  )
  assert.throws(
    () => defineIcon({ viewBox, nodes: [{ name: 'polyline', attrs: { points: '' } }] }),
    IconInputError,
  )
  assert.throws(
    () => defineIcon({ viewBox, nodes: [{ name: 'polygon', attrs: { points: '' } }] }),
    IconInputError,
  )
  assert.throws(
    () =>
      defineIcon({
        viewBox,
        nodes: [{ name: 'path', attrs: { d: checkPath, 'stroke-width': Number.NaN } }],
      }),
    IconInputError,
  )
})

test('stroke-draw plays from the undrawn frame to the rest frame', () => {
  const icon = strokeDraw('full')
  assert.deepEqual(icon.motion, {
    kind: 'play',
    durationMs: 600,
    trigger: { kind: 'on-load' },
  })

  const start = icon.frameAt({ nowMs: 0, mountedAtMs: 0 })
  assert.equal(start.nodes[0]?.attrs.pathLength, '1')
  assert.equal(start.nodes[0]?.attrs['stroke-dasharray'], '1')
  assert.equal(start.nodes[0]?.attrs['stroke-dashoffset'], '1')
  assert.deepEqual(Object.keys(start.nodes[0]?.attrs ?? {}), [
    'd',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'pathLength',
    'stroke-dasharray',
    'stroke-dashoffset',
  ])

  assert.equal(
    icon.frameAt({ nowMs: 300, mountedAtMs: 0 }).nodes[0]?.attrs['stroke-dashoffset'],
    '0.5',
  )
  assert.equal(
    icon.frameAt({ nowMs: 600, mountedAtMs: 0 }).nodes[0]?.attrs['stroke-dashoffset'],
    '0',
  )
  assert.equal(
    icon.frameAt({ nowMs: 300, mountedAtMs: null }).nodes[0]?.attrs['stroke-dashoffset'],
    '1',
  )
  assert.equal(
    icon.frameAt({ nowMs: -10, mountedAtMs: 0 }).nodes[0]?.attrs['stroke-dashoffset'],
    '1',
  )
})

test('reduced stroke-draw paints the rest frame for every clock', () => {
  const icon = strokeDraw('reduce')
  assert.deepEqual(icon.motion, { kind: 'reduced' })
  assert.equal(icon.frameAt({ nowMs: 0, mountedAtMs: 0 }).nodes[0]?.attrs['stroke-dashoffset'], '0')
  assert.equal(
    icon.frameAt({ nowMs: 0, mountedAtMs: null }).nodes[0]?.attrs['stroke-dashoffset'],
    '0',
  )
})

test('stroke-draw rejects an icon with nothing to stroke', () => {
  const none = defineIcon({
    viewBox,
    nodes: [{ name: 'path', attrs: { d: checkPath, stroke: 'none' } }],
  })
  const zeroWidth = defineIcon({
    viewBox,
    nodes: [{ name: 'path', attrs: { d: checkPath, 'stroke-width': 0 } }],
  })
  assert.throws(() => strokeDraw('full', none), IconInputError)
  assert.throws(() => strokeDraw('reduce', zeroWidth), IconInputError)
})

test('the same compose input yields the same motion and frame', () => {
  const icon = checkIcon()
  const input = {
    icon,
    a11y: { purpose: 'meaningful' as const, name: accessibleName('Saved') },
    preference: 'full' as const,
    behavior: { kind: 'stroke-draw' as const, durationMs: durationMs(600) },
    trigger: { kind: 'on-load' as const },
  }
  const left = compose(input)
  const right = compose(input)
  const clock = { nowMs: 300, mountedAtMs: 0 }
  assert.deepEqual(left.motion, right.motion)
  assert.deepEqual(left.frameAt(clock), right.frameAt(clock))
})

test('a group stroke does not flow into children', () => {
  const icon = defineIcon({
    viewBox,
    nodes: [
      {
        name: 'g',
        attrs: { stroke: '#f00', fill: '#fff' },
        children: [
          { name: 'path', attrs: { d: 'M0 0L1 1', stroke: 'none' } },
          { name: 'circle', attrs: { cx: 1.25, cy: 2, r: 1.5 } },
        ],
      },
    ],
  })
  const frame = strokeDraw('full', icon).frameAt({ nowMs: 0, mountedAtMs: 0 })
  const group = frame.nodes[0]
  if (!group) assert.fail('missing group')
  assert.equal(group.attrs.stroke, '#f00')
  assert.equal(group.attrs.fill, '#fff')
  assert.equal(group.attrs.pathLength, undefined)
  assert.equal(group.children[0]?.attrs.stroke, 'none')
  assert.equal(group.children[0]?.attrs.pathLength, undefined)
  assert.equal(group.children[1]?.attrs.stroke, 'currentColor')
  assert.equal(group.children[1]?.attrs.cx, '1.25')
  assert.equal(group.children[1]?.attrs.cy, '2')
  assert.equal(group.children[1]?.attrs.r, '1.5')
  assert.equal(group.children[1]?.attrs['stroke-dashoffset'], '1')
})

test('author presentation wins and -0 formats as 0', () => {
  const icon = defineIcon({
    viewBox: { minX: -0, minY: 0, width: 24, height: 24 },
    nodes: [
      {
        name: 'rect',
        attrs: {
          x: 1,
          y: 2,
          width: 10.5,
          height: 4,
          rx: 0,
          fill: '#000',
          'stroke-width': 1.5,
          'stroke-linecap': 'butt',
        },
      },
    ],
  })
  const frame = compose({
    icon,
    a11y: { purpose: 'decorative' },
    preference: 'full',
  }).frameAt({ nowMs: 0, mountedAtMs: null })
  assert.equal(frame.viewBox, '0 0 24 24')
  assert.deepEqual(frame.nodes[0]?.attrs, {
    x: '1',
    y: '2',
    width: '10.5',
    height: '4',
    rx: '0',
    fill: '#000',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'butt',
    'stroke-linejoin': 'round',
  })
})

test('frameAt rejects a non-finite clock', () => {
  const icon = compose({
    icon: checkIcon(),
    a11y: { purpose: 'decorative' },
    preference: 'full',
  })
  assert.throws(() => icon.frameAt({ nowMs: Number.NaN, mountedAtMs: null }), IconInputError)
  assert.throws(
    () => icon.frameAt({ nowMs: 0, mountedAtMs: Number.POSITIVE_INFINITY }),
    IconInputError,
  )
})
