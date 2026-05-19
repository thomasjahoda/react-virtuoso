import React from 'react'

import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect'

export type CallbackRefParam = HTMLElement | null

export default function useSize(callback: (e: HTMLElement) => void, enabled: boolean, skipAnimationFrame: boolean) {
  return useSizeWithElRef(callback, enabled, skipAnimationFrame).callbackRef
}

export function useSizeWithElRef(callback: (e: HTMLElement) => void, enabled: boolean, skipAnimationFrame: boolean) {
  const ref = React.useRef<CallbackRefParam>(null)

  let callbackRef = (_el: CallbackRefParam) => {
    void 0
  }

  const observer = React.useMemo(() => {
    if (typeof ResizeObserver !== 'undefined') {
      return new ResizeObserver((entries: ResizeObserverEntry[]) => {
        const code = () => {
          const element = entries[0]!.target as HTMLElement
          if (element.offsetParent !== null) {
            callback(element)
          }
        }
        skipAnimationFrame ? code() : requestAnimationFrame(code)
      })
    }
    return null
  }, [callback, skipAnimationFrame])

  callbackRef = (elRef: CallbackRefParam) => {
    if (elRef && enabled) {
      observer?.observe(elRef)
      ref.current = elRef
    } else {
      if (ref.current) {
        observer?.unobserve(ref.current)
      }
      ref.current = null
    }
  }

  // Synchronously measure the element pre-paint to avoid a first-frame blank
  // render. The ResizeObserver fires post-paint (microtask + rAF), so without
  // this the first commit has no viewport height in the stream and the list
  // renders zero items until the observer fires.
  // Subsequent observer publishes with the same value are filtered downstream
  // (viewportHeight uses distinctUntilChanged; rawWindowViewportRect is
  // de-duplicated inside its calculateInfo callback).
  useIsomorphicLayoutEffect(() => {
    if (enabled && ref.current && ref.current.offsetParent !== null) {
      callback(ref.current)
    }
  }, [callback, enabled])

  return { callbackRef, ref }
}
