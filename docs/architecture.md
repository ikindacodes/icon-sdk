# Core boundaries

`@icon-sdk/core` builds a `PaintRoot` from an icon definition. `compose` chooses the `Motion`. `frameAt` returns the tree for a `Clock` the caller owns. An adapter copies that tree onto elements.

## Types

`IconDefinition` is a branded `viewBox` and a non-empty list of nodes. `defineIcon` is the only constructor. It stores stroke defaults on every node, including the children of a group. Author values win. Each node keeps its own stroke, so a group stroke stays on the group.

The defaults are fill `none`, stroke `currentColor`, stroke-width `2`, stroke-linecap `round`, and stroke-linejoin `round`.

`IconNode` is a discriminated union.

- A path carries `d`.
- A circle carries `cx`, `cy`, and `r`.
- A rect carries `x`, `y`, `width`, and `height`. It may also carry `rx` and `ry`.
- A line carries `x1`, `y1`, `x2`, and `y2`.
- A polyline carries `points`. A polygon carries `points`.
- A group carries child nodes.

`IconUse` is decorative, or meaningful with an `AccessibleName`. `accessibleName` trims the string and rejects an empty result with `IconInputError`.

`Behavior` is `stroke-draw` with a `DurationMs`. `durationMs` accepts a finite number greater than 0 and rejects every other number with `IconInputError`.

`Trigger` is `on-load`. `Clock` has `nowMs` and `mountedAtMs`. `mountedAtMs` stays null until the icon is mounted.

`Motion` is `static`, `reduced`, or `play`. `play` carries `durationMs` and the trigger.

A still call omits both `behavior` and `trigger`, and its `motion.kind` is `static`. An animated call passes both. `preference: 'reduce'` makes `motion.kind` `reduced`. `preference: 'full'` makes `motion.kind` `play`.

`PaintRoot` carries a viewBox string, `focusable` `'false'`, paint accessibility, and paint nodes. Attribute values are strings. Decorative paint accessibility is `ariaHidden` `'true'`. Meaningful paint accessibility is `role` `'img'` and `ariaLabel`. The root's children are the paint nodes.

## Modules

`packages/core/src/errors.ts` owns `IconInputError`.

`define.ts` owns the geometry, `defineIcon`, and the number formatter that `frameAt` uses.

`a11y.ts` owns `accessibleName`, `IconUse`, and `toPaintA11y`. `toPaintA11y` stays inside the package.

`behaviors.ts` owns `durationMs`, `Behavior`, and `resolveBehavior`. `resolveBehavior` stays inside the package.

`triggers.ts` owns `Trigger`, `Clock`, and `triggerPhase`. `triggerPhase` stays inside the package. `triggers.ts` depends only on its own types.

`compose.ts` owns `compose`, `frameAt`, `Motion`, `PaintRoot`, and `paint`. `paint` stays inside the package.

`index.ts` re-exports each public name on its own line. The file has no logic.

`define.ts`, `a11y.ts`, and `behaviors.ts` import `errors.ts`. `behaviors.ts` and `triggers.ts` stay independent of each other. `compose.ts` imports the other modules.

## What an adapter may own

An adapter may read `matchMedia('(prefers-reduced-motion: reduce)')` and pass `'reduce'` or `'full'`.

An adapter may own one `Clock` per mounted icon. For `on-load`, it writes `mountedAtMs` when the svg is inserted. It writes `nowMs` from a timer.

An adapter may create elements, set `viewBox`, set `focusable`, copy `node.attrs` with `setAttribute`, and map `PaintA11y` onto `aria-hidden`, `role`, and `aria-label`.

## What stays in core

Core chooses the dash offset, the path length, and the rest frame.

Core decides when `on-load` is idle, running, or done. Idle paints the undrawn stroke. Running moves `stroke-dashoffset` from `1` to `0`. Done paints the finished stroke. `static` paints the definition and ignores the clock. `reduced` paints the finished stroke for every clock.

Stroke-draw sets `pathLength` to `1`. The dash numbers are fractions of the stroke.

A behavior and a trigger are both present, or both absent. The accessible name lives on the composition. The definition stays geometry.

`apps/proof` is a private workspace page that paints with the DOM.

## Later

A new behavior is a variant in `behaviors.ts`. A new trigger is a variant in `triggers.ts`. That trigger may add a field to `Clock` in the same file. `compose` stays one function.

Adapter packages, and the agent skill for composing icons, are later PRs.
