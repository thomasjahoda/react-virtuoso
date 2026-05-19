import { bench, describe } from 'vitest'

import { Cell, Realm, Signal } from '../..'
import { filter, map, scan, withLatestFrom } from '../../operators'

// ---------------------------------------------------------------------------
// Helpers to build graph topologies similar to react-virtuoso's usage
// ---------------------------------------------------------------------------

function buildLinearChain(r: Realm, depth: number) {
  const entry = Signal<number>()
  let current = r.pipe(
    entry,
    map((v) => v + 1)
  )
  for (let i = 1; i < depth; i++) {
    current = r.pipe(
      current,
      map((v) => v + 1)
    )
  }
  r.sub(current, () => {})
  return entry
}

function buildDiamondGraph(r: Realm, width: number) {
  const entry = Signal<number>()
  const branches: ReturnType<typeof r.pipe>[] = []
  for (let i = 0; i < width; i++) {
    branches.push(
      r.pipe(
        entry,
        map((v) => v + i)
      )
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const merged = r.combine(...(branches as [(typeof branches)[0]]))
  r.sub(merged, () => {})
  return entry
}

function buildRealisticVirtuosoLike(r: Realm) {
  const scrollTop$ = Cell(0)
  const viewportHeight$ = Cell(600)
  const totalHeight$ = Cell(10000)
  const itemCount$ = Cell(1000)
  const overscan$ = Cell(200)

  const scrollDirection$ = r.pipe(
    scrollTop$,
    scan((prev, next) => (next > prev ? 1 : -1), 0)
  )

  const visibleRange$ = r.pipe(
    r.combine(scrollTop$, viewportHeight$, overscan$, scrollDirection$),
    map(([top, height, overscan, dir]) => {
      const extra = dir === 1 ? overscan : overscan / 2
      return { start: Math.max(0, top - extra), end: top + height + extra }
    })
  )

  const listState$ = r.pipe(
    r.combine(visibleRange$, itemCount$, totalHeight$),
    map(([range, count, totalH]) => {
      const avgHeight = totalH / count
      const startIdx = Math.floor(range.start / avgHeight)
      const endIdx = Math.min(count - 1, Math.ceil(range.end / avgHeight))
      return { startIdx, endIdx, avgHeight }
    })
  )

  const isScrolling$ = r.pipe(
    scrollTop$,
    map(() => true)
  )

  const atTop$ = r.pipe(
    scrollTop$,
    map((v) => v === 0)
  )

  const atBottom$ = r.pipe(
    r.combine(scrollTop$, viewportHeight$, totalHeight$),
    map(([top, vh, th]) => top + vh >= th)
  )

  const isAtBoundary$ = r.combine(atTop$, atBottom$)

  r.sub(listState$, () => {})
  r.sub(isScrolling$, () => {})
  r.sub(isAtBoundary$, () => {})

  return { scrollTop$, viewportHeight$, totalHeight$, itemCount$ }
}

function buildWideFanOut(r: Realm, fanWidth: number) {
  const entry = Signal<number>()
  for (let i = 0; i < fanWidth; i++) {
    const derived = r.pipe(
      entry,
      map((v) => v + i)
    )
    r.sub(derived, () => {})
  }
  return entry
}

function buildDeepWithPulls(r: Realm, depth: number) {
  const config$ = Cell(42)
  const entry = Signal<number>()
  let current = r.pipe(
    entry,
    withLatestFrom(config$),
    map(([v, c]) => v + c)
  )
  for (let i = 1; i < depth; i++) {
    current = r.pipe(
      current,
      withLatestFrom(config$),
      map(([v, c]) => v + c)
    )
  }
  r.sub(current, () => {})
  return entry
}

function buildManyCells(r: Realm, count: number) {
  const cells = Array.from({ length: count }, (_, i) => Cell(i))
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const combined = r.combine(...(cells as [(typeof cells)[0]]))
  r.sub(combined, () => {})
  return cells
}

// ---------------------------------------------------------------------------
// pub() -- single node publish (the most common operation)
// ---------------------------------------------------------------------------

describe('pub: single node', () => {
  bench('simple cell publish', () => {
    const r = new Realm()
    const cell = Cell(0)
    r.sub(cell, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(cell, i)
    }
  })

  bench('signal with one subscriber', () => {
    const r = new Realm()
    const signal = Signal<number>()
    r.sub(signal, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(signal, i)
    }
  })

  bench('distinct cell - same value (short-circuits)', () => {
    const r = new Realm()
    const cell = Cell(0)
    r.sub(cell, () => {})
    r.pub(cell, 42)

    for (let i = 0; i < 1000; i++) {
      r.pub(cell, 42)
    }
  })
})

// ---------------------------------------------------------------------------
// pubIn() -- multi-node publish
// ---------------------------------------------------------------------------

describe('pubIn: multi-node publish', () => {
  bench('two cells simultaneously', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    r.sub(a, () => {})
    r.sub(b, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pubIn({ [a]: i, [b]: i + 1 })
    }
  })

  bench('five cells simultaneously', () => {
    const r = new Realm()
    const cells = Array.from({ length: 5 }, (_, i) => Cell(i))
    for (const c of cells) {
      r.sub(c, () => {})
    }

    for (let i = 0; i < 1000; i++) {
      const vals: Record<symbol, unknown> = {}
      for (const c of cells) {
        vals[c] = i
      }
      r.pubIn(vals)
    }
  })
})

// ---------------------------------------------------------------------------
// Graph propagation topologies
// ---------------------------------------------------------------------------

describe('linear chain propagation', () => {
  bench('depth 5', () => {
    const r = new Realm()
    const entry = buildLinearChain(r, 5)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('depth 20', () => {
    const r = new Realm()
    const entry = buildLinearChain(r, 20)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('depth 50', () => {
    const r = new Realm()
    const entry = buildLinearChain(r, 50)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })
})

describe('diamond graph propagation', () => {
  bench('width 4', () => {
    const r = new Realm()
    const entry = buildDiamondGraph(r, 4)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('width 10', () => {
    const r = new Realm()
    const entry = buildDiamondGraph(r, 10)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('width 20', () => {
    const r = new Realm()
    const entry = buildDiamondGraph(r, 20)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })
})

describe('fan-out propagation', () => {
  bench('10 subscribers', () => {
    const r = new Realm()
    const entry = buildWideFanOut(r, 10)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('50 subscribers', () => {
    const r = new Realm()
    const entry = buildWideFanOut(r, 50)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })
})

describe('deep chain with withLatestFrom pulls', () => {
  bench('depth 5', () => {
    const r = new Realm()
    const entry = buildDeepWithPulls(r, 5)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('depth 20', () => {
    const r = new Realm()
    const entry = buildDeepWithPulls(r, 20)
    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })
})

// ---------------------------------------------------------------------------
// Realistic virtuoso-like graph
// ---------------------------------------------------------------------------

describe('virtuoso-like scroll simulation', () => {
  bench('1000 scroll events', () => {
    const r = new Realm()
    const { scrollTop$ } = buildRealisticVirtuosoLike(r)
    for (let i = 0; i < 1000; i++) {
      r.pub(scrollTop$, i * 5)
    }
  })
})

// ---------------------------------------------------------------------------
// State map scaling (targets finding #2 - transientState clone cost)
// ---------------------------------------------------------------------------

describe('state map scaling', () => {
  bench('50 cells in realm, publish one', () => {
    const r = new Realm()
    const cells = buildManyCells(r, 50)
    r.pub(cells[0]!, 999)

    for (let i = 0; i < 1000; i++) {
      r.pub(cells[0]!, i)
    }
  })

  bench('200 cells in realm, publish one', () => {
    const r = new Realm()
    const cells = buildManyCells(r, 200)
    r.pub(cells[0]!, 999)

    for (let i = 0; i < 1000; i++) {
      r.pub(cells[0]!, i)
    }
  })

  bench('500 cells in realm, publish one', () => {
    const r = new Realm()
    const cells = buildManyCells(r, 500)
    r.pub(cells[0]!, 999)

    for (let i = 0; i < 1000; i++) {
      r.pub(cells[0]!, i)
    }
  })
})

// ---------------------------------------------------------------------------
// Execution map caching
// ---------------------------------------------------------------------------

describe('execution map caching', () => {
  bench('repeated pub to same node (cached map)', () => {
    const r = new Realm()
    const entry = buildLinearChain(r, 10)
    r.pub(entry, 0)

    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('alternating pub between two nodes (cache lookup)', () => {
    const r = new Realm()
    const a = buildLinearChain(r, 10)
    const b = buildLinearChain(r, 10)
    r.pub(a, 0)
    r.pub(b, 0)

    for (let i = 0; i < 1000; i++) {
      r.pub(i % 2 === 0 ? a : b, i)
    }
  })
})

// ---------------------------------------------------------------------------
// filter / distinct (targets nodeWillNotEmit path)
// ---------------------------------------------------------------------------

describe('conditional propagation (nodeWillNotEmit)', () => {
  bench('filter blocks 50% of values, depth 10', () => {
    const r = new Realm()
    const entry = Signal<number>()
    let current = r.pipe(
      entry,
      filter((v) => v % 2 === 0),
      map((v) => v + 1)
    )
    for (let i = 1; i < 10; i++) {
      current = r.pipe(
        current,
        map((v) => v + 1)
      )
    }
    r.sub(current, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('distinct cell blocks 90% of values', () => {
    const r = new Realm()
    const cell = Cell(0)
    const derived = r.pipe(
      cell,
      map((v) => Math.floor(v / 10))
    )
    const derived2 = r.pipe(
      derived,
      map((v) => v * 2)
    )
    r.sub(derived2, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(cell, i)
    }
  })
})

// ---------------------------------------------------------------------------
// Graph retention: combineCells() accumulation
// ---------------------------------------------------------------------------

describe('combineCells retention', () => {
  bench('fresh realm per combineCells call (baseline)', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    r.combineCells(a, b)

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })

  bench('50 accumulated combineCells on same sources', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    for (let j = 0; j < 50; j++) {
      r.combineCells(a, b)
    }

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })

  bench('200 accumulated combineCells on same sources', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    for (let j = 0; j < 200; j++) {
      r.combineCells(a, b)
    }

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })

  bench('50 combineCells on distinct source pairs', () => {
    const r = new Realm()
    const cells = Array.from({ length: 100 }, (_, i) => Cell(i))
    for (let j = 0; j < 50; j++) {
      r.combineCells(cells[j * 2]!, cells[j * 2 + 1]!)
    }

    for (let i = 0; i < 1000; i++) {
      r.pub(cells[0]!, i)
    }
  })
})

// ---------------------------------------------------------------------------
// Graph retention: subMultiple() leak after unsubscribe
// ---------------------------------------------------------------------------

describe('subMultiple retention after unsubscribe', () => {
  bench('baseline: single subMultiple, kept alive', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    r.subMultiple([a, b], () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })

  bench('50 subMultiple subscribe+unsubscribe cycles', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    for (let j = 0; j < 50; j++) {
      const unsub = r.subMultiple([a, b], () => {})
      unsub()
    }

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })

  bench('200 subMultiple subscribe+unsubscribe cycles', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    for (let j = 0; j < 200; j++) {
      const unsub = r.subMultiple([a, b], () => {})
      unsub()
    }

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })
})

// ---------------------------------------------------------------------------
// Simulated React mount/unmount cycles (combineCells + sub + unsub)
// ---------------------------------------------------------------------------

describe('simulated React mount/unmount cycles', () => {
  bench('baseline: stable mounted component', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    const c = Cell(0)
    const combined = r.combineCells(a, b, c)
    r.sub(combined, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })

  bench('after 20 mount/unmount cycles of useCellValues-like pattern', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    const c = Cell(0)

    for (let j = 0; j < 20; j++) {
      const combined = r.combineCells(a, b, c)
      const unsub = r.sub(combined, () => {})
      unsub()
    }

    const combined = r.combineCells(a, b, c)
    r.sub(combined, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })

  bench('after 100 mount/unmount cycles of useCellValues-like pattern', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    const c = Cell(0)

    for (let j = 0; j < 100; j++) {
      const combined = r.combineCells(a, b, c)
      const unsub = r.sub(combined, () => {})
      unsub()
    }

    const combined = r.combineCells(a, b, c)
    r.sub(combined, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })

  bench('after 20 mount/unmount with subMultiple pattern', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    const c = Cell(0)

    for (let j = 0; j < 20; j++) {
      const unsub = r.subMultiple([a, b, c], () => {})
      unsub()
    }

    r.subMultiple([a, b, c], () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })

  bench('after 100 mount/unmount with subMultiple pattern', () => {
    const r = new Realm()
    const a = Cell(0)
    const b = Cell(0)
    const c = Cell(0)

    for (let j = 0; j < 100; j++) {
      const unsub = r.subMultiple([a, b, c], () => {})
      unsub()
    }

    r.subMultiple([a, b, c], () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(a, i)
    }
  })
})

// ---------------------------------------------------------------------------
// inContext overhead: chains where every node has a subscriber
// (measures per-node closure + try/finally cost in the propagation loop)
// ---------------------------------------------------------------------------

describe('inContext per-node overhead', () => {
  bench('depth 10, subscriber on every node', () => {
    const r = new Realm()
    const entry = Signal<number>()
    let current = r.pipe(
      entry,
      map((v) => v + 1)
    )
    r.sub(current, () => {})
    for (let i = 1; i < 10; i++) {
      current = r.pipe(
        current,
        map((v) => v + 1)
      )
      r.sub(current, () => {})
    }

    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('depth 10, subscriber only on leaf', () => {
    const r = new Realm()
    const entry = Signal<number>()
    let current = r.pipe(
      entry,
      map((v) => v + 1)
    )
    for (let i = 1; i < 10; i++) {
      current = r.pipe(
        current,
        map((v) => v + 1)
      )
    }
    r.sub(current, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('depth 50, subscriber on every node', () => {
    const r = new Realm()
    const entry = Signal<number>()
    let current = r.pipe(
      entry,
      map((v) => v + 1)
    )
    r.sub(current, () => {})
    for (let i = 1; i < 50; i++) {
      current = r.pipe(
        current,
        map((v) => v + 1)
      )
      r.sub(current, () => {})
    }

    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })

  bench('depth 50, subscriber only on leaf', () => {
    const r = new Realm()
    const entry = Signal<number>()
    let current = r.pipe(
      entry,
      map((v) => v + 1)
    )
    for (let i = 1; i < 50; i++) {
      current = r.pipe(
        current,
        map((v) => v + 1)
      )
    }
    r.sub(current, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(entry, i)
    }
  })
})

// ---------------------------------------------------------------------------
// Combined: retention + state map scaling interaction
// ---------------------------------------------------------------------------

describe('retention impact on state map clone cost', () => {
  bench('baseline: 50 cells, no leaked nodes', () => {
    const r = new Realm()
    const cells = Array.from({ length: 50 }, (_, i) => Cell(i))
    const combined = r.combineCells(cells[0]!, cells[1]!)
    r.sub(combined, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(cells[0]!, i)
    }
  })

  bench('50 cells + 100 leaked combineCells nodes', () => {
    const r = new Realm()
    const cells = Array.from({ length: 50 }, (_, i) => Cell(i))
    for (let j = 0; j < 100; j++) {
      const combined = r.combineCells(cells[0]!, cells[1]!)
      const unsub = r.sub(combined, () => {})
      unsub()
    }

    const combined = r.combineCells(cells[0]!, cells[1]!)
    r.sub(combined, () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(cells[0]!, i)
    }
  })

  bench('50 cells + 100 leaked subMultiple nodes', () => {
    const r = new Realm()
    const cells = Array.from({ length: 50 }, (_, i) => Cell(i))
    for (let j = 0; j < 100; j++) {
      const unsub = r.subMultiple([cells[0]!, cells[1]!], () => {})
      unsub()
    }

    r.subMultiple([cells[0]!, cells[1]!], () => {})

    for (let i = 0; i < 1000; i++) {
      r.pub(cells[0]!, i)
    }
  })
})
