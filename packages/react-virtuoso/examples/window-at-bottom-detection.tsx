import { useRef, useState } from 'react'

import { Virtuoso } from '../src'

import type { VirtuosoHandle } from '../src'

const INITIAL_COUNT = 60

function itemHeight(index: number) {
  return 56 + (index % 4) * 20
}

export function Example() {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [count, setCount] = useState(INITIAL_COUNT)
  const [atBottom, setAtBottom] = useState(false)
  const [bottomHits, setBottomHits] = useState(0)

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '0 24px 48px',
      }}
    >
      <div
        style={{
          margin: '0 auto',
          maxWidth: 720,
          paddingTop: 24,
          position: 'sticky',
          top: 16,
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: '#e2e8f0',
            border: '1px solid #94a3b8',
            color: '#0f172a',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            padding: 16,
          }}
        >
          <strong>Window scroll + atBottomStateChange</strong>
          <span data-testid="at-bottom-state">state: {atBottom ? 'at bottom' : 'away from bottom'}</span>
          <span>bottom hits: {bottomHits}</span>
          <button
            onClick={() => {
              virtuosoRef.current?.scrollToIndex({
                align: 'end',
                index: count - 1,
                behavior: 'auto',
              })
            }}
            style={{ padding: '6px 10px' }}
          >
            Scroll to bottom
          </button>
          <button
            onClick={() => {
              setCount((current) => current + 5)
            }}
            style={{ padding: '6px 10px' }}
          >
            Append 5 items
          </button>
        </div>
      </div>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #bfdbfe',
          margin: '32px auto 24px',
          maxWidth: 720,
          minHeight: 280,
          padding: '32px 24px',
        }}
      >
        <h2 style={{ margin: 0 }}>Offset content above the list</h2>
        <p style={{ lineHeight: 1.5, margin: '12px 0 0' }}>
          Scroll through this intro block first, then continue to the end of the list. The state badge should switch to at bottom once the
          last item reaches the viewport bottom.
        </p>
      </div>

      <div style={{ margin: '0 auto', maxWidth: 720 }}>
        <Virtuoso
          atBottomStateChange={(next) => {
            setAtBottom(next)
            if (next) {
              setBottomHits((current) => current + 1)
            }
          }}
          followOutput={'smooth'}
          initialItemCount={8}
          itemContent={(index) => {
            const height = itemHeight(index)

            return (
              <div
                style={{
                  background: index % 2 === 0 ? '#ffffff' : '#f1f5f9',
                  borderBottom: '1px solid #cbd5e1',
                  boxSizing: 'border-box',
                  height,
                  padding: '16px 20px',
                }}
              >
                <strong>Row {index + 1}</strong>
                <div style={{ color: '#475569' }}>Variable height: {height}px</div>
              </div>
            )
          }}
          ref={virtuosoRef}
          style={{ border: '1px solid #cbd5e1', height: 520 }}
          totalCount={count}
          useWindowScroll
        />
      </div>
    </div>
  )
}
