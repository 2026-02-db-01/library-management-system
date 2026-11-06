import { ArrowDownRight, ArrowRight, ArrowUpRight, BookCopy, BookOpen, Database, Layers3, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ArchitectureDiagram } from '../../components/diagrams/ArchitectureDiagram'
import { CatalogGrid } from '../../components/catalog/TableCard'
import { Badge } from '../../components/ui/Primitives'
import { useLibraryStore } from '../../store/libraryStore'
import { deriveLoanCounts } from '../../services/library'

const entryPoints = [
  { to: '/user', label: '유저 서비스', description: '도서를 찾고 내 대출 현황을 확인합니다.', icon: BookOpen, key: '01', action: '도서 검색으로 이동' },
  { to: '/librarian', label: '사서 업무 시스템', description: '대출·반납과 연장 업무를 처리합니다.', icon: BookCopy, key: '02', action: '업무 현황 보기' },
  { to: '/admin', label: '관리자 대시보드', description: '회원과 장서, 업무 통계를 관리합니다.', icon: UsersRound, key: '03', action: '관리 화면 열기' },
  { to: '/admin/db-console', label: 'DB Console', description: '테이블 구조와 관계를 설계 기준으로 탐색합니다.', icon: Database, key: '04', action: '스키마 탐색하기' },
]

export function HomePage() {
  const books = useLibraryStore((state) => state.books)
  const copies = useLibraryStore((state) => state.copies)
  const loans = useLibraryStore((state) => state.loans)
  const loanCounts = deriveLoanCounts({ loans })

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
          <div><span className="eyebrow">START HERE · 4 AREAS</span><h2>필요한 업무 공간으로 이동하세요</h2></div>
          <p>각 영역은 같은 데모 데이터를 공유합니다.<br />사서 처리 결과는 유저 화면과 통계에도 반영됩니다.</p>
        </div>
        <div className="service-entry-grid">
          {entryPoints.map(({ to, label, description, icon: Icon, key, action }) => (
            <Link key={to} to={to} className="service-entry-card">
              <div className="service-entry-top"><span>{key}</span><span className="service-entry-icon"><Icon size={19} strokeWidth={1.8} /></span></div>
              <h3>{label}</h3>
              <p>{description}</p>
              <span className="service-entry-action">{action}<ArrowUpRight size={15} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-architecture shell-width" id="architecture">
        <ArchitectureDiagram />
      </section>

      <section className="home-catalog shell-width" id="catalog">
        <div className="home-section-heading catalog-section-heading">
          <div><span className="eyebrow">DATABASE CATALOG · 7 TABLES</span><h2>데이터 구조를 살펴보세요</h2></div>
          <div className="catalog-section-summary"><Layers3 size={17} /><span>PostgreSQL 설계 기준</span><Badge tone="blue">SCHEMA VIEW</Badge></div>
        </div>
        <p className="catalog-section-copy">실제 `database/schema.sql`에 정의된 테이블과 키 관계를 기준으로 구성한 읽기 전용 카탈로그입니다.</p>
        <CatalogGrid />
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
