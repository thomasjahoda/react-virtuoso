import type { FC } from 'react'

export const SuspenceTrigger: FC<{ promise: Promise<unknown> }> = ({ promise }) => {
  // oxlint-disable-next-line only-throw-error -- React Suspense pattern
  throw promise
}
