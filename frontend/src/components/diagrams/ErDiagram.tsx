import { ArrowRight, CornerDownRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { relationships, tableMetadata, type TableName } from '../../data/metadata/schema'

function TableNode({ name }: { name: TableName }) {
  const table = tableMetadata[name]
  return (
    <Link className="erd-node" to={`/admin/db-console/tables/${name}`}>
      <span><strong>{table.name}</strong><small>{table.label}</small></span>
      <span className="erd-node-columns">{table.columns.length} columns</span>
    </Link>
  )
}

export function ErDiagram() {
  return (
    <div className="erd-explorer">
      <div className="erd-overview">
        <div>
          <span className="eyebrow">RELATIONSHIP MAP</span>
          <h2>7개 테이블, 역할이 분리된 참조 관계</h2>
          <p>노드를 선택하면 해당 테이블의 컬럼과 제약조건을 볼 수 있습니다.</p>
        </div>
        <span className="erd-key"><i /> FK 관계 <span>·</span> 삭제 제한 RESTRICT</span>
      </div>
      <div className="erd-topology">
        <div className="erd-column">
          <TableNode name="author" />
          <TableNode name="app_user" />
        </div>
        <div className="erd-column erd-middle-column">
          <TableNode name="book" />
          <TableNode name="loan" />
        </div>
        <div className="erd-column">
          <TableNode name="book_author" />
          <TableNode name="book_copy" />
          <TableNode name="loan_renewal" />
        </div>
      </div>
      <div className="erd-relations-list">
        <div className="erd-relations-header"><CornerDownRight size={16} /><strong>관계와 역할</strong><span>FK 역할별로 구분</span></div>
        {relationships.map((relation) => (
          <div className="erd-relation-row" key={`${relation.from}-${relation.to}-${relation.label}`}>
            <Link to={`/admin/db-console/tables/${relation.from}`}>{relation.from}</Link>
            <span className="erd-relation-link"><ArrowRight size={14} /><i>{relation.cardinality}</i></span>
            <Link to={`/admin/db-console/tables/${relation.to}`}>{relation.to}</Link>
            <span className="erd-relation-role">{relation.role}</span>
            <code>{relation.label}</code>
          </div>
        ))}
      </div>
      <div className="erd-actor-note">
        <strong>loan → app_user는 세 가지 역할을 보존합니다.</strong>
        <p>대출 회원 `member_user_id`, 대출 처리 사서 `checked_out_by_user_id`, 반납 처리 사서 `returned_by_user_id`를 각각 참조합니다. 반납 전 처리자 FK는 NULL입니다.</p>
      </div>
    </div>
  )
}
