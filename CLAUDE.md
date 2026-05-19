# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this repo is

A fork of [react-virtuoso](https://github.com/petyosi/react-virtuoso), a virtual-scroll React library.
Fork owner: Thomas Jahoda. Published as `@thomasjahoda-forks/react-virtuoso`. Current fork version: see `packages/react-virtuoso/package.json` (`4.18.7-fork.*`).

### Upstream sync status

The fork tracks `upstream/main` (the upstream default branch — note: `upstream/master` is stale, do not use it). As of the last merge (commit `32195cfc5 Merge upstream/main`), the fork is up to date with `upstream/main`; all fork-specific commits sit on top.

To list any new pending upstream commits:

```sh
git fetch upstream
git log $(git merge-base HEAD upstream/main)..upstream/main --oneline
```

To list fork-only commits (everything above the merge-base):

```sh
git log upstream/main..HEAD --oneline
```

## NPM Registry Queries

This project uses `devEngines.packageManager` with `"onFail": "error"` in `package.json`, which causes `pnpm info` and `pnpm view` to fail because they delegate to npm, and npm 11 rejects the request. To check package versions, run npm from outside the project directory:

```bash
(cd /tmp && npm info <package> version)
```

## Monorepo Structure

```text
packages/
  react-virtuoso/    - Main virtualization library (library source under src/, vitest unit tests under test/, Playwright e2e tests under e2e/)
  gurx/              - urx state management (fork/variant)
  masonry/           - Masonry layout component
  message-list/      - Chat/message list component
  tooling/           - Shared build tooling

apps/
  virtuoso.dev/      - Starlight/Astro documentation site

examples/            - Ladle stories for testing/development
```

## Build Commands

pnpm workspaces monorepo. Run commands from the root or within specific workspace packages.

### Root-level commands

Run from repository root for all packages:

- Build all: `pnpm build`
- Lint all (includes type checking): `pnpm lint` — **ignore `apps/virtuoso.dev` failures**; it has pre-existing lint errors that are not part of this fork's scope. Other workspaces (`packages/*`, `examples`) must be clean.
- Format all: `pnpm format` (oxfmt)
- Format check: `pnpm format:check`
- Test all: `pnpm test`
- E2E tests all: `pnpm e2e`
- Markdown lint: `pnpm lint:md` / fix: `pnpm lint:md:fix`
- Full CI: `pnpm ci` (setup, build, lint, lint:md, test, e2e)
- Release: `pnpm release` (build + publish with changesets)
- Add changeset: `pnpm changeset-add`
- Dev docs site: `pnpm dev:docs`

**Always run lint/test/format from the repo root**, not from a package subdir. Per-package runs miss issues in other workspaces (e.g. `examples/`) that consume the package and that CI will reject.

### react-virtuoso package (packages/react-virtuoso/)

- Build: `pnpm run build` (uses vite)
- Test: `pnpm run test` (vitest)
- Test watch: `pnpm run test:watch`
- Run single test: `pnpm vitest <test-file-path>` or `pnpm vitest -t "<test-name>"`
- E2E tests: `pnpm run e2e` (playwright)
- Lint (includes type checking): `pnpm run lint`
- Format: `pnpm run format` (oxfmt)
- Format check: `pnpm run format:check`
- Dev/preview examples: `pnpm run ladle` (launches Ladle server for browsing examples/ folder)

### virtuoso.dev docs app (apps/virtuoso.dev/)

- Dev server: `pnpm run dev`
- Build: `pnpm run build`
- Format: `pnpm run format` (oxfmt + Prettier for .astro files)

After docs changes: run `pnpm lint` from the app directory or root.

**IMPORTANT - Documentation Locations:**

**DO NOT EDIT** the following auto-generated directories:

- `apps/virtuoso.dev/src/content/docs/react-virtuoso/`
- `apps/virtuoso.dev/src/content/docs/masonry/`
- `apps/virtuoso.dev/src/content/docs/gurx/`
- `apps/virtuoso.dev/src/content/docs/message-list/`

These are auto-synced from source files + TypeDoc API via the `docsSync` integration. Any edits will be overwritten.

**To edit package documentation**, modify the source files in each package:

- **react-virtuoso**: `packages/react-virtuoso/README.md` or `packages/react-virtuoso/docs/*.md`
- **masonry**: `packages/masonry/README.md` or `packages/masonry/docs/*.md`
- **gurx**: `packages/gurx/README.md` or `packages/gurx/docs/*.md`
- **message-list**: `packages/message-list/README.md` or `packages/message-list/docs/*.md`

## Architecture

### State Management: urx system

All list-logic state lives in **urx streams** (custom reactive stream system at `packages/react-virtuoso/src/urx/`). The library has zero `useState` calls for list logic.

Core primitives:

- `statefulStream(initial)` — holds a value, emits to new subscribers immediately
- `stream<T>()` — no initial value; only emits when published to; `combineLatest` waits for first emit from every input
- `pipe(source, ...transformers)` — transforms/combines streams
- `connect(source, target)` — wires streams together
- `publish(stream, value)` — push a value
- `system(() => {...})` — module of related streams, composable with `u.tup(...)`

Key urx files under `packages/react-virtuoso/src/urx/`:

- `system.ts` - System creation and composition
- `streams.ts` - Stream primitives
- `pipe.ts` - Stream operators and transformers
- `actions.ts` - Publishing/emitting
- `transformers.ts` - Stream transformation utilities

### React binding (`src/react-urx/index.tsx`)

`systemToComponent` wraps a urx system into a React component:

- `useEmitterValue(key)` — subscribes to a stateful stream, triggers re-render on change
- `usePublisher(key)` — returns a stable callback to publish to a stream
- Uses `useIsomorphicLayoutEffect` for subscriptions (SSR-safe)
- React 18+: uses `useSyncExternalStore`; legacy: `useState` + layoutEffect

### Systems (`src/*System.ts`)

Each system owns a slice of state:

| System                          | Owns                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `domIOSystem`                   | viewportHeight, scrollTop, scrollHeight, deviation, layout flags |
| `sizeSystem`                    | item sizes (measured via ResizeObserver per item)                |
| `sizeRangeSystem`               | visible item range from viewport + scroll + overscan             |
| `listStateSystem`               | computed list of rendered item descriptors                       |
| `groupedListSystem`             | group headers, current sticky group                              |
| `scrollToIndexSystem`           | imperative scroll-to-index                                       |
| `followOutputSystem`            | auto-scroll for chat/feed UIs                                    |
| `initialItemCountSystem`        | render N items before viewport size is known                     |
| `initialTopMostItemIndexSystem` | initial scroll position                                          |
| `scrollSeekSystem`              | placeholder rendering during fast scrolling                      |
| `windowScrollerSystem`          | window-scrolling mode                                            |

`listSystem.ts` composes all feature systems into the main list system.

### React components

- `Virtuoso.tsx` — main list component
- `VirtuosoGrid.tsx` — grid layout component
- `TableVirtuoso.tsx` — table virtualization component
- Component interfaces in `component-interfaces/`

Thin wrappers that (1) render the urx `Component` provider, (2) render inner structural components (`Viewport`, `Scroller`, `ItemList`, etc.), (3) wire DOM events back into urx streams via hooks (`hooks/useSize.ts`, `hooks/useScrollTop.ts`, `hooks/useWindowViewportRect.ts`).

### Size calculation

Variable-sized items work automatically via `sizeSystem.ts`:

- Uses ResizeObserver for measurements
- Maintains size ranges and estimates
- No manual height specification needed
- `correctItemSize()` utility in `utils/` handles size corrections

### E2E testing

E2E tests in `packages/react-virtuoso/e2e/`:

- Test files: `*.test.ts` (Playwright tests)
- Example pages: `examples/*.tsx` (rendered in browser for tests)
- Use Ladle (`pnpm run ladle`) to preview examples during development

## Fork-specific additions

Fork-only commits sit on top of `upstream/main` (last synced via merge commit `32195cfc5`). Check `packages/react-virtuoso/package.json` for the current fork version, and `git log upstream/main..HEAD --oneline` for the full fork-commit list.

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

### 3. First-frame blank fix

**Files**: `src/hooks/useSize.ts`, `src/hooks/useWindowViewportRect.ts`

Upstream renders zero items on the first commit because viewport height is only published asynchronously via ResizeObserver (post-paint). Fix: `useSize` and `useWindowViewportRect` now run a `useIsomorphicLayoutEffect` that synchronously measures the viewport element pre-paint and publishes through the same callback. `viewportHeight` already de-dupes with `distinctUntilChanged`; `useWindowViewportRect` adds a field-wise dedup before publishing so subsequent ResizeObserver invocations with identical rects don't propagate.

### 4. Typing improvements

- Context type changed from `useless context` → `unknown` in component interfaces
- Group header `zIndex` increased from `1` to `5` (allows items to have more internal layering without headers bleeding through)
- ESM-compatible `package.json` (proper `"type": "module"`, `"exports"` field)

## Code Style

- TypeScript with strong typing; avoid `any`
- oxfmt: 140 char width, single quotes, no semicolons
- Naming: camelCase for variables/functions, PascalCase for components
- Imports: React first, external libs, then internal modules
- Functional components with hooks preferred
- Use urx system patterns for state management
- Error handling: prefer early returns
- New fork features should add the stream to the relevant `*System.ts`, expose it in the prop map (bottom of `Virtuoso.tsx` / `TableVirtuoso.tsx`), and add TypeScript types in `component-interfaces/`
- Unit tests use vitest + JSDOM with mocked hooks (`src/hooks/__mocks__/`)
- E2E tests use Playwright against the dev app

## Markdown Style Guide

When writing or editing markdown documentation:

### Formatting Rules

- Headings: ATX-style (`# Heading` not `Heading\n=======`)
- Code blocks: Always use fenced blocks with language specifiers

```typescript
const foo = 'bar'
```

- Lists: Use `-` for unordered lists, indent nested items by 2 spaces
- Emphasis: Use `_single underscore_` for emphasis, `**double asterisk**` for strong
- Links: Prefer inline links `[text](url)` for readability

### Content Guidelines

- Start with clear, descriptive headings (H1 for title, H2 for major sections)
- Use code blocks for all code examples, terminal commands, and file paths
- Include language identifiers in fenced code blocks (`typescript`, `bash`, `json`)
- Break long paragraphs into shorter ones (3-5 sentences max)
- Use tables for structured data comparison
- Add blank lines before and after headings, lists, code blocks, and tables

### Special Cases

- Inline HTML allowed for badges, complex layouts, or special formatting
- Bare URLs allowed in reference sections and changelogs
- Line length not enforced (practical for existing docs)
- Multiple H1 headings allowed (document sections)

### Linting

- Run `pnpm lint:md` to check markdown files
- Run `pnpm lint:md:fix` to auto-fix issues
- Pre-commit hooks automatically lint staged .md files
- Configuration: `.markdownlint.json` and `.markdownlintignore`
- If necessary, use `markdownlint` CLI directly, but prefer pnpm scripts

## Code Change Checklist

After making code changes, run these commands to verify quality.

### Required (always run, from repo root)

- `pnpm lint` - Lint and type check (oxlint --type-aware --type-check). Ignore `apps/virtuoso.dev` failures.
- `pnpm format` - Format code with oxfmt
- `pnpm test` - Run unit tests (vitest)

### Conditionally Required

- `pnpm lint:md` - If editing markdown files
- `pnpm lint:md:fix` - Auto-fix markdown issues
- `pnpm run e2e` - For UI/behavior changes (Playwright tests)
- `pnpm run ladle` - To visually inspect component changes

### Quick Full Validation

- `pnpm ci` - Run complete CI pipeline (setup, build, lint, lint:md, test, e2e)
- `pnpm format:check` - Check if files are formatted without modifying them

### Fixing Issues

Format issues are auto-fixed by `pnpm format`. oxlint issues must be fixed manually. Configure your editor to:

- Format on save using oxfmt (140 char width, single quotes, no semicolons)
- Show oxlint warnings/errors

Pre-commit hooks will block commits if lint (which includes type checking) fails.

## Development Workflow

1. Make changes in `packages/react-virtuoso/src/`
2. From repo root: `pnpm format && pnpm lint && pnpm test`
3. Check examples with `pnpm run ladle` if UI changes
4. Run `pnpm e2e` for end-to-end validation if needed
5. Add changeset with `pnpm changeset-add` for versioned changes

## Git Hooks

This project uses [lefthook](https://github.com/evilmartians/lefthook) for git hooks.

### Pre-commit Checks

On every commit, the following checks run automatically on staged files:

- **Code formatting**: Formats `.ts/.tsx/.js/.jsx` files with oxfmt and `.astro` files with prettier; changes are auto-staged via `stage_fixed`
- **Markdown linting**: Validates .md files with markdownlint
- **Code linting**: Validates code files with oxlint

### Skipping Hooks

If you need to skip hooks (e.g., WIP commits):

```bash
LEFTHOOK=0 git commit -m "WIP: work in progress"
# Or use git commit --no-verify (not recommended)
```

### Hook Management

- Configuration: `lefthook.json`
- Install hooks: `pnpm exec lefthook install`
- Uninstall hooks: `pnpm exec lefthook uninstall`
- Run manually: `pnpm exec lefthook run pre-commit`

## Agent rules

- `dangerouslyDisableSandbox`: only for `npm publish` / `pnpm publish`. Never for git, file ops, or anything else.
