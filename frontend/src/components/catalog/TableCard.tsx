import { ArrowUpRight, KeyRound, Link2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { relationships, tableMetadata, tableOrder, type TableName } from '../../data/metadata/schema'

export function TableCard({ tableName }: { tableName: TableName }) {
  const table = tableMetadata[tableName]
  const related = [...new Set(relationships.flatMap((relation) => {
    if (relation.from === tableName) return [relation.to]
    if (relation.to === tableName) return [relation.from]
    return []
  }))]

  return (
    <Link className="catalog-card" to={`/admin/db-console/tables/${table.name}`}>
      <div className="catalog-card-top">
        <span className="catalog-card-index">{String(tableOrder.indexOf(tableName) + 1).padStart(2, '0')}</span>
        <ArrowUpRight size={17} aria-hidden="true" />
      </div>
      <h3>{table.name}</h3>
      <p>{table.description}</p>
      <div className="catalog-card-meta">
        <span><i aria-hidden="true" /> {table.columns.length} columns</span>
        <span><KeyRound size={13} /> PK</span>
      </div>
      {related.length > 0 && <div className="catalog-card-relations"><Link2 size={13} /><span>{related.join(' · ')}</span></div>}
    </Link>
  )
}

export function CatalogGrid({ tables = tableOrder }: { tables?: TableName[] }) {
  return <div className="catalog-grid">{tables.map((name) => <TableCard key={name} tableName={name} />)}</div>
}
