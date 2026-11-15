import type { IconUse } from './a11y.ts'
import { type PaintA11y, toPaintA11y } from './a11y.ts'
import {
  type AttrPatch,
  type Behavior,
  type DurationMs,
  motionAttrOrder,
  resolveBehavior,
  sampleTrack,
  type Track,
} from './behaviors.ts'
import { formatNumber, type IconDefinition, type IconNode } from './define.ts'
import { IconInputError } from './errors.ts'
import { type Clock, type Trigger, triggerPhase } from './triggers.ts'

export type MotionPreference = 'full' | 'reduce'

export type Motion =
  | { readonly kind: 'static' }
  | { readonly kind: 'reduced' }
  | { readonly kind: 'play'; readonly durationMs: DurationMs; readonly trigger: Trigger }

export type PaintNode = {
  readonly name: IconNode['name']
  readonly attrs: Readonly<Record<string, string>>
  readonly children: readonly PaintNode[]
}

export type PaintRoot = {
  readonly viewBox: string
  readonly focusable: 'false'
  readonly a11y: PaintA11y
  readonly nodes: readonly PaintNode[]
}

export type ComposedIcon = {
  readonly motion: Motion
  frameAt(clock: Clock): PaintRoot
}

type StillInput = {
  readonly icon: IconDefinition
  readonly a11y: IconUse
  readonly preference: MotionPreference
  readonly behavior?: undefined
  readonly trigger?: undefined
}

type AnimatedInput = {
  readonly icon: IconDefinition
  readonly a11y: IconUse
  readonly preference: MotionPreference
  readonly behavior: Behavior
  readonly trigger: Trigger
}

type Plan =
  | { readonly kind: 'static' }
  | { readonly kind: 'reduced'; readonly rest: readonly AttrPatch[] }
  | {
      readonly kind: 'play'
      readonly durationMs: DurationMs
      readonly trigger: Trigger
      readonly undrawn: readonly AttrPatch[]
      readonly rest: readonly AttrPatch[]
      readonly tracks: readonly Track[]
    }

type PlayMotion = {
  readonly kind: 'play'
  readonly durationMs: DurationMs
  readonly trigger: Trigger
}

export function compose(
  input: AnimatedInput & { readonly preference: 'full' },
): ComposedIcon & { readonly motion: PlayMotion }
export function compose(
  input: AnimatedInput & { readonly preference: 'reduce' },
): ComposedIcon & { readonly motion: { readonly kind: 'reduced' } }
export function compose(
  input: StillInput,
): ComposedIcon & { readonly motion: { readonly kind: 'static' } }
export function compose(input: AnimatedInput): ComposedIcon
export function compose(input: StillInput | AnimatedInput): ComposedIcon {
  const plan = planOf(input)
  const motion = toMotion(plan)
  const a11y = toPaintA11y(input.a11y)
  return {
    motion,
    frameAt(clock) {
      assertClock(clock)
      return paint(input.icon, patchesFor(plan, clock), a11y)
    },
  }
}

function planOf(input: StillInput | AnimatedInput): Plan {
  if (input.behavior === undefined || input.trigger === undefined) {
    return { kind: 'static' }
  }
  const resolved = resolveBehavior(input.behavior, input.icon)
  switch (input.preference) {
    case 'reduce':
      return { kind: 'reduced', rest: resolved.rest }
    case 'full':
      return {
        kind: 'play',
        durationMs: resolved.durationMs,
        trigger: input.trigger,
        undrawn: resolved.undrawn,
        rest: resolved.rest,
        tracks: resolved.tracks,
      }
    default: {
      const unreachable: never = input.preference
      return unreachable
    }
  }
}

function toMotion(plan: Plan): Motion {
  switch (plan.kind) {
    case 'static':
      return { kind: 'static' }
    case 'reduced':
      return { kind: 'reduced' }
    case 'play':
      return { kind: 'play', durationMs: plan.durationMs, trigger: plan.trigger }
    default: {
      const unreachable: never = plan
      return unreachable
    }
  }
}

function patchesFor(plan: Plan, clock: Clock): readonly AttrPatch[] {
  switch (plan.kind) {
    case 'static':
      return []
    case 'reduced':
      return plan.rest
    case 'play':
      return playPatches(plan, clock)
    default: {
      const unreachable: never = plan
      return unreachable
    }
  }
}

