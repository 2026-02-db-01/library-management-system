import { ArrowRight, CornerDownRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { InteractiveErd } from './InteractiveErd'
import { relationships } from '../../data/metadata/schema'

export function ErDiagram() {
  const navigate = useNavigate()

  return (
    <div className="erd-explorer">
      <div className="erd-overview">
        <div>
          <span className="eyebrow">RELATIONSHIP MAP</span>
          <h2>7개 테이블, 역할이 분리된 참조 관계</h2>
          <p>노드 클릭은 컬럼 정보, 관계선 클릭은 실제 FK 컬럼을 보여줍니다. 노드를 두 번 클릭하면 테이블 상세로 이동합니다.</p>
        </div>
        <span className="erd-key"><i /> FK 관계 <span>·</span> 삭제 제한 RESTRICT</span>
      </div>
      <InteractiveErd density="wide" onNodeActivate={(table) => navigate(`/admin/db-console/tables/${table}`)} />
      <div className="erd-relations-list">
        <div className="erd-relations-header"><CornerDownRight size={16} /><strong>관계와 역할</strong><span>FK 역할별로 구분</span></div>
        {relationships.map((relation) => (
          <div className="erd-relation-row" key={relation.id}>
            <code>{relation.from}.{relation.fromColumn}</code>
            <span className="erd-relation-link"><ArrowRight size={14} /><i>{relation.cardinality}</i></span>
            <code>{relation.to}.{relation.toColumn}</code>
            <span className="erd-relation-role">{relation.role}</span>
            <span className="erd-relation-constraint">{relation.constraint}</span>
          </div>
        ))}
      </div>
      <div className="erd-actor-note">
        <strong>loan → app_user는 세 가지 역할을 보존합니다.</strong>
        <p>`member_user_id`, `checked_out_by_user_id`, `returned_by_user_id`는 모두 `app_user.user_id`를 참조하는 별도 FK입니다. 반납 전 `returned_by_user_id`는 NULL입니다.</p>
      </div>
    </div>
  )
}
