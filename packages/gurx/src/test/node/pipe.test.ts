import { describe, expect, it, vi } from 'vitest'

import { Cell, Realm, Signal } from '../..'
import { debounceTime, filter, map, mapTo, once, onNext, scan, throttleTime, withLatestFrom } from '../../operators'
import { noop } from '../../utils'

function awaitCall(cb: () => unknown, delay: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      cb()
      resolve(undefined)
    }, delay)
  })
}

describe('pipe', () => {
  it('maps node values', () => {
    const r = new Realm()
    const a = Signal<number>()

    const b = r.pipe(
      a,
      map((val: number) => val * 2)
    )
    const spy = vi.fn()
    r.sub(b, spy)
    r.pub(a, 2)
    expect(spy).toHaveBeenCalledWith(4)
  })

  it('filters node values', () => {
    const r = new Realm()
    const a = Signal<number>()

    const b = r.pipe(
      a,
      filter((val: number) => val % 2 === 0)
    )

    const spy = vi.fn()
    r.sub(b, spy)
    r.pub(a, 2)
    r.pub(a, 3)
    r.pub(a, 4)
    expect(spy).toHaveBeenCalledWith(4)
    expect(spy).not.toHaveBeenCalledWith(3)
    expect(spy).toHaveBeenCalledWith(2)
  })

  it('filter blocks propagation through a deep chain', () => {
    const r = new Realm()
    const a = Signal<number>()

    const b = r.pipe(
      a,
      filter((val: number) => val % 2 === 0)
    )
    const c = r.pipe(
      b,
      map((v) => v * 10)
    )
    const d = r.pipe(
      c,
      map((v) => v + 1)
    )
    const e = r.pipe(
      d,
      map((v) => v + 2)
    )

    const spyB = vi.fn()
    const spyC = vi.fn()
    const spyD = vi.fn()
    const spyE = vi.fn()
    r.sub(b, spyB)
    r.sub(c, spyC)
    r.sub(d, spyD)
    r.sub(e, spyE)

    r.pub(a, 3)
    expect(spyB).toHaveBeenCalledTimes(0)
    expect(spyC).toHaveBeenCalledTimes(0)
    expect(spyD).toHaveBeenCalledTimes(0)
    expect(spyE).toHaveBeenCalledTimes(0)

    r.pub(a, 4)
    expect(spyB).toHaveBeenCalledWith(4)
    expect(spyC).toHaveBeenCalledWith(40)
    expect(spyD).toHaveBeenCalledWith(41)
    expect(spyE).toHaveBeenCalledWith(43)
  })

  it('filter on one diamond branch does not block the other', () => {
    const r = new Realm()
    const a = Signal<number>()

    const left = r.pipe(
      a,
      filter((v: number) => v % 2 === 0),
      map((v) => v * 10)
    )
    const right = r.pipe(
      a,
      map((v) => v + 1)
    )

    const spyLeft = vi.fn()
    const spyRight = vi.fn()
    r.sub(left, spyLeft)
    r.sub(right, spyRight)

    r.pub(a, 3)
    expect(spyLeft).toHaveBeenCalledTimes(0)
    expect(spyRight).toHaveBeenCalledWith(4)

    r.pub(a, 4)
    expect(spyLeft).toHaveBeenCalledWith(40)
    expect(spyRight).toHaveBeenCalledWith(5)
  })

  it('multiple filters at different depths in the same chain', () => {
    const r = new Realm()
    const a = Signal<number>()

    const b = r.pipe(
      a,
      filter((v: number) => v > 0)
    )
    const c = r.pipe(
      b,
      map((v) => v * 2)
    )
    const d = r.pipe(
      c,
      filter((v: number) => v < 100)
    )
    const e = r.pipe(
      d,
      map((v) => v + 1)
    )

    const spy = vi.fn()
    r.sub(e, spy)

    r.pub(a, -1)
    expect(spy).toHaveBeenCalledTimes(0)

    r.pub(a, 5)
    expect(spy).toHaveBeenCalledWith(11)

    r.pub(a, 60)
    expect(spy).toHaveBeenCalledTimes(1)

    r.pub(a, 10)
    expect(spy).toHaveBeenCalledWith(21)
  })

  it('pulls values in withLatestFrom', () => {
    const r = new Realm()
    const a = Cell('foo')
    const b = Cell('bar')

    const c = r.pipe(a, withLatestFrom(b))

    const spy = vi.fn()
    r.sub(c, spy)

    r.pub(a, 'baz')
    expect(spy).toHaveBeenCalledWith(['baz', 'bar'])
    r.pub(b, 'qux')
    expect(spy).toHaveBeenCalledTimes(1)
    r.pub(a, 'foo')
    expect(spy).toHaveBeenCalledWith(['foo', 'qux'])
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('maps to fixed value with mapTo', () => {
    const r = new Realm()
    const a = Signal<number>()

    const b = r.pipe(a, mapTo('bar'))

    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 2)
    expect(spy).toHaveBeenCalledWith('bar')
  })

  it('accumulates with scan', () => {
    const r = new Realm()
    const a = Signal<number>()

    const b = r.pipe(
      a,
      scan((acc, value) => acc + value, 1)
    )

    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 2)
    expect(spy).toHaveBeenCalledWith(3)

    r.pub(a, 3)
    expect(spy).toHaveBeenCalledWith(6)
  })

  it('onNext publishes only once, when the trigger signal emits', () => {
    const r = new Realm()
    const a = Signal<number>()
    const b = Signal<number>()

    const c = r.pipe(a, onNext(b))

    const spy = vi.fn()
    r.sub(c, spy)

    r.pub(a, 2)
    expect(spy).toHaveBeenCalledTimes(0)

    r.pub(b, 3)
    expect(spy).toHaveBeenCalledWith([2, 3])
    expect(spy).toHaveBeenCalledTimes(1)

    // next publish should not retrigger the sub
    r.pub(b, 4)
    expect(spy).toHaveBeenCalledTimes(1)

    // a new value should activate the triggering again
    r.pub(a, 2)
    r.pub(b, 4)
    expect(spy).toHaveBeenCalledWith([2, 4])
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('once publishes only once', () => {
    const r = new Realm()
    const a = Signal<number>()
    const b = Signal<number>()

    r.link(r.pipe(a, once()), b)

    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 1)
    r.pub(a, 2)
    expect(spy).toHaveBeenCalledWith(1)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it.skip('throttleTime delays the execution', async () => {
    const r = new Realm()
    const a = Signal<number>()
    const b = r.pipe(a, throttleTime(60))
    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 1)

    await awaitCall(() => {
      r.pub(a, 2)
    }, 20) // +20
    await awaitCall(() => {
      r.pub(a, 3)
    }, 30) // +30
    expect(spy).toHaveBeenCalledTimes(0)
    await awaitCall(noop, 20) // +20 = 80

    expect(spy).toHaveBeenCalledWith(3)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('debounceTime bounces the execution', async () => {
    const r = new Realm()
    const a = Signal<number>()
    const b = r.pipe(a, debounceTime(60))
    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 1)

    await awaitCall(() => {
      r.pub(a, 2)
    }, 20) // +20
    await awaitCall(() => {
      r.pub(a, 3)
    }, 30) // +30
    expect(spy).toHaveBeenCalledTimes(0)
    await awaitCall(noop, 70)

    expect(spy).toHaveBeenCalledWith(3)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('combines node values', () => {
    const r = new Realm()
    const a = Cell<number>(0)
    const b = Cell<number>(0)
    const d = Cell<number>(6)

    const c = r.combine(a, b, d)

    const spy = vi.fn()
    r.sub(c, spy)
    r.pubIn({ [a]: 3, [b]: 4 })
    expect(spy).toHaveBeenCalledWith([3, 4, 6])
    expect(spy).toHaveBeenCalledTimes(1)
    r.pub(d, 7)
    expect(spy).toHaveBeenCalledWith([3, 4, 7])
  })

  it('supports value-less signals', () => {
    const a = Signal()
    const b = Cell(1)
    const r = new Realm()

    r.link(
      r.pipe(
        a,
        withLatestFrom(b),
        map(([, bVal]) => bVal + 1)
      ),
      b
    )
    expect(r.getValue(b)).toBe(1)
    r.pub(a)
    expect(r.getValue(b)).toBe(2)
  })
})