function playPatches(
  plan: Extract<Plan, { readonly kind: 'play' }>,
  clock: Clock,
): readonly AttrPatch[] {
  const phase = triggerPhase(plan.trigger, clock, plan.durationMs)
  switch (phase.kind) {
    case 'idle':
      return plan.undrawn
    case 'done':
      return plan.rest
    case 'running':
      return runningPatches(plan, phase.elapsedMs)
    default: {
      const unreachable: never = phase
      return unreachable
    }
  }
}

function runningPatches(
  plan: Extract<Plan, { readonly kind: 'play' }>,
  elapsedMs: number,
): readonly AttrPatch[] {
  const overlays = new Map(
    plan.tracks.map((track) => {
      const sample = sampleTrack(track, elapsedMs, plan.durationMs)
      return [sample.path.join('.'), sample] as const
    }),
  )
  return plan.undrawn.map((patch) => {
    const overlay = overlays.get(patch.path.join('.'))
    if (!overlay) return patch
    return { path: patch.path, attrs: { ...patch.attrs, ...overlay.attrs } }
  })
}

function assertClock(clock: Clock): void {
  if (!Number.isFinite(clock.nowMs)) {
    throw new IconInputError('nowMs must be finite', 'nowMs')
  }
  if (clock.mountedAtMs !== null && !Number.isFinite(clock.mountedAtMs)) {
    throw new IconInputError('mountedAtMs must be finite', 'mountedAtMs')
  }
}

function paint(icon: IconDefinition, patches: readonly AttrPatch[], a11y: PaintA11y): PaintRoot {
  const byPath = new Map(patches.map((patch) => [patch.path.join('.'), patch]))
  return {
    viewBox: [icon.viewBox.minX, icon.viewBox.minY, icon.viewBox.width, icon.viewBox.height]
      .map((value) => formatNumber(value))
      .join(' '),
    focusable: 'false',
    a11y,
    nodes: icon.nodes.map((node, index) => paintNode(node, [index], byPath)),
  }
}

function paintNode(
  node: IconNode,
  path: readonly number[],
  byPath: ReadonlyMap<string, AttrPatch>,
): PaintNode {
  const children =
    node.name === 'g'
      ? node.children.map((child, index) => paintNode(child, [...path, index], byPath))
      : []
  return {
    name: node.name,
    attrs: paintAttrs(node, byPath.get(path.join('.'))),
    children,
  }
}

function paintAttrs(
  node: IconNode,
  patch: AttrPatch | undefined,
): Readonly<Record<string, string>> {
  const attrs: Record<string, string> = {}
  for (const [key, value] of geometryEntries(node)) {
    attrs[key] = typeof value === 'number' ? formatNumber(value) : value
  }
  attrs.fill = node.attrs.fill
  attrs.stroke = node.attrs.stroke
  attrs['stroke-width'] = formatNumber(node.attrs['stroke-width'])
  attrs['stroke-linecap'] = node.attrs['stroke-linecap']
  attrs['stroke-linejoin'] = node.attrs['stroke-linejoin']
  if (patch) {
    for (const key of motionAttrOrder) {
      const value = patch.attrs[key]
      if (value !== undefined) attrs[key] = formatNumber(value)
    }
  }
  return attrs
}

function geometryEntries(node: IconNode): readonly (readonly [string, number | string])[] {
  switch (node.name) {
    case 'path':
      return [['d', node.attrs.d]]
    case 'circle':
      return [
        ['cx', node.attrs.cx],
        ['cy', node.attrs.cy],
        ['r', node.attrs.r],
      ]
    case 'rect': {
      const entries: [string, number | string][] = [
        ['x', node.attrs.x],
        ['y', node.attrs.y],
        ['width', node.attrs.width],
        ['height', node.attrs.height],
      ]
      if (node.attrs.rx !== undefined) entries.push(['rx', node.attrs.rx])
      if (node.attrs.ry !== undefined) entries.push(['ry', node.attrs.ry])
      return entries
    }
    case 'line':
      return [
        ['x1', node.attrs.x1],
        ['y1', node.attrs.y1],
        ['x2', node.attrs.x2],
        ['y2', node.attrs.y2],
      ]
    case 'polyline':
      return [['points', node.attrs.points]]
    case 'polygon':
      return [['points', node.attrs.points]]
    case 'g':
      return []
    default: {
      const unreachable: never = node
      return unreachable
    }
  }
}
