import type { CSSProperties } from 'react'
import { Virtuoso } from 'react-virtuoso'

const data = Array.from({ length: 100 }, (_, index) => index)

const pageStyle: CSSProperties = {
  background: '#f3f4f6',
  minHeight: '160vh',
  padding: '24px',
}

const listStyle: CSSProperties = {
  background: 'white',
  boxShadow: '0 12px 30px rgb(15 23 42 / 0.12)',
  margin: '0 auto',
  maxWidth: 720,
}

const elementScrollListStyle: CSSProperties = {
  ...listStyle,
  height: 480,
}

const headerStyle: CSSProperties = {
  alignItems: 'center',
  background: '#facc15',
  border: '4px solid #92400e',
  boxSizing: 'border-box',
  color: '#111827',
  display: 'flex',
  fontWeight: 700,
  height: 96,
  padding: '0 24px',
}

const pageHeaderStyle: CSSProperties = {
  ...headerStyle,
  margin: '0 auto',
  maxWidth: 720,
}

function itemStyle(index: number): CSSProperties {
  const isTopItem = index < 2

  return {
    alignItems: 'center',
    background: isTopItem ? '#b91c1c' : index % 2 ? '#f8fafc' : '#ffffff',
    borderBottom: '1px solid #d1d5db',
    boxSizing: 'border-box',
    color: isTopItem ? '#ffffff' : '#1f2937',
    display: 'flex',
    fontWeight: isTopItem ? 700 : 400,
    height: isTopItem ? 72 : 56,
    padding: '0 24px',
  }
}

export const WindowScrollHeaderWithTopItems = () => {
  return (
    <main style={pageStyle}>
      <div style={pageHeaderStyle}>Page header rendered before Virtuoso</div>
      <Virtuoso
        data={data}
        itemContent={(index) => {
          return <div style={itemStyle(index)}>{index < 2 ? `Sticky top item ${index}` : `Item ${index}`}</div>
        }}
        style={listStyle}
        topItemCount={2}
        useWindowScroll
      />
    </main>
  )
}

export const ElementScrollHeaderWithTopItems = () => {
  return (
    <main style={pageStyle}>
      <Virtuoso
        components={{
          Header: () => <div style={headerStyle}>Header rendered through components.Header</div>,
        }}
        data={data}
        itemContent={(index) => {
          return <div style={itemStyle(index)}>{index < 2 ? `Sticky top item ${index}` : `Item ${index}`}</div>
        }}
        style={elementScrollListStyle}
        topItemCount={2}
      />
    </main>
  )
}
