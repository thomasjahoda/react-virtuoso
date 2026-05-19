# Fork-specific changes

Fork base: upstream `3e2d3455a` on `upstream/master` (petyosi/react-virtuoso).
Fork version: `4.14.4` (package `@thomasjahoda-forks/react-virtuoso`).

**Note**: upstream's default branch is `upstream/main`, not `upstream/master`. `upstream/main` is ~200 commits ahead of the fork base. Use:

```sh
git log $(git merge-base HEAD upstream/main)..upstream/main --oneline
```

---

## Feature: `headerStickinessPerGroup`

**Commits**: `dc1386415`, `0e9e973d8`
**Prop type**: `boolean[]`
**Components**: `Virtuoso`, `GroupedTableVirtuoso`

Controls whether each group header sticks to the top when scrolling through that group. Array index matches group index. Unspecified entries default to `true` (sticky).

**Example — non-sticky second group**:

```tsx
<Virtuoso
  groupCounts={[10, 5, 8]}
  groupContent={(i) => <header>Group {i}</header>}
  headerStickinessPerGroup={[true, false, true]}
  itemContent={(i) => <div>Item {i}</div>}
/>
```

**Implementation**: `groupedListSystem.ts` — the `topItemsIndexes` stream, which drives what gets pinned, returns `[]` (no sticky item) when the current group's `headerStickinessPerGroup[groupIndex]` is `false`.

**Caveat**: `headerStickinessPerGroup` is a plain `u.stream<boolean[]>()` (not stateful). It participates in a `combineLatest` with `scrollTop`, `sizes`, and `headerHeight`. If you never publish to it, the sticky-group computation never runs. In practice the prop is always set on mount via `systemToComponent`'s prop wiring, which publishes immediately.

---

## Feature: `keepMaximumViewportHeight`

**Commits**: `719c0147e`, `95c04fd2c`, `09332a49a`
**Prop type**: `boolean` (default `false`)
**Components**: `Virtuoso`, `TableVirtuoso`

When `true`, the library remembers the largest `viewportHeight` seen and never reports a smaller one. The remembered height is also rounded up to the nearest 100px.

**Motivation**: In some apps the viewport resizes slightly (e.g. browser chrome hiding/showing, virtual keyboard) causing Virtuoso to unmount/remount large numbers of items rapidly. By keeping the "maximum seen" height, items that would fall just outside the smaller viewport stay mounted, avoiding the churn.

**Known issues** (marked in TODO comments):

- `scrollToIndex` uses `rawViewportHeight` internally. With `keepMaximumViewportHeight` on, the reported height differs from reality, which may cause incorrect scroll offsets for index-based scrolling.
- The implementation lives partly in `domIOSystem.ts` (for the stream pipeline) and partly in the `Viewport` component itself (`Virtuoso.tsx`, `TableVirtuoso.tsx`) where a `maxKnownViewportHeight` closure variable tracks the per-component maximum.

---

## Typing / packaging improvements

**Commit**: `060691d8f`

- `useless context` type parameter in `Virtuoso` and `TableVirtuoso` changed from an internal/invisible type to `unknown`, making the TypeScript API cleaner
- Group header `zIndex` increased from `1` → `5` to give items room for internal layering without headers punching through
- `packages/react-virtuoso/package.json`: added proper `"exports"` field and `"type": "module"` for ESM compatibility

---

## Dev tooling

**Commit**: `4bd6060d8`

Prettier disabled in the ESLint config. Rationale: prettier conflicts with fast iteration during development. Formatting should be enforced by pre-commit hooks and CI, not the IDE's ESLint integration.

---

## Version history

| Version           | Commits     | Content                                                   |
| ----------------- | ----------- | --------------------------------------------------------- |
| 4.12.x (upstream) | base        | upstream release                                          |
| 4.14.2            | `fbc547982` | typing, headerStickinessPerGroup, ESM packaging           |
| 4.14.3            | `0e9cd10c2` | keepMaximumViewportHeight (basic)                         |
| 4.14.4            | `879f8ad3f` | keepMaximumViewportHeight in systems + windowViewportRect |
