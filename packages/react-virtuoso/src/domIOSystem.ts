import { ScrollContainerState } from './interfaces'
import * as u from './urx'
import { ceilToStep } from './utils/correctItemSize'

export const domIOSystem = u.system(
  () => {
    const scrollContainerState = u.stream<ScrollContainerState>()
    const scrollTop = u.stream<number>()
    const deviation = u.statefulStream(0)
    const smoothScrollTargetReached = u.stream<true>()
    const statefulScrollTop = u.statefulStream(0)
    const rawViewportHeight = u.stream<number>()
    const viewportHeight = u.stream<number>()
    const scrollHeight = u.stream<number>()
    const headerHeight = u.statefulStream(0)
    const fixedHeaderHeight = u.statefulStream(0)
    const fixedFooterHeight = u.statefulStream(0)
    const footerHeight = u.statefulStream(0)
    const scrollTo = u.stream<ScrollToOptions>()
    const scrollBy = u.stream<ScrollToOptions>()
    const scrollingInProgress = u.statefulStream(false)
    const horizontalDirection = u.statefulStream(false)
    const keepMaximumViewportHeight = u.statefulStream(false)
    const skipAnimationFrameInResizeObserver = u.statefulStream(false)

    let maxKnownViewportHeight = 0
    u.connect(
      u.pipe(
        u.combineLatest(keepMaximumViewportHeight, rawViewportHeight),
        u.map(([keepMaximumViewportHeight, rawViewportHeight]): number => {
          if (!keepMaximumViewportHeight) {
            return rawViewportHeight
          }

          // TODO thomas: [bug?] maybe this hack of how keepMaximumViewportHeight is implemented at the root (also with windowViewportRect which also pipes to viewportHeight) breaks scrollTo functionality because virtuoso has different sizes than the real ones? Scroll logic seems to use actual dimensions anyhow and not the stream values though? not completely sure. Seems to be in useScrollTop for whatever reason I think
          //  Ah, yes it might actually be affected due to scrollToIndexSystem, where rawViewportHeight is actually used. But it also already seems broken, because even without my changes it cannot handle small viewports... Idk what happens there...
          if (maxKnownViewportHeight < rawViewportHeight) {
            maxKnownViewportHeight = rawViewportHeight
          }
          // TODO thomas: [fork-cleanup] add property to do this ceilToStep thing
          return ceilToStep(maxKnownViewportHeight, 100)
        }),
        u.distinctUntilChanged()
      ),
      viewportHeight
    )

    u.connect(
      u.pipe(
        scrollContainerState,
        u.map(({ scrollTop }) => scrollTop)
      ),
      scrollTop
    )

    u.connect(
      u.pipe(
        scrollContainerState,
        u.map(({ scrollHeight }) => scrollHeight)
      ),
      scrollHeight
    )

    u.connect(scrollTop, statefulScrollTop)

    return {
      deviation,
      fixedFooterHeight,
      fixedHeaderHeight,
      footerHeight,
      headerHeight,
      horizontalDirection,
      keepMaximumViewportHeight,
      scrollBy,
      // input
      scrollContainerState,
      scrollHeight,
      scrollingInProgress,
      // signals
      scrollTo,

      scrollTop,
      skipAnimationFrameInResizeObserver,

      smoothScrollTargetReached,
      // state
      statefulScrollTop,
      rawViewportHeight,
      viewportHeight,
    }
  },
  [],
  { singleton: true }
)
