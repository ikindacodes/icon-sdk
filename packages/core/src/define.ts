import { IconInputError } from './errors.ts'

export type ViewBox = {
  readonly minX: number
  readonly minY: number
  readonly width: number
  readonly height: number
}

export type PresentationInput = {
  readonly fill?: string
  readonly stroke?: string
  readonly 'stroke-width'?: number
  readonly 'stroke-linecap'?: 'butt' | 'round' | 'square'
  readonly 'stroke-linejoin'?: 'miter' | 'round' | 'bevel'
}

export type Presentation = {
  readonly fill: string
  readonly stroke: string
  readonly 'stroke-width': number
  readonly 'stroke-linecap': 'butt' | 'round' | 'square'
  readonly 'stroke-linejoin': 'miter' | 'round' | 'bevel'
}

export type IconNodeInput =
  | { readonly name: 'path'; readonly attrs: PresentationInput & { readonly d: string } }
  | {
      readonly name: 'circle'
      readonly attrs: PresentationInput & {
        readonly cx: number
        readonly cy: number
        readonly r: number
      }
    }
  | {
      readonly name: 'rect'
      readonly attrs: PresentationInput & {
        readonly x: number
        readonly y: number
        readonly width: number
        readonly height: number
        readonly rx?: number
        readonly ry?: number
      }
    }
  | {
      readonly name: 'line'
      readonly attrs: PresentationInput & {
        readonly x1: number
        readonly y1: number
        readonly x2: number
        readonly y2: number
      }
    }
  | { readonly name: 'polyline'; readonly attrs: PresentationInput & { readonly points: string } }
  | { readonly name: 'polygon'; readonly attrs: PresentationInput & { readonly points: string } }
  | {
      readonly name: 'g'
      readonly attrs: PresentationInput
      readonly children: readonly IconNodeInput[]
    }

export type IconNode =
  | { readonly name: 'path'; readonly attrs: Presentation & { readonly d: string } }
  | {
      readonly name: 'circle'
      readonly attrs: Presentation & {
        readonly cx: number
        readonly cy: number
        readonly r: number
      }
    }
  | {
      readonly name: 'rect'
      readonly attrs: Presentation & {
        readonly x: number
        readonly y: number
        readonly width: number
        readonly height: number
        readonly rx?: number
        readonly ry?: number
      }
    }
  | {
      readonly name: 'line'
      readonly attrs: Presentation & {
        readonly x1: number
        readonly y1: number
        readonly x2: number
        readonly y2: number
      }
    }
  | { readonly name: 'polyline'; readonly attrs: Presentation & { readonly points: string } }
  | { readonly name: 'polygon'; readonly attrs: Presentation & { readonly points: string } }
  | { readonly name: 'g'; readonly attrs: Presentation; readonly children: readonly IconNode[] }

export type IconDefinition = {
  readonly viewBox: ViewBox
  readonly nodes: readonly [IconNode, ...IconNode[]]
} & { readonly __brand: 'IconDefinition' }

type IconDefinitionInput = {
  readonly viewBox: ViewBox
  readonly nodes: readonly [IconNodeInput, ...IconNodeInput[]]
}

const DEFAULT_FILL = 'none'
const DEFAULT_STROKE = 'currentColor'
const DEFAULT_STROKE_WIDTH = 2
const DEFAULT_LINECAP = 'round' satisfies Presentation['stroke-linecap']
const DEFAULT_LINEJOIN = 'round' satisfies Presentation['stroke-linejoin']

export function defineIcon(input: IconDefinitionInput): IconDefinition {
  const viewBox = defineViewBox(input.viewBox)
  const nodes = input.nodes.map((node, index) => defineNode(node, `nodes[${index}]`))
  const first = nodes[0]
  if (!first) {
    throw new IconInputError('an icon needs a node', 'nodes')
  }
  return {
    viewBox,
    nodes: [first, ...nodes.slice(1)],
    __brand: 'IconDefinition',
  }
}

export function formatNumber(value: number): string {
  if (value === 0) return '0'
  if (Number.isInteger(value)) return String(value)
  const fixed = value.toFixed(4)
  const trimmed = fixed.replace(/0+$/, '')
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed
}

function defineViewBox(input: ViewBox): ViewBox {
  return {
    minX: finite(input.minX, 'viewBox.minX'),
    minY: finite(input.minY, 'viewBox.minY'),
    width: positive(input.width, 'viewBox.width'),
    height: positive(input.height, 'viewBox.height'),
  }
}

