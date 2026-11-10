import { NavLink, useLocation } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '../ui/Primitives'

export type WorkspaceKey = 'user' | 'librarian' | 'admin' | 'console'

const workspaceConfig: Record<WorkspaceKey, { title: string; english: string; description: string; links: { label: string; to: string; end?: boolean }[] }> = {
  user: {
    title: '유저 서비스',
    english: 'USER SERVICE',
    description: '도서 검색과 내 대출 현황을 확인합니다.',
    links: [{ label: '도서 검색', to: '/user/books' }, { label: '내 대출 현황', to: '/user/loans' }],
  },
  librarian: {
    title: '사서 업무 시스템',
    english: 'LIBRARY DESK',
    description: '대출·반납을 처리하고 연체와 연장 이력을 확인합니다.',
    links: [
      { label: '업무 현황', to: '/librarian', end: true },
      { label: '도서 대출', to: '/librarian/checkout' },
      { label: '도서 반납', to: '/librarian/returns' },
      { label: '연장 이력', to: '/librarian/renewals' },
      { label: '연체 조회', to: '/librarian/overdue' },
    ],
  },
  admin: {
    title: '관리자 대시보드',
    english: 'ADMINISTRATION',
    description: '회원·도서 관리와 업무 통계를 확인합니다.',
    links: [
      { label: '대시보드', to: '/admin', end: true },
      { label: '회원 관리', to: '/admin/members' },
      { label: '도서 관리', to: '/admin/books' },
      { label: 'Authors', to: '/admin/authors' },
      { label: '업무 통계', to: '/admin/statistics' },
    ],
  },
  console: {
    title: 'DB Console',
    english: 'SCHEMA EXPLORER',
    description: '설계 스키마와 관계를 탐색합니다.',
    links: [
      { label: '데이터 카탈로그', to: '/admin/db-console/catalog' },
      { label: 'ERD 관계', to: '/admin/db-console/erd' },
      { label: '제약조건', to: '/admin/db-console/constraints' },
      { label: '데이터 사전', to: '/admin/db-console/dictionary' },
    ],
  },
}

export function WorkspaceLayout({ section, children }: { section: WorkspaceKey; children: ReactNode }) {
  const config = workspaceConfig[section]
  const location = useLocation()

  return (
    <div className={`workspace-shell workspace-${section}`}>
      <aside className="workspace-sidebar" aria-label={`${config.title} 메뉴`}>
        <div className="workspace-sidebar-heading">
          <span className="eyebrow">{config.english}</span>
          <h2>{config.title}</h2>
          <p>{config.description}</p>
        </div>
        <nav className="workspace-nav">
          {config.links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}>
              <span>{link.label}</span><ArrowUpRight size={15} aria-hidden="true" />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Badge tone="blue">DEMO DATA</Badge>
          <p>화면의 변경은 브라우저 내 데모 상태에만 반영됩니다.</p>
        </div>
      </aside>
      <main className="workspace-content" key={location.pathname}>{children}</main>
    </div>
  )
}
