import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { Activity, BookOpen, ChevronDown, RotateCcw, Rows3 } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { DbFlowInspector, DbFlowTimeline } from '../diagrams/DbFlowInspector'
import { useLibraryStore } from '../../store/libraryStore'
import type { UserRole } from '../../types/domain'

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const resetDemo = useLibraryStore((state) => state.resetDemo)
  const demoRole = useLibraryStore((state) => state.demoRole)
  const users = useLibraryStore((state) => state.users)
  const demoLibrarianId = useLibraryStore((state) => state.demoLibrarianId)
  const requestRoleSwitch = useLibraryStore((state) => state.requestRoleSwitch)
  const completeRoleSwitch = useLibraryStore((state) => state.completeRoleSwitch)
  const roleSwitchTarget = useLibraryStore((state) => state.roleSwitchTarget)
  const setDemoLibrarian = useLibraryStore((state) => state.setDemoLibrarian)
  const events = useLibraryStore((state) => state.dbFlowEvents)
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [mobileFlowTab, setMobileFlowTab] = useState<'work' | 'erd'>('work')
  const [timelineCollapsed, setTimelineCollapsed] = useState(false)
  const [leftPaneRatio, setLeftPaneRatio] = useState(55)
  const [selectedFlowEventId, setSelectedFlowEventId] = useState<string | null>(null)
  const [flowPlaying, setFlowPlaying] = useState(false)
  const [flowSpeed, setFlowSpeed] = useState(1)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const dragPointerId = useRef<number | null>(null)
  const activeRole = demoRole

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
      if (event.matches) setFlowPlaying(false)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!roleSwitchTarget || location.pathname !== roleSwitchTarget) return
    completeRoleSwitch()
  }, [completeRoleSwitch, location.pathname, roleSwitchTarget])

  useEffect(() => {
    return useLibraryStore.subscribe((state, previous) => {
      const runId = state.dbFlowEvents[0]?.runId
      if (runId === previous.dbFlowEvents[0]?.runId) return
      const first = runId ? state.dbFlowEvents.filter((event) => event.runId === runId).sort((a, b) => a.step - b.step)[0] : undefined
      setSelectedFlowEventId(first?.id ?? null)
      setFlowPlaying(Boolean(first) && !prefersReducedMotion && first?.status !== 'failed')
    })
  }, [prefersReducedMotion])

  const activeFlowEventId = events.some((event) => event.id === selectedFlowEventId) ? selectedFlowEventId : events[0]?.id ?? null

  useEffect(() => {
    if (!flowOpen || !flowPlaying || prefersReducedMotion || !activeFlowEventId) return
    const selected = events.find((event) => event.id === activeFlowEventId)
    if (!selected) return
    if (selected.status === 'failed') return
    const steps = events.filter((event) => event.runId === selected.runId).sort((a, b) => a.step - b.step)
    const index = steps.findIndex((event) => event.id === selected.id)
    const next = steps[index + 1]
    const timeout = window.setTimeout(() => {
      if (next) {
        setSelectedFlowEventId(next.id)
        if (next.status === 'failed') setFlowPlaying(false)
      }
      else setFlowPlaying(false)
    }, 1250 / flowSpeed)
    return () => window.clearTimeout(timeout)
  }, [activeFlowEventId, events, flowOpen, flowPlaying, flowSpeed, prefersReducedMotion])

  function handleReset() {
    resetDemo()
    setFlowOpen(false)
    setMobileFlowTab('work')
    navigate('/')
    setNotice('데모 상태를 초기 상태로 되돌렸습니다.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  function goTo(value: string) {
    navigate(value)
    setMobileMenuOpen(false)
  }

  function enterRole(role: UserRole) {
    const route = role === 'MEMBER' ? '/user/books' : role === 'LIBRARIAN' ? '/librarian' : '/admin'
    requestRoleSwitch(role, route)
    navigate(route)
    setMobileMenuOpen(false)
  }

  function onResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragPointerId.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onResizePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragPointerId.current !== event.pointerId) return
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!bounds) return
    setLeftPaneRatio(Math.min(72, Math.max(36, ((event.clientX - bounds.left) / bounds.width) * 100)))
  }

  function onResizePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragPointerId.current === event.pointerId) dragPointerId.current = null
  }

  function onResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setLeftPaneRatio((ratio) => Math.max(36, ratio - 3)) }
    if (event.key === 'ArrowRight') { event.preventDefault(); setLeftPaneRatio((ratio) => Math.min(72, ratio + 3)) }
  }

  function selectTimelineEvent(eventId: string) {
    setSelectedFlowEventId(eventId)
    setFlowPlaying(false)
  }

  const flowStyle = flowOpen ? { gridTemplateColumns: `${leftPaneRatio}fr 12px ${100 - leftPaneRatio}fr` } : undefined

  return (
    <div className="app-root">
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand-lockup">
            <span className="brand-symbol"><BookOpen size={20} strokeWidth={2.1} /></span>
            <span><strong>책담</strong><small>LIBRARY SYSTEM</small></span>
          </Link>
          <nav className="top-nav" aria-label="주요 메뉴">
            <NavLink to="/" end className={({ isActive }) => `top-nav-link ${isActive ? 'active' : ''}`}>홈</NavLink>
            <button type="button" onClick={() => enterRole('MEMBER')} className={`top-nav-link ${activeRole === 'MEMBER' ? 'active' : ''}`}>USER</button>
            <button type="button" onClick={() => enterRole('LIBRARIAN')} className={`top-nav-link ${activeRole === 'LIBRARIAN' ? 'active' : ''}`}>사서</button>
            <button type="button" onClick={() => enterRole('ADMIN')} className={`top-nav-link ${activeRole === 'ADMIN' ? 'active' : ''}`}>관리자</button>
            {demoRole === 'ADMIN' && <NavLink to="/admin/db-console" className={({ isActive }) => `top-nav-link ${isActive || location.pathname.startsWith('/admin/db-console') ? 'active' : ''}`}>DB Console</NavLink>}
          </nav>
          <div className="header-tools">
            <span className="demo-chip"><i aria-hidden="true" /> {demoRole ? `DEMO · ${demoRole}` : '역할 선택'}</span>
            {demoRole === 'LIBRARIAN' && <label className="header-librarian-select"><span className="sr-only">데모 사서 ID</span><select aria-label="데모 사서 선택" value={demoLibrarianId} onChange={(event) => setDemoLibrarian(Number(event.target.value))}>{users.filter((user) => user.role === 'LIBRARIAN').map((user) => <option value={user.userId} key={user.userId}>{user.fullName} · {user.userId}</option>)}</select></label>}
            <button type="button" className={`flow-toggle ${flowOpen ? 'active' : ''}`} aria-label="DB 흐름 보기" aria-pressed={flowOpen} onClick={() => { setFlowOpen((open) => !open); setMobileFlowTab('work') }}><Activity size={15} /><span>DB 흐름 보기</span></button>
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
            <button className={location.pathname === '/' ? 'active' : ''} onClick={() => goTo('/')}>홈</button>
            <button className={demoRole === 'MEMBER' ? 'active' : ''} onClick={() => enterRole('MEMBER')}>USER 역할</button>
            <button className={demoRole === 'LIBRARIAN' ? 'active' : ''} onClick={() => enterRole('LIBRARIAN')}>사서 역할</button>
            <button className={demoRole === 'ADMIN' ? 'active' : ''} onClick={() => enterRole('ADMIN')}>관리자 역할</button>
            {demoRole === 'ADMIN' && <button onClick={() => goTo('/admin/db-console')}>DB Console</button>}
            <button onClick={handleReset}><RotateCcw size={14} /> 데모 초기화</button>
          </nav>
        )}
      </header>
      {notice && <div className="global-toast" role="status">{notice}</div>}
      <div className={`app-content ${flowOpen ? 'flow-open' : ''}`} style={flowStyle} data-mobile-pane={mobileFlowTab}>
        {flowOpen ? <>
          <div className="flow-mobile-tabs" role="tablist" aria-label="흐름 보기 패널">
            <button type="button" role="tab" aria-selected={mobileFlowTab === 'work'} onClick={() => setMobileFlowTab('work')}>업무 화면</button>
            <button type="button" role="tab" aria-selected={mobileFlowTab === 'erd'} onClick={() => setMobileFlowTab('erd')}>ERD 흐름</button>
          </div>
          <section className="flow-work-pane" aria-label="기존 업무 화면"><Outlet /></section>
          <div className="flow-resizer" role="separator" tabIndex={0} aria-orientation="vertical" aria-label="업무 화면과 ERD 사이즈 조절" aria-valuemin={36} aria-valuemax={72} aria-valuenow={Math.round(leftPaneRatio)} onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} onKeyDown={onResizeKeyDown} />
          <DbFlowInspector
            events={events}
            selectedEventId={activeFlowEventId}
            onSelectEvent={selectTimelineEvent}
            playing={flowPlaying}
            onPlayingChange={setFlowPlaying}
            speed={flowSpeed}
            onSpeedChange={setFlowSpeed}
            reducedMotion={prefersReducedMotion}
            onClose={() => { setFlowOpen(false); setMobileFlowTab('work') }}
          />
          <div className="flow-timeline-wrap"><DbFlowTimeline events={events} selectedEventId={activeFlowEventId} onSelectEvent={selectTimelineEvent} collapsed={timelineCollapsed} onCollapsedChange={() => setTimelineCollapsed((value) => !value)} /></div>
        </> : <Outlet />}
      </div>
      <footer className="site-footer">
        <div><span className="brand-footer-mark"><BookOpen size={16} /></span><strong>책담</strong><span>도서관 통합 관리 시스템</span></div>
        <p>설계 기반 화면 시연 · 실제 API와 데이터베이스 연결 없음</p>
      </footer>
    </div>
  )
}
