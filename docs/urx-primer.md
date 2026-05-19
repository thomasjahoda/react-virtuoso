# urx — reactive stream primer

The library uses a custom reactive stream system called **urx** (`src/urx/`). All list logic state lives in streams; no `useState` calls exist in the core systems.

## Stream types

```ts
import * as u from './urx'

// statefulStream: holds latest value, emits to new subscribers immediately
const count = u.statefulStream(0) // initial value 0

// stream: no initial value, only emits when published
const scrollTo = u.stream<ScrollToOptions>()
```

**Critical distinction**: `stream<T>()` participates in `combineLatest` but only after it emits at least once. `statefulStream(v)` is immediately ready. This is why `viewportHeight` (a plain stream) causes blank first frames — it blocks `combineLatest` until the ResizeObserver fires.

## Basic operators

```ts
u.publish(stream, value)         // push a value
u.subscribe(stream, callback)    // subscribe; returns unsubscribe fn
u.getValue(statefulStream)       // synchronously read current value

u.pipe(source, ...transformers)  // chain transformers
u.connect(source, target)        // wire streams (source → target)

u.map(fn)                        // transform values
u.filter(predicate)              // drop values
u.distinctUntilChanged()         // deduplicate (===)
u.duc(stream)                    // shorthand: pipe(stream, duc())
u.combineLatest(a, b, c, ...)    // emit when any changes, with latest from all
u.withLatestFrom(a, b, ...)      // pair with latest values (doesn't trigger)
u.merge(a, b, ...)               // emit from any source
```

## Systems

A system is a module of related streams:

```ts
export const mySystem = u.system(
  ([dep1, dep2]) => {
    // receives dependency system outputs
    const foo = u.statefulStream(0)
    const bar = u.stream<string>()

    u.connect(
      u.pipe(
        foo,
        u.map((n) => n.toString())
      ),
      bar
    )

    return { foo, bar } // exports
  },
  u.tup(dep1System, dep2System), // dependencies
  { singleton: true } // optional: one instance per component tree
)
```

Systems compose: `u.tup(a, b, c)` declares dependencies. The constructor receives their outputs destructured.

## React binding

`systemToComponent(systemSpec, propMap, RootComponent?)` wraps a system as a React component:

```ts
export const { Component, useEmitterValue, usePublisher, useEmitter } = systemToComponent(listSystem, {
  optional: {
    totalCount: 'totalCount', // prop name → stream name
    data: 'data',
  },
  methods: {
    scrollToIndex: 'scrollToIndex', // imperative method → stream
  },
  events: {
    onScroll: 'scrollContainerState', // callback prop → stream subscription
  },
})
```

### Hooks inside the component tree

```ts
// Read a stateful stream value (re-renders on change)
const height = useEmitterValue('viewportHeight')

// Get a stable callback to publish to a stream
const publish = usePublisher('scrollTo')
publish({ top: 0, behavior: 'smooth' })

// Subscribe without rendering
useEmitter('scrollTop', (top) => console.log(top))
```

### React 18 note

`useEmitterValue` uses `useSyncExternalStore` on React 18, falling back to `useState` + `useLayoutEffect` on older versions. The React 18 path is tearing-safe.

## Common patterns

### `compose` — left-to-right pipe into a publisher

```ts
// In Virtuoso.tsx: turns "element" into "height" then publishes to rawViewportHeight
const cb = u.compose(rawViewportHeight, (el: HTMLElement) => correctItemSize(el, 'height'))
```

This is equivalent to `(el) => rawViewportHeight(correctItemSize(el, 'height'))`.

### `streamFromEmitter` — make a stateful copy of an event stream

```ts
const statefulScrollTop = u.statefulStream(0)
u.connect(scrollTop, statefulScrollTop)
```

Or inline: `u.statefulStreamFromEmitter(pipe(scrollTop, ...))`.

### Deduplication

Always wrap streams in `u.duc(stream)` inside `combineLatest` to prevent redundant emissions when the value hasn't changed:

```ts
u.combineLatest(
  u.duc(scrollTop),
  u.duc(viewportHeight),
  ...
)
```

## Key streams for list rendering

| Stream              | Type                    | Description                       |
| ------------------- | ----------------------- | --------------------------------- |
| `rawViewportHeight` | `stream<number>`        | Raw height from ResizeObserver    |
| `viewportHeight`    | `stream<number>`        | Final height (may be max-clamped) |
| `scrollTop`         | `stream<number>`        | Current scroll offset             |
| `visibleRange`      | stateful `[start, end]` | Index range of items to render    |
| `listState`         | stateful                | Full computed list descriptor     |
| `totalCount`        | stateful                | Total item count                  |
| `sizes`             | stateful                | Measured item sizes (AATree)      |
