# React Virtuoso Fork — Agent Guide

## What this repo is

A fork of [react-virtuoso](https://github.com/petyosi/react-virtuoso), a virtual-scroll React library.
Fork owner: Thomas Jahoda. Published as `@thomasjahoda-forks/react-virtuoso`.

**Upstream sync status**: The fork base is `3e2d3455a` on `upstream/master`. The upstream's **actual default branch is `upstream/main`**, which is significantly ahead. To check what's pending:

```sh
git log $(git merge-base HEAD upstream/main)..upstream/main --oneline
```

As of 2026-05-19, upstream/main has ~200 commits the fork hasn't merged. See "Noteworthy upstream changes" below.

---

## Quick orientation

```
packages/react-virtuoso/src/   ← library source (urx systems + React components)
packages/react-virtuoso/test/  ← vitest unit tests
packages/react-virtuoso/e2e/   ← Playwright e2e tests
apps/                          ← dev/docs app (virtuoso.dev)
```

### Build / test commands

| Task         | Command                                         |
| ------------ | ----------------------------------------------- |
| Build        | `npm run build`                                 |
| Unit tests   | `npm run test` (vitest)                         |
| Run one test | `npx vitest <file>` or `npx vitest -t "<name>"` |
| E2E tests    | `npm run e2e` or `npx playwright test <file>`   |
| Dev server   | `npm run dev`                                   |
| Lint         | `npm run lint`                                  |

---

## Architecture at a glance

### urx — the reactive core

All state lives in **urx streams**. The library has zero useState calls for list logic; instead it uses a custom reactive stream system (`packages/react-virtuoso/src/urx/`).

Key urx concepts:

- `statefulStream(initial)` — holds a value, emits to new subscribers immediately
- `stream<T>()` — no initial value; only emits when published to; `combineLatest` waits for first emit
- `pipe(source, ...transformers)` — transforms/combines streams
- `connect(source, target)` — wires streams together
- `publish(stream, value)` — push a value
- `system(() => {...})` — a module of related streams, composable with `u.tup(...)`

### React binding

`systemToComponent` (in `src/react-urx/index.tsx`) wraps a urx system into a React component:

- Exposes `useEmitterValue(key)` — subscribes to a stateful stream, triggers re-render on change
- Exposes `usePublisher(key)` — returns a stable callback to publish to a stream
- Uses `useIsomorphicLayoutEffect` for subscriptions (SSR-safe)
- React 18: uses `useSyncExternalStore`; legacy: uses `useState` + layoutEffect

### Systems (src/\*System.ts)

Each system owns a slice of state:

| System                   | Owns                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| `domIOSystem`            | viewportHeight, scrollTop, scrollHeight, deviation, layout flags |
| `sizeRangeSystem`        | visible item range from viewport + scroll + overscan             |
| `sizeSystem`             | item sizes (measured via ResizeObserver per item)                |
| `listStateSystem`        | computed list of rendered item descriptors                       |
| `groupedListSystem`      | group headers, current sticky group                              |
| `scrollToIndexSystem`    | imperative scroll-to-index                                       |
| `followOutputSystem`     | auto-scroll to bottom                                            |
| `initialItemCountSystem` | render N items before viewport size is known                     |

### React components (Virtuoso.tsx, TableVirtuoso.tsx, VirtuosoGrid.tsx)

Thin wrappers that:

1. Render the urx `Component` (provider)
2. Render inner structural components (`Viewport`, `Scroller`, `ItemList`, etc.)
3. Wire DOM events (scroll, resize) back to urx streams via hooks

---

## Noteworthy upstream changes (not yet merged into fork)

These are meaningful commits in `upstream/main` that aren't in the fork. The fork may want to cherry-pick bug fixes in particular.

**Bug fixes:**

- `5871779a7` Fix `useSyncExternalStore` detection for React 19+ (important for React 19 compat)
- `1fca093bc` Fix horizontal RTL list positioning
- `fa9dd3194` Fix window-scroll SSR viewport layout
- `b04c3e652` Fix `atBottom` event never firing (regression bug)
- `907b9372f` Fix bogus context attribute

**New props / features:**

- `e53f5402d` `minOverscanItemCount` — minimum items to render beyond visible range
- `8940cae80` `heightEstimates` — provide initial height hints per item to avoid layout thrash
- `34646ce28` `fixedGroupHeight` — fixed-height group headers (perf)
- `b2bcc426b` + `34097bec6` `useEngineRef` / remote hooks — cross-tree engine state access

**Performance:**

- `1ec910ebc` gurx perf improvements (skip empty publishes, memoize snapshots, pre-compute node arrays, dirty-state overlay instead of full clone)

**Tooling (breaking if merged wholesale):**

- ESLint → oxlint, Prettier → oxfmt
- Package manager: npm → pnpm with catalogs
- Vite 8 / rolldown, tsgo for type-checking
- `@virtuoso.dev/tooling` package removed

---

## Fork-specific additions

All fork commits are on top of upstream `3e2d3455a`. Current fork version: **4.14.4**.

### 1. `headerStickinessPerGroup` prop

**Files**: `src/groupedListSystem.ts`, `src/component-interfaces/Virtuoso.ts`, `src/component-interfaces/TableVirtuoso.ts`, `src/Virtuoso.tsx`, `src/TableVirtuoso.tsx`

Accepts `boolean[]` — one entry per group. When `false` for a group, that group's header does NOT stick to the top as the user scrolls through it. Defaults to `true` (sticky) for any unspecified groups.

```tsx
<Virtuoso
  groupCounts={[10, 5, 8]}
  headerStickinessPerGroup={[true, false, true]}
  groupContent={(index) => <div>Group {index}</div>}
  itemContent={(index) => <div>Item {index}</div>}
/>
```

**Caveat**: `headerStickinessPerGroup` combines with `combineLatest(scrollTop, sizes, headerHeight, headerStickinessPerGroup)`. Because `headerStickinessPerGroup` is a plain `stream<boolean[]>` (not stateful), the sticky-group logic won't run until all four streams have emitted at least once.

### 2. `keepMaximumViewportHeight` prop (boolean, default false)

**Files**: `src/domIOSystem.ts`, `src/Virtuoso.tsx`, `src/TableVirtuoso.tsx`

Performance hack for viewport-resize jitter. When `true`, the reported `viewportHeight` never decreases — it's the maximum height seen so far, rounded up to the nearest 100px. Prevents rapid mount/unmount cycles when the viewport shrinks slightly (e.g. virtual keyboard appearing/disappearing, browser chrome resize).

Known limitations (see inline TODO comments):

- May cause `scrollToIndex` to compute incorrect offsets since it uses viewport dimensions
- May interact badly with small-viewport edge cases

### 3. Typing improvements

- Context type changed from `useless context` → `unknown` in component interfaces
- Group header `zIndex` increased from `1` to `5` (allows items to have more internal layering without headers bleeding through)
- ESM-compatible `package.json` (proper `"type": "module"`, `"exports"` field)

---

## Known issues / open investigation

### First-frame blank rendering

**Status**: Confirmed architectural limitation.

**Root cause chain**:

1. `rawViewportHeight` and `viewportHeight` are plain `stream<number>()` — NO initial value
2. `sizeRangeSystem.visibleRange` uses `combineLatest(scrollTop, viewportHeight, ...)` — won't emit until `viewportHeight` has a value
3. First render: no items rendered (list state is empty)
4. Viewport element mounts → callback ref fires → `ResizeObserver.observe(el)` called
5. ResizeObserver fires (async, before paint in modern browsers)
6. **Default (`skipAnimationFrameInResizeObserver: false`)**: callback wrapped in `requestAnimationFrame` → adds one extra frame
7. `rawViewportHeight(height)` published → React state update scheduled → re-render → items visible

**With `skipAnimationFrameInResizeObserver: true`** (prop on Virtuoso): removes the rAF wrapper. ResizeObserver fires directly into React's state update queue. Whether this eliminates the blank frame depends on whether React processes the update before the browser paints.

**Alternative workaround**: use `initialItemCount` prop to render N items unconditionally on first render, bypassing the viewport-height dependency.

**Proper fix direction** (not yet implemented): In the ResizeObserver callback (or in a `useLayoutEffect` that reads the element directly), call `ReactDOM.flushSync(() => rawViewportHeight(height))` — same pattern as `useScrollTop.ts` does for scroll events. This guarantees React renders synchronously before paint. See `src/hooks/useSize.ts:25` and `src/hooks/useScrollTop.ts:64`.

---

## Code conventions

- TypeScript; prettier (140 chars, single quotes, no semicolons)
- No class components; hooks only
- urx stream names are the source of truth — React props map to streams via the `systemToComponent` prop map at the bottom of `Virtuoso.tsx` / `TableVirtuoso.tsx`
- New fork features should add the stream to the relevant `*System.ts`, expose it in the prop map, and add TypeScript types in `component-interfaces/`
- Unit tests use vitest + JSDOM with mocked hooks (`src/hooks/__mocks__/`)
- E2E tests use Playwright against the dev app

---

## Docs directory

See `docs/` (if created) for deep-dives:

- `docs/urx-primer.md` — stream system explained
- `docs/rendering-lifecycle.md` — first-frame issue and viewport measurement
- `docs/fork-changes.md` — all fork-specific additions documented
