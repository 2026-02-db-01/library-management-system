import type { ReactNode } from 'react'

export interface DataColumn<T> {
  key: string
  title: string
  render: (row: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = '표시할 데이터가 없습니다.',
}: {
  columns: DataColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string | number
  emptyMessage?: string
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>{columns.map((column) => <th className={column.className} key={column.key} scope="col">{column.title}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => <td className={column.className} key={column.key}>{column.render(row)}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length} className="table-empty">{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
