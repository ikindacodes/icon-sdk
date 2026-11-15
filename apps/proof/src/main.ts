import {
  accessibleName,
  compose,
  defineIcon,
  durationMs,
  type MotionPreference,
  type PaintA11y,
  type PaintNode,
  type PaintRoot,
} from '@icon-sdk/core'

const SVG_NS = 'http://www.w3.org/2000/svg'
const CHECK_PATH = 'M5 12l5 5L20 7'
const LIVE_DURATION_MS = 1200

const check = defineIcon({
  viewBox: { minX: 0, minY: 0, width: 24, height: 24 },
  nodes: [{ name: 'path', attrs: { d: CHECK_PATH } }],
})

const saved = accessibleName('Saved')

type Panel = {
  readonly slot: HTMLElement
  readonly label: HTMLElement
}

function panel(id: string): Panel {
  const section = document.getElementById(id)
  const slot = section?.querySelector('[data-mount]')
  const label = section?.querySelector('[data-label]')
  if (!(slot instanceof HTMLElement) || !(label instanceof HTMLElement)) {
    throw new Error(`missing panel ${id}`)
  }
  return { slot, label }
}

function renderNode(node: PaintNode): SVGElement {
  const element = document.createElementNS(SVG_NS, node.name)
  for (const [key, value] of Object.entries(node.attrs)) {
    element.setAttribute(key, value)
  }
  for (const child of node.children) element.append(renderNode(child))
  return element
}

function applyA11y(svg: SVGSVGElement, a11y: PaintA11y): void {
  switch (a11y.purpose) {
    case 'decorative':
      svg.setAttribute('aria-hidden', a11y.ariaHidden)
      svg.removeAttribute('role')
      svg.removeAttribute('aria-label')
      return
    case 'meaningful':
      svg.setAttribute('role', a11y.role)
      svg.setAttribute('aria-label', a11y.ariaLabel)
      svg.removeAttribute('aria-hidden')
      return
    default: {
      const unreachable: never = a11y
      throw new Error(`unexpected a11y ${JSON.stringify(unreachable)}`)
    }
  }
}

function mount(slot: HTMLElement, root: PaintRoot): void {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', root.viewBox)
  svg.setAttribute('focusable', root.focusable)
  applyA11y(svg, root.a11y)
  for (const node of root.nodes) svg.append(renderNode(node))
  slot.replaceChildren(svg)
}

function readPreference(query: MediaQueryList): MotionPreference {
  return query.matches ? 'reduce' : 'full'
}

const staticPanel = panel('static')
const staticIcon = compose({
  icon: check,
  a11y: { purpose: 'meaningful', name: saved },
  preference: 'full',
})
mount(staticPanel.slot, staticIcon.frameAt({ nowMs: 0, mountedAtMs: null }))
staticPanel.label.textContent = `motion.kind is ${staticIcon.motion.kind}.`

const drawnPanel = panel('drawn')
const drawn = compose({
  icon: check,
  a11y: { purpose: 'meaningful', name: saved },
  preference: 'full',
  behavior: { kind: 'stroke-draw', durationMs: durationMs(600) },
  trigger: { kind: 'on-load' },
})
mount(drawnPanel.slot, drawn.frameAt({ nowMs: 300, mountedAtMs: 0 }))
drawnPanel.label.textContent = `Half drawn at 300 ms. motion.kind is ${drawn.motion.kind}.`

const reducedPanel = panel('reduced')
const reduced = compose({
  icon: check,
  a11y: { purpose: 'meaningful', name: saved },
  preference: 'reduce',
  behavior: { kind: 'stroke-draw', durationMs: durationMs(600) },
  trigger: { kind: 'on-load' },
})
mount(reducedPanel.slot, reduced.frameAt({ nowMs: 0, mountedAtMs: 0 }))
reducedPanel.label.textContent = `motion.kind is ${reduced.motion.kind}.`

const livePanel = panel('live')
let frameId = 0

function paintLive(preference: MotionPreference): void {
  cancelAnimationFrame(frameId)
  const icon = compose({
    icon: check,
    a11y: { purpose: 'meaningful', name: saved },
    preference,
    behavior: { kind: 'stroke-draw', durationMs: durationMs(LIVE_DURATION_MS) },
    trigger: { kind: 'on-load' },
  })
  livePanel.label.textContent = `Preference ${preference}. motion.kind is ${icon.motion.kind}.`
  switch (icon.motion.kind) {
    case 'reduced':
      mount(livePanel.slot, icon.frameAt({ nowMs: 0, mountedAtMs: 0 }))
      return
    case 'play': {
      const mountedAtMs = performance.now()
      const duration = icon.motion.durationMs
      const draw = (nowMs: number) => {
        mount(livePanel.slot, icon.frameAt({ nowMs, mountedAtMs }))
        if (nowMs - mountedAtMs < duration) frameId = requestAnimationFrame(draw)
      }
      draw(mountedAtMs)
      return
    }
    case 'static':
      mount(livePanel.slot, icon.frameAt({ nowMs: 0, mountedAtMs: null }))
      return
    default: {
      const unreachable: never = icon.motion
      throw new Error(`unexpected motion ${JSON.stringify(unreachable)}`)
    }
  }
}

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
paintLive(readPreference(motionQuery))
motionQuery.addEventListener('change', () => {
  paintLive(readPreference(motionQuery))
})
