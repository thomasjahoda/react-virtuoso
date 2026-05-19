# Rendering lifecycle & first-frame blank issue

## The problem

React Virtuoso does not render list items on the very first browser paint. Users may see a blank or empty list for one or more frames before items appear.

## Why it happens

### 1. Viewport height starts unknown

In `src/domIOSystem.ts`:
```ts
const rawViewportHeight = u.stream<number>()   // plain stream — no initial value
const viewportHeight = u.stream<number>()       // derived, also no initial value
```

Neither has an initial value. The urx `stream<T>()` type (unlike `statefulStream(initial)`) emits nothing until explicitly published to.

### 2. visibleRange won't compute without viewportHeight

In `src/sizeRangeSystem.ts`, the visible range is computed via:
```ts
u.combineLatest(scrollTop, viewportHeight, headerHeight, listBoundary, overscan, ...)
```

`combineLatest` in urx waits for ALL streams to have emitted at least once before producing output. Since `viewportHeight` never emits on first render, `visibleRange` never emits, and `listState` stays empty → no items rendered.

### 3. viewportHeight is populated by ResizeObserver — async

In `src/hooks/useSize.ts`, the Viewport element is watched by a `ResizeObserver`:
```ts
const observer = new ResizeObserver((entries) => {
  const code = () => {
    const element = entries[0].target as HTMLElement
    if (element.offsetParent !== null) {
      callback(element)          // → rawViewportHeight(height) → viewportHeight
    }
  }
  skipAnimationFrame ? code() : requestAnimationFrame(code)
})
```

The observer is attached via a callback ref (fires during React's commit phase). But the ResizeObserver callback fires asynchronously — in the browser's rendering pipeline AFTER React's commit but (typically) before paint.

### 4. Default: extra rAF delay

`skipAnimationFrameInResizeObserver` defaults to `false`, so the callback is wrapped in `requestAnimationFrame(code)`. This defers the viewport-height publish to the NEXT frame.

Full default timeline:
```
Frame 1 (React commit):
  → DOM mounted
  → ResizeObserver.observe(el) called

Frame 1 (browser rendering pipeline):
  → ResizeObserver fires → requestAnimationFrame(code) scheduled
  → First paint: BLANK (no items)

Frame 2:
  → rAF fires → rawViewportHeight(height) published
  → React re-render triggered (async)
  → Second paint: items visible
```

## Available mitigations

### Option A: `skipAnimationFrameInResizeObserver={true}` (partial fix)

```tsx
<Virtuoso totalCount={1000} skipAnimationFrameInResizeObserver itemContent={...} />
```

Removes the rAF wrapper. ResizeObserver now publishes `rawViewportHeight` directly. Whether React re-renders before the first paint depends on React's scheduler — not guaranteed, but often works in practice.

### Option B: `initialItemCount={N}` (workaround)

```tsx
<Virtuoso totalCount={1000} initialItemCount={20} itemContent={...} />
```

`initialItemCountSystem` uses `didMount` + `initialItemCount` to build an initial `listState` before any viewport-size knowledge. Items render on first frame. The ResizeObserver then takes over for subsequent scroll/resize events.

This is the most reliable workaround for avoiding first-frame blank.

### Option C: `increaseViewportBy` (overscan)

Not a fix for the first frame, but reduces visible jank for subsequent renders.

## Proper fix direction (not yet implemented)

The same pattern used for scroll events in `src/hooks/useScrollTop.ts`:
```ts
ReactDOM.flushSync(call)
```

If the ResizeObserver callback (or a `useLayoutEffect` that reads the element) calls `flushSync` when publishing `rawViewportHeight`, React is forced to render synchronously. Since ResizeObserver fires before paint, this would populate items before the first browser paint.

Rough implementation sketch for `src/hooks/useSize.ts`:
```ts
import ReactDOM from 'react-dom'

const observer = new ResizeObserver((entries) => {
  const code = () => {
    const element = entries[0].target as HTMLElement
    if (element.offsetParent !== null) {
      // flushSync ensures React renders before browser paints
      ReactDOM.flushSync(() => callback(element))
    }
  }
  skipAnimationFrame ? code() : requestAnimationFrame(code)
})
```

**Trade-off**: `flushSync` forces synchronous (blocking) rendering. For scroll events (frequent), this is already what the library does. For resize events (rare), the cost is acceptable. But it must be conditional to avoid double-sync in SSR or strict mode.

Alternatively: read the element height synchronously in a `useLayoutEffect` immediately after mount:
```ts
// In useSizeWithElRef
React.useLayoutEffect(() => {
  if (ref.current && ref.current.offsetParent !== null) {
    callback(ref.current)
  }
}, []) // mount only
```

`useLayoutEffect` fires synchronously after DOM commit and before browser paint. State updates triggered here cause React to re-render before paint — eliminating the blank frame without needing `flushSync` in an async callback.

## Related files

- `src/hooks/useSize.ts` — ResizeObserver setup, `skipAnimationFrame` logic
- `src/domIOSystem.ts` — `rawViewportHeight`, `viewportHeight` streams
- `src/sizeRangeSystem.ts` — `visibleRange` computed from `viewportHeight`
- `src/initialItemCountSystem.ts` — the `initialItemCount` workaround
- `src/hooks/useScrollTop.ts` — example of `flushSync` for DOM events
- `src/Virtuoso.tsx:393` — where `useSize` is called for the Viewport element
