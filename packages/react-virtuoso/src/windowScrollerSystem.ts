import { domIOSystem } from './domIOSystem'
import { ScrollContainerState, WindowViewportInfo } from './interfaces'
import * as u from './urx'
import { ceilToStep } from './utils/correctItemSize'

export const windowScrollerSystem = u.system(([{ scrollContainerState, scrollTo, keepMaximumViewportHeight }]) => {
  const windowScrollContainerState = u.stream<ScrollContainerState>()
  const rawWindowViewportRect = u.stream<WindowViewportInfo>()
  const windowViewportRect = u.stream<WindowViewportInfo>()
  const windowScrollTo = u.stream<ScrollToOptions>()
  const useWindowScroll = u.statefulStream(false)
  const customScrollParent = u.statefulStream<HTMLElement | undefined>(undefined)

  // respect keepMaximumViewportHeight to only never shrink the viewport height when set
  let maximumWindowViewportRect: WindowViewportInfo | null = null
  u.connect(
    u.pipe(
      u.combineLatest(keepMaximumViewportHeight, rawWindowViewportRect),
      u.map(([keepMaximumViewportHeight, rawWindowViewportRect]): WindowViewportInfo => {
        if (!keepMaximumViewportHeight) {
          return rawWindowViewportRect
        }

        // TODO thomas: [bug?] maybe this hack of how keepMaximumViewportHeight is implemented at the root breaks scrollTo functionality because virtuoso has different sizes than the real ones? Scroll logic seems to use actual dimensions anyhow and not the stream values though? not completely sure. Seems to be in useScrollTop for whatever reason I think
        //  Ah, yes it might actually be affected due to scrollToIndexSystem, where rawViewportHeight is actually used. But it also already seems broken, because even without my changes it cannot handle small viewports... Idk what happens there...
        if (maximumWindowViewportRect === null) {
          maximumWindowViewportRect = {
            ...rawWindowViewportRect,
            // TODO thomas: [fork-cleanup] add property to do this ceilToStep thing
            visibleHeight: ceilToStep(rawWindowViewportRect.visibleHeight, 100),
          }
        } else {
          if (
            maximumWindowViewportRect.offsetTop !== rawWindowViewportRect.offsetTop ||
            maximumWindowViewportRect.visibleWidth !== rawWindowViewportRect.visibleWidth ||
            maximumWindowViewportRect.visibleHeight < rawWindowViewportRect.visibleHeight
          ) {
            maximumWindowViewportRect = {
              offsetTop: rawWindowViewportRect.offsetTop,
              visibleWidth: rawWindowViewportRect.visibleWidth,
              // TODO thomas: [fork-cleanup] add property to do this ceilToStep thing
              visibleHeight: ceilToStep(Math.max(maximumWindowViewportRect.visibleHeight, rawWindowViewportRect.visibleHeight), 100),
            }
          }
        }
        return maximumWindowViewportRect
      }),
      u.distinctUntilChanged()
    ),
    windowViewportRect
  )

  u.connect(
    u.pipe(
      u.combineLatest(windowScrollContainerState, windowViewportRect),
      u.map(([{ scrollHeight, scrollTop: windowScrollTop, viewportHeight }, { offsetTop }]) => {
        return {
          scrollHeight,
          scrollTop: Math.max(0, windowScrollTop - offsetTop),
          viewportHeight,
        }
      })
    ),
    scrollContainerState
  )

  u.connect(
    u.pipe(
      scrollTo,
      u.withLatestFrom(windowViewportRect),
      u.map(([scrollTo, { offsetTop }]) => {
        return {
          ...scrollTo,
          top: scrollTo.top! + offsetTop,
        }
      })
    ),
    windowScrollTo
  )

  return {
    customScrollParent,
    // config
    useWindowScroll,

    // input
    windowScrollContainerState,
    // signals
    windowScrollTo,

    rawWindowViewportRect,
    windowViewportRect,
  }
}, u.tup(domIOSystem))
