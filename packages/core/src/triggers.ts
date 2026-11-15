export type Trigger = { readonly kind: 'on-load' }

export type Clock = {
  readonly nowMs: number
  readonly mountedAtMs: number | null
}

export type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly elapsedMs: number }
  | { readonly kind: 'done' }

export function triggerPhase(trigger: Trigger, clock: Clock, duration: number): Phase {
  switch (trigger.kind) {
    case 'on-load': {
      if (clock.mountedAtMs === null) return { kind: 'idle' }
      const elapsed = clock.nowMs - clock.mountedAtMs
      if (elapsed < 0) return { kind: 'running', elapsedMs: 0 }
      if (elapsed < duration) return { kind: 'running', elapsedMs: elapsed }
      return { kind: 'done' }
    }
    default: {
      const unreachable: never = trigger.kind
      return unreachable
    }
  }
}
