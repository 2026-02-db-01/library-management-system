import { useState } from 'react'
import { ArrowDown, ArrowRight, BookOpenCheck, Braces, Database, Server, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ArchitectureDiagram() {
  const [backendOpen, setBackendOpen] = useState(false)

  return (
    <section className="architecture-panel" aria-labelledby="architecture-title">
      <div className="architecture-intro">
        <span className="eyebrow">SYSTEM MAP · DESIGN VIEW</span>
        <h2 id="architecture-title">하나의 서비스, 네 가지 업무 공간</h2>
        <p>화면과 설계 데이터가 어떤 구조로 연결되는지 보여주는 설명용 아키텍처입니다.</p>
      </div>
      <div className="architecture-flow">
        <div className="architecture-node-group">
          <button className="architecture-node frontend-node" onClick={() => document.getElementById('service-areas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <span className="architecture-node-icon"><BookOpenCheck size={19} /></span>
            <span><strong>Frontend</strong><small>React · TypeScript</small></span>
            <span className="node-action">서비스 영역 보기</span>
          </button>
          <div className="architecture-children" aria-label="프론트엔드 서비스 영역">
            <Link to="/user"><UsersRound size={15} /> 유저</Link>
            <Link to="/librarian"><BookOpenCheck size={15} /> 사서</Link>
            <Link to="/admin"><Braces size={15} /> 관리자</Link>
            <Link to="/admin/db-console"><Database size={15} /> DB Console</Link>
          </div>
        </div>
        <div className="architecture-connector" aria-hidden="true"><ArrowRight className="desktop-arrow" size={21} /><ArrowDown className="mobile-arrow" size={18} /><span>업무 데이터 흐름</span></div>
        <div className="architecture-node-group">
          <button className={`architecture-node backend-node ${backendOpen ? 'selected' : ''}`} aria-expanded={backendOpen} onClick={() => setBackendOpen((open) => !open)}>
            <span className="architecture-node-icon"><Server size={19} /></span>
            <span><strong>Backend</strong><small>FastAPI · 예정</small></span>
            <span className="node-status planned">연동 예정</span>
          </button>
        </div>
        <div className="architecture-connector" aria-hidden="true"><ArrowRight className="desktop-arrow" size={21} /><ArrowDown className="mobile-arrow" size={18} /><span>향후 연결</span></div>
        <div className="architecture-node-group">
          <button className="architecture-node postgres-node" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <span className="architecture-node-icon"><Database size={19} /></span>
            <span><strong>PostgreSQL</strong><small>schema.sql 설계 기준</small></span>
            <span className="node-action">카탈로그 보기</span>
          </button>
        </div>
      </div>
      {backendOpen && (
        <div className="architecture-detail" id="architecture-explanation">
          <div><span className="status-dot status-planned" /><strong>백엔드는 현재 구현 범위에 포함되지 않습니다.</strong></div>
          <p>FastAPI는 예정 구성으로 표시했습니다. 이 프로토타입은 브라우저의 Mock Store만 사용하며 서버 요청을 보내지 않습니다.</p>
        </div>
      )}
      <p className="architecture-caption">연결선은 계획된 구조를 설명합니다. 현재 실행 환경에서 Backend 또는 PostgreSQL에 연결되지 않습니다.</p>
    </section>
  )
}
