import { ArrowDownRight, ArrowRight, ArrowUpRight, BookCopy, BookOpen, Layers3, UsersRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArchitectureDiagram } from '../../components/diagrams/ArchitectureDiagram'
import { InteractiveErd } from '../../components/diagrams/InteractiveErd'
import { CatalogGrid } from '../../components/catalog/TableCard'
import { Badge } from '../../components/ui/Primitives'
import { useLibraryStore } from '../../store/libraryStore'
import { deriveLoanCounts } from '../../services/library'
import type { UserRole } from '../../types/domain'

const roleEntryPoints: { role: UserRole; to: string; label: string; description: string; icon: typeof BookOpen; key: string; action: string }[] = [
  { role: 'MEMBER', to: '/user/books', label: 'USER 로그인', description: '일반 회원으로 도서와 내 대출을 확인합니다.', icon: BookOpen, key: '01', action: '회원 역할 선택' },
  { role: 'LIBRARIAN', to: '/librarian', label: 'LIBRARIAN 로그인', description: '사서로 대출·반납과 회원 확인을 처리합니다.', icon: BookCopy, key: '02', action: '사서 역할 선택' },
  { role: 'ADMIN', to: '/admin', label: 'ADMIN 로그인', description: '관리자로 회원, 도서, 통계를 관리합니다.', icon: UsersRound, key: '03', action: '관리자 역할 선택' },
]

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const books = useLibraryStore((state) => state.books)
  const copies = useLibraryStore((state) => state.copies)
  const loans = useLibraryStore((state) => state.loans)
  const requestRoleSwitch = useLibraryStore((state) => state.requestRoleSwitch)
  const loanCounts = deriveLoanCounts({ loans })
  const requiredRole = (location.state as { requiredRole?: UserRole } | null)?.requiredRole

  function enterRole(role: UserRole, path: string) {
    requestRoleSwitch(role, path)
    navigate(path)
  }

  return (
    <main className="home-page">
      <section className="home-hero shell-width">
        <div className="hero-copy">
          <h1>도서관 통합<br /><em>관리 시스템</em></h1>
          <p>도서 검색부터 대출·반납 관리, 데이터베이스 구조 탐색까지 하나의 시스템에서 확인할 수 있습니다.</p>
          <div className="hero-actions">
            <Link to="/user/books" className="button button-primary"><span>도서 검색 시작</span><ArrowRight size={16} /></Link>
            <a href="#service-areas" className="hero-text-link">서비스 둘러보기 <ArrowDownRight size={15} /></a>
          </div>
          <div className="hero-status"><i aria-hidden="true" /> 로그인 없이 이용하는 인터랙티브 데모</div>
        </div>
        <div className="hero-visual" aria-label="데모 도서관 현재 상태">
          <div className="hero-paper">
            <div className="hero-paper-top"><span>오늘의 서가</span><span>LIBRARY / 01</span></div>
            <div className="book-stack" aria-hidden="true">
              <span className="stack-book stack-book-one"><i /></span>
              <span className="stack-book stack-book-two"><i /></span>
              <span className="stack-book stack-book-three"><i /></span>
              <span className="stack-book stack-book-four"><i /></span>
              <span className="stack-shelf" />
            </div>
            <div className="hero-paper-bottom"><strong>한 권의 책에서<br />데이터의 관계까지</strong></div>
          </div>
          <div className="hero-data-slip">
            <div><span>등록 도서</span><strong>{books.length.toLocaleString('ko-KR')}<small>권</small></strong></div>
            <div><span>실물 소장본</span><strong>{copies.length.toLocaleString('ko-KR')}<small>권</small></strong></div>
            <div><span>현재 대출</span><strong>{loanCounts.active.toLocaleString('ko-KR')}<small>건</small></strong></div>
          </div>
          <span className="hero-visual-index">SSU · 2026</span>
        </div>
      </section>

      <section className="home-services shell-width" id="service-areas">
        <div className="home-section-heading">
          <div><span className="eyebrow">ROLE DEMO · NO PASSWORD</span><h2>데모 역할을 선택하세요</h2></div>
          <p>실제 인증 없이 선택한 역할의 화면으로 이동합니다.<br />모든 화면은 같은 Mock 데이터를 사용합니다.</p>
        </div>
        {requiredRole && <div className="role-required-note" role="status">{requiredRole} 화면을 보려면 해당 데모 역할을 선택하세요.</div>}
        <div className="service-entry-grid role-entry-grid">
          {roleEntryPoints.map(({ role, to, label, description, icon: Icon, key, action }) => (
            <button key={to} type="button" className="service-entry-card" onClick={() => enterRole(role, to)}>
              <div className="service-entry-top"><span>{key}</span><span className="service-entry-icon"><Icon size={19} strokeWidth={1.8} /></span></div>
              <h3>{label}</h3>
              <p>{description}</p>
              <span className="service-entry-action">{action}<ArrowUpRight size={15} /></span>
            </button>
          ))}
        </div>
        <p className="role-demo-disclaimer">이 역할 선택은 프론트엔드 화면 시연이며 실제 인증이나 접근 제어를 제공하지 않습니다.</p>
      </section>

      <section className="home-architecture shell-width" id="architecture">
        <ArchitectureDiagram />
      </section>

      <section className="home-erd-preview shell-width" id="erd-demo">
        <div className="home-section-heading">
          <div><span className="eyebrow">INTERACTIVE ERD · FK MAP</span><h2>데이터 관계를 직접 탐색하세요</h2></div>
          <p>테이블을 클릭하면 메타데이터 상세로 이동합니다.<br />선택 노드에서 관계선을 따라 구조를 확인할 수 있습니다.</p>
        </div>
        <div className="home-erd-panel"><InteractiveErd density="wide" navigateOnSelect onNodeActivate={(table) => navigate(`/schema/${table}`)} /></div>
        <div className="catalog-action-row">
          <span>관계선은 `database/schema.sql`에 정의된 8개 FK만 표시합니다.</span>
          <button className="button button-secondary" type="button" onClick={() => enterRole('ADMIN', '/admin/db-console/erd')}><span>관리자 역할로 DB Console 열기</span><ArrowRight size={15} /></button>
        </div>
      </section>

      <section className="home-catalog shell-width" id="catalog">
        <div className="home-section-heading catalog-section-heading">
          <div><span className="eyebrow">DATABASE CATALOG · 7 TABLES</span><h2>데이터 구조를 살펴보세요</h2></div>
          <div className="catalog-section-summary"><Layers3 size={17} /><span>PostgreSQL 설계 기준</span><Badge tone="blue">SCHEMA VIEW</Badge></div>
        </div>
        <p className="catalog-section-copy">실제 `database/schema.sql`에 정의된 테이블과 키 관계를 기준으로 구성한 읽기 전용 카탈로그입니다.</p>
        <CatalogGrid basePath="/schema" />
        <div className="catalog-action-row">
          <span>각 테이블의 컬럼, 타입, 키, 인덱스와 데모 레코드를 확인할 수 있습니다.</span>
          <Link to="/admin/db-console/catalog" className="button button-secondary"><span>전체 데이터 카탈로그</span><ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="home-footnote shell-width">
        <div className="footnote-mark">01</div>
        <div><strong>설명용 아키텍처 · 로컬 데모 데이터</strong><p>이번 단계는 프론트엔드 프로토타입입니다. 실제 Backend, PostgreSQL, 인증 또는 API에 연결하지 않습니다.</p></div>
      </section>
    </main>
  )
}
