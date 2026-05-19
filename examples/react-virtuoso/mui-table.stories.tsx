import { forwardRef, useMemo } from 'react'
import { TableVirtuoso } from 'react-virtuoso'
import type { TableVirtuosoProps } from 'react-virtuoso'

import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

const TableComponents: NonNullable<TableVirtuosoProps<{ description: string; name: string }, unknown>['components']> = {
  Scroller: forwardRef<HTMLDivElement>((props, ref) => (
    <TableContainer component="div" {...props} ref={ref} sx={{ '& > table': { borderCollapse: 'separate' } }} />
  )),
  Table: (props) => <Table {...props} style={{ borderCollapse: 'separate' }} />,
  TableBody: forwardRef<HTMLTableSectionElement>((props, ref) => <TableBody component="tbody" {...props} ref={ref} />),
  TableHead: forwardRef<HTMLTableSectionElement>((props, ref) => <TableHead component="thead" {...props} ref={ref} />),
  TableRow: (props) => <TableRow {...(props.style ? { style: props.style } : {})}>{props.children}</TableRow>,
}

export const MuiTableExample = () => {
  const users = useMemo(
    () =>
      Array.from({ length: 100 }, (_, index) => ({
        description: `${index} description`,
        name: `User ${index}`,
      })),
    []
  )

  return (
    <TableVirtuoso
      components={TableComponents}
      data={users}
      fixedHeaderContent={() => (
        <TableRow>
          <TableCell style={{ background: 'white', width: 150 }}>Name</TableCell>
          <TableCell style={{ background: 'white' }}>Description</TableCell>
        </TableRow>
      )}
      itemContent={(_index, user) => (
        <>
          <TableCell style={{ background: 'white', width: 150 }}>{user.name}</TableCell>
          <TableCell style={{ background: 'white' }}>{user.description}</TableCell>
        </>
      )}
      style={{ height: '100%' }}
    />
  )
}