function defineNode(input: IconNodeInput, at: string): IconNode {
  switch (input.name) {
    case 'path':
      return { name: 'path', attrs: definePath(input.attrs, at) }
    case 'circle':
      return { name: 'circle', attrs: defineCircle(input.attrs, at) }
    case 'rect':
      return { name: 'rect', attrs: defineRect(input.attrs, at) }
    case 'line':
      return { name: 'line', attrs: defineLine(input.attrs, at) }
    case 'polyline':
      return { name: 'polyline', attrs: definePoints(input.attrs, at) }
    case 'polygon':
      return { name: 'polygon', attrs: definePoints(input.attrs, at) }
    case 'g':
      return {
        name: 'g',
        attrs: definePresentation(input.attrs, at),
        children: input.children.map((child, index) =>
          defineNode(child, `${at}.children[${index}]`),
        ),
      }
    default: {
      const unreachable: never = input
      return unreachable
    }
  }
}

function definePath(
  attrs: PresentationInput & { readonly d: string },
  at: string,
): Presentation & { readonly d: string } {
  return {
    d: nonEmpty(attrs.d, `${at}.d`),
    ...definePresentation(attrs, at),
  }
}

function defineCircle(
  attrs: PresentationInput & { readonly cx: number; readonly cy: number; readonly r: number },
  at: string,
): Presentation & { readonly cx: number; readonly cy: number; readonly r: number } {
  return {
    cx: finite(attrs.cx, `${at}.cx`),
    cy: finite(attrs.cy, `${at}.cy`),
    r: positive(attrs.r, `${at}.r`),
    ...definePresentation(attrs, at),
  }
}

function defineRect(
  attrs: PresentationInput & {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly rx?: number
    readonly ry?: number
  },
  at: string,
): Presentation & {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rx?: number
  readonly ry?: number
} {
  const rx = attrs.rx
  const ry = attrs.ry
  return {
    x: finite(attrs.x, `${at}.x`),
    y: finite(attrs.y, `${at}.y`),
    width: positive(attrs.width, `${at}.width`),
    height: positive(attrs.height, `${at}.height`),
    ...(rx === undefined ? {} : { rx: nonNegative(rx, `${at}.rx`) }),
    ...(ry === undefined ? {} : { ry: nonNegative(ry, `${at}.ry`) }),
    ...definePresentation(attrs, at),
  }
}

function defineLine(
  attrs: PresentationInput & {
    readonly x1: number
    readonly y1: number
    readonly x2: number
    readonly y2: number
  },
  at: string,
): Presentation & {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
} {
  return {
    x1: finite(attrs.x1, `${at}.x1`),
    y1: finite(attrs.y1, `${at}.y1`),
    x2: finite(attrs.x2, `${at}.x2`),
    y2: finite(attrs.y2, `${at}.y2`),
    ...definePresentation(attrs, at),
  }
}

function definePoints(
  attrs: PresentationInput & { readonly points: string },
  at: string,
): Presentation & { readonly points: string } {
  return {
    points: nonEmpty(attrs.points, `${at}.points`),
    ...definePresentation(attrs, at),
  }
}

function definePresentation(input: PresentationInput, at: string): Presentation {
  return {
    fill: input.fill ?? DEFAULT_FILL,
    stroke: input.stroke ?? DEFAULT_STROKE,
    'stroke-width': nonNegative(
      input['stroke-width'] ?? DEFAULT_STROKE_WIDTH,
      `${at}.stroke-width`,
    ),
    'stroke-linecap': input['stroke-linecap'] ?? DEFAULT_LINECAP,
    'stroke-linejoin': input['stroke-linejoin'] ?? DEFAULT_LINEJOIN,
  }
}

function finite(value: number, at: string): number {
  if (!Number.isFinite(value)) {
    throw new IconInputError(`${at} must be finite`, at)
  }
  return value
}

function positive(value: number, at: string): number {
  const number = finite(value, at)
  if (number <= 0) {
    throw new IconInputError(`${at} must be greater than 0`, at)
  }
  return number
}

function nonNegative(value: number, at: string): number {
  const number = finite(value, at)
  if (number < 0) {
    throw new IconInputError(`${at} must be greater than or equal to 0`, at)
  }
  return number
}

function nonEmpty(value: string, at: string): string {
  if (value.length === 0) {
    throw new IconInputError(`${at} must not be empty`, at)
  }
  return value
}
