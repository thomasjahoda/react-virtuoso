import { empty } from './AATree'
import { domIOSystem } from './domIOSystem'
import { propsReadySystem } from './propsReadySystem'
import { scrollToIndexSystem } from './scrollToIndexSystem'
import { sizeSystem } from './sizeSystem'
import * as u from './urx'
import { skipFrames } from './utils/skipFrames'

import type { FlatIndexLocationWithAlign } from './interfaces'

export function getInitialTopMostItemIndexNumber(location: FlatIndexLocationWithAlign | number, totalCount: number): number {
  const lastIndex = totalCount - 1
  const index = typeof location === 'number' ? location : location.index === 'LAST' ? lastIndex : location.index
  return index
}

export const initialTopMostItemIndexSystem = u.system(
  ([{ defaultItemSize, listRefresh, sizes }, { scrollTop }, { scrollTargetReached, scrollToIndex }, { didMount }]) => {
    const scrolledToInitialItem = u.statefulStream(true)
    const initialTopMostItemIndex = u.statefulStream<FlatIndexLocationWithAlign | number>(0)
    const initialItemFinalLocationReached = u.statefulStream(true)

    u.connect(
      u.pipe(
        didMount,
        u.withLatestFrom(initialTopMostItemIndex),
        u.filter(([_, location]) => {
          const nonZero = location != null && location !== 0
          console.debug('[virtuoso initialTopMostItemIndex] didMount filter', { location, nonZero })
          return nonZero
        }),
        u.mapTo(false)
      ),
      scrolledToInitialItem
    )
    u.connect(
      u.pipe(
        didMount,
        u.withLatestFrom(initialTopMostItemIndex),
        u.filter(([_, location]) => location != null && location !== 0),
        u.map(() => {
          console.debug('[virtuoso initialTopMostItemIndex] initialItemFinalLocationReached → false')
          return false as const
        })
      ),
      initialItemFinalLocationReached
    )

    u.subscribe(
      u.pipe(
        u.combineLatest(listRefresh, didMount),
        u.withLatestFrom(scrolledToInitialItem, sizes, defaultItemSize, initialItemFinalLocationReached),
        u.filter(([[, didMount], scrolledToInitialItem, { sizeTree }, defaultItemSize, scrollScheduled]) => {
          const sizeTreeEmpty = empty(sizeTree)
          const hasDefaultSize = u.isDefined(defaultItemSize)
          const pass = didMount && (!sizeTreeEmpty || hasDefaultSize) && !scrolledToInitialItem && !scrollScheduled
          console.debug('[virtuoso initialTopMostItemIndex] scroll-trigger filter', {
            didMount,
            sizeTreeEmpty,
            hasDefaultSize,
            scrolledToInitialItem,
            scrollScheduled,
            pass,
          })
          return pass
        }),
        u.withLatestFrom(initialTopMostItemIndex)
      ),
      ([, initialTopMostItemIndex]) => {
        console.debug('[virtuoso initialTopMostItemIndex] initiating scroll to', initialTopMostItemIndex)
        u.handleNext(scrollTargetReached, () => {
          console.debug('[virtuoso initialTopMostItemIndex] scrollTargetReached → initialItemFinalLocationReached = true')
          u.publish(initialItemFinalLocationReached, true)
        })

        skipFrames(4, () => {
          u.handleNext(scrollTop, () => {
            console.debug('[virtuoso initialTopMostItemIndex] scrollTop changed → scrolledToInitialItem = true')
            u.publish(scrolledToInitialItem, true)
          })
          u.publish(scrollToIndex, initialTopMostItemIndex)
        })
      }
    )

    return {
      initialItemFinalLocationReached,
      initialTopMostItemIndex,
      scrolledToInitialItem,
    }
  },
  u.tup(sizeSystem, domIOSystem, scrollToIndexSystem, propsReadySystem),
  { singleton: true }
)
