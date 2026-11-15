import type { IconDefinition, IconNode } from './define.ts'
import { IconInputError } from './errors.ts'

export type DurationMs = number & { readonly __brand: 'DurationMs' }

export type Behavior = {
  readonly kind: 'stroke-draw'
  readonly durationMs: DurationMs
}

export const motionAttrOrder = ['pathLength', 'stroke-dasharray', 'stroke-dashoffset'] as const

export type MotionAttr = (typeof motionAttrOrder)[number]

export type MotionAttrs = Readonly<Partial<Record<MotionAttr, number>>>

export type AttrPatch = {
  readonly path: readonly number[]
  readonly attrs: MotionAttrs
}

export type Track = {
  readonly path: readonly number[]
  readonly attribute: 'stroke-dashoffset'
  readonly from: number
  readonly to: number
}

export type ResolvedBehavior = {
  readonly durationMs: DurationMs
  readonly undrawn: readonly AttrPatch[]
  readonly rest: readonly AttrPatch[]
  readonly tracks: readonly Track[]
}

const STROKE_UNIT = 1

const STROKE_DRAW_UNDRAWN: MotionAttrs = {
  pathLength: STROKE_UNIT,
  'stroke-dasharray': STROKE_UNIT,
  'stroke-dashoffset': STROKE_UNIT,
}

const STROKE_DRAW_REST: MotionAttrs = {
  pathLength: STROKE_UNIT,
  'stroke-dasharray': STROKE_UNIT,
  'stroke-dashoffset': 0,
}

export function durationMs(value: number): DurationMs {
  if (!Number.isFinite(value) || value <= 0) {
    throw new IconInputError('duration must be a finite number greater than 0', 'durationMs')
  }
  return value as DurationMs
}

export function resolveBehavior(behavior: Behavior, icon: IconDefinition): ResolvedBehavior {
  switch (behavior.kind) {
    case 'stroke-draw':
      return resolveStrokeDraw(behavior.durationMs, icon)
    default: {
      const unreachable: never = behavior.kind
      return unreachable
    }
  }
}

export function sampleTrack(track: Track, elapsedMs: number, duration: number): AttrPatch {
  switch (track.attribute) {
    case 'stroke-dashoffset': {
      const t = elapsedMs / duration
      const value = track.from + (track.to - track.from) * t
      return { path: track.path, attrs: { 'stroke-dashoffset': value } }
    }
    default: {
      const unreachable: never = track.attribute
      return unreachable
    }
  }
}

function resolveStrokeDraw(duration: DurationMs, icon: IconDefinition): ResolvedBehavior {
  const undrawn: AttrPatch[] = []
  const rest: AttrPatch[] = []
  const tracks: Track[] = []
  eachShape(icon.nodes, [], (node, path) => {
    if (node.attrs.stroke === 'none' || node.attrs['stroke-width'] === 0) return
    undrawn.push({ path, attrs: { ...STROKE_DRAW_UNDRAWN } })
    rest.push({ path, attrs: { ...STROKE_DRAW_REST } })
    tracks.push({ path, attribute: 'stroke-dashoffset', from: STROKE_UNIT, to: 0 })
  })
  if (undrawn.length === 0) {
    throw new IconInputError('stroke-draw needs a stroked shape', 'behavior')
  }
  return { durationMs: duration, undrawn, rest, tracks }
}

function eachShape(
  nodes: readonly IconNode[],
  prefix: readonly number[],
  visit: (node: Exclude<IconNode, { readonly name: 'g' }>, path: readonly number[]) => void,
): void {
  for (const [index, node] of nodes.entries()) {
    const path = [...prefix, index]
    switch (node.name) {
      case 'g':
        eachShape(node.children, path, visit)
        break
      case 'path':
      case 'circle':
      case 'rect':
      case 'line':
      case 'polyline':
      case 'polygon':
        visit(node, path)
        break
      default: {
        const unreachable: never = node
        throw new Error(`unexpected node ${JSON.stringify(unreachable)}`)
      }
    }
  }
}
