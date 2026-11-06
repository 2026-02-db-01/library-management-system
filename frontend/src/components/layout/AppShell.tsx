import { useState } from 'react'
import { BookOpen, ChevronDown, RotateCcw, Rows3 } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../../store/libraryStore'

const mainLinks = [
  { label: '홈', to: '/', end: true },
  { label: '유저', to: '/user' },
  { label: '사서', to: '/librarian' },
  { label: '관리자', to: '/admin' },
  { label: 'DB Console', to: '/admin/db-console' },
]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const resetDemo = useLibraryStore((state) => state.resetDemo)
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleReset() {
    resetDemo()
    setNotice('데모 상태를 초기 상태로 되돌렸습니다.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  function goTo(value: string) {
    navigate(value)
    setMobileMenuOpen(false)
  }

  return (
    <div className="app-root">
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand-lockup" aria-label="책담 홈으로 이동">
            <span className="brand-symbol"><BookOpen size={20} strokeWidth={2.1} /></span>
            <span><strong>책담</strong><small>LIBRARY SYSTEM</small></span>
          </Link>
          <nav className="top-nav" aria-label="주요 메뉴">
            {mainLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => {
                const selected = link.to === '/admin' && location.pathname.startsWith('/admin/db-console') ? false : isActive
                return `top-nav-link ${selected ? 'active' : ''}`
              }}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-tools">
            <span className="demo-chip"><i aria-hidden="true" /> 데모 모드</span>
            <button className="header-reset" onClick={handleReset} title="데모 데이터를 초기 상태로 되돌립니다.">
              <RotateCcw size={15} /><span>초기화</span>
            </button>
            <button className="mobile-menu-button" aria-expanded={mobileMenuOpen} aria-label="메뉴 열기" onClick={() => setMobileMenuOpen((open) => !open)}>
              <Rows3 size={19} /> <ChevronDown size={13} />
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="mobile-nav" aria-label="모바일 메뉴">
            {mainLinks.map((link) => (
              <button key={link.to} className={location.pathname === link.to ? 'active' : ''} onClick={() => goTo(link.to)}>{link.label}</button>
            ))}
            <button onClick={handleReset}><RotateCcw size={14} /> 데모 초기화</button>
          </nav>
        )}
      </header>
      {notice && <div className="global-toast" role="status">{notice}</div>}
      <Outlet />
      <footer className="site-footer">
        <div><span className="brand-footer-mark"><BookOpen size={16} /></span><strong>책담</strong><span>도서관 통합 관리 시스템</span></div>
        <p>설계 기반 화면 시연 · 실제 API와 데이터베이스 연결 없음</p>
      </footer>
    </div>
  )
}
