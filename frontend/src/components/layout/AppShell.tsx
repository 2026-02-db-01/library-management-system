import { useEffect, useRef, useState, lazy, Suspense } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  Activity,
  ChevronDown,
  RotateCcw,
  Rows3,
} from "lucide-react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
const DbFlowInspector = lazy(() =>
  import("../diagrams/DbFlowInspector").then((m) => ({
    default: m.DbFlowInspector,
  })),
);
const DbFlowTimeline = lazy(() =>
  import("../diagrams/DbFlowInspector").then((m) => ({
    default: m.DbFlowTimeline,
  })),
);
import { useLibraryStore } from "../../store/libraryStore";
import { LibraryNav } from "./LibraryNav";

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const syncState = useLibraryStore((state) => state.syncState);
  const role = useLibraryStore((state) => state.currentUser?.role ?? null);
  const dataError = useLibraryStore((state) => state.dataError);
  const events = useLibraryStore((state) => state.dbFlowEvents);
  const [notice, setNotice] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [mobileFlowTab, setMobileFlowTab] = useState<"work" | "erd">("work");
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [leftPaneRatio, setLeftPaneRatio] = useState(55);
  const [selectedFlowEventId, setSelectedFlowEventId] = useState<string | null>(
    null,
  );
  const [flowPlaying, setFlowPlaying] = useState(false);
  const [flowSpeed, setFlowSpeed] = useState(1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const dragPointerId = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
      if (event.matches) setFlowPlaying(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    return useLibraryStore.subscribe((state, previous) => {
      const runId = state.dbFlowEvents[0]?.runId;
      if (runId === previous.dbFlowEvents[0]?.runId) return;
      const first = runId
        ? state.dbFlowEvents
            .filter((event) => event.runId === runId)
            .sort((a, b) => a.step - b.step)[0]
        : undefined;
      setSelectedFlowEventId(first?.id ?? null);
      setFlowPlaying(
        Boolean(first) && !prefersReducedMotion && first?.status !== "failed",
      );
    });
  }, [prefersReducedMotion]);

  const activeFlowEventId = events.some(
    (event) => event.id === selectedFlowEventId,
  )
    ? selectedFlowEventId
    : (events[0]?.id ?? null);

  useEffect(() => {
    if (!flowOpen || !flowPlaying || prefersReducedMotion || !activeFlowEventId)
      return;
    const selected = events.find((event) => event.id === activeFlowEventId);
    if (!selected) return;
    if (selected.status === "failed") return;
    const steps = events
      .filter((event) => event.runId === selected.runId)
      .sort((a, b) => a.step - b.step);
    const index = steps.findIndex((event) => event.id === selected.id);
    const next = steps[index + 1];
    const timeout = window.setTimeout(() => {
      if (next) {
        setSelectedFlowEventId(next.id);
        if (next.status === "failed") setFlowPlaying(false);
      } else setFlowPlaying(false);
    }, 1250 / flowSpeed);
    return () => window.clearTimeout(timeout);
  }, [
    activeFlowEventId,
    events,
    flowOpen,
    flowPlaying,
    flowSpeed,
    prefersReducedMotion,
  ]);

  async function handleReset() {
    try {
      await syncState();
    } catch {
      return;
    }
    setFlowOpen(false);
    setMobileFlowTab("work");
    navigate("/");
    setNotice("서버 DB의 최신 상태로 동기화했습니다.");
    window.setTimeout(() => setNotice(""), 3500);
  }

  async function logout() {
    try {
      await useLibraryStore.getState().logout();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "로그아웃에 실패했습니다.");
      return;
    }
    setNotice("");
    setMobileMenuOpen(false);
    navigate("/");
  }

  function onResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragPointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onResizePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragPointerId.current !== event.pointerId) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    setLeftPaneRatio(
      Math.min(
        72,
        Math.max(36, ((event.clientX - bounds.left) / bounds.width) * 100),
      ),
    );
  }

  function onResizePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragPointerId.current === event.pointerId) dragPointerId.current = null;
  }

  function onResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setLeftPaneRatio((ratio) => Math.max(36, ratio - 3));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setLeftPaneRatio((ratio) => Math.min(72, ratio + 3));
    }
  }

  function selectTimelineEvent(eventId: string | null) {
    setSelectedFlowEventId(eventId);
    setFlowPlaying(false);
  }

  const flowStyle = flowOpen
    ? {
        gridTemplateColumns: `${leftPaneRatio}fr 12px ${100 - leftPaneRatio}fr`,
      }
    : undefined;

  return (
    <div className="app-root">
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand-lockup">
            <span className="brand-symbol">
              <img src="/chaekdam-brand.png" alt="" />
            </span>
            <span>
              <strong>책담</strong>
              <small>LIBRARY SYSTEM</small>
            </span>
          </Link>
          <LibraryNav role={role} />
          <div className="header-tools">
            {role && (
              <button className="header-reset" onClick={logout}>
                로그아웃
              </button>
            )}
            <Link
              className="top-nav-link"
              to={role ? "/account" : "/signup"}
            >
              {role ? "내 계정" : "회원가입"}
            </Link>
            {!role && (
              <Link className="top-nav-link" to="/login">
                로그인
              </Link>
            )}
            <button
              type="button"
              className={`flow-toggle ${flowOpen ? "active" : ""}`}
              aria-label="DB 흐름 보기"
              aria-pressed={flowOpen}
              onClick={() => {
                setFlowOpen((open) => !open);
                setMobileFlowTab("work");
              }}
            >
              <Activity size={15} />
              <span>DB 흐름 보기</span>
            </button>
            <button
              className="header-reset"
              onClick={handleReset}
              title="서버 DB의 최신 상태를 다시 불러옵니다."
            >
              <RotateCcw size={15} />
              <span>새로고침</span>
            </button>
            <button
              className="mobile-menu-button"
              aria-expanded={mobileMenuOpen}
              aria-label="메뉴 열기"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Rows3 size={19} /> <ChevronDown size={13} />
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="mobile-nav">
            <LibraryNav
              role={role}
              mobile
              onNavigate={() => setMobileMenuOpen(false)}
            />
            {role ? (
              <button onClick={logout}>로그아웃</button>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  로그인
                </Link>
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                  회원가입
                </Link>
              </>
            )}
            <button onClick={handleReset}>데이터 새로고침</button>
          </div>
        )}
      </header>
      {dataError && <p className="global-toast" role="alert">{dataError}</p>}
      {notice && (
        <div className="global-toast" role="status">
          {notice}
        </div>
      )}
      <div
        className={`app-content ${flowOpen ? "flow-open" : ""}`}
        style={flowStyle}
        data-mobile-pane={mobileFlowTab}
      >
        {flowOpen ? (
          <>
            <div
              className="flow-mobile-tabs"
              role="tablist"
              aria-label="흐름 보기 패널"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mobileFlowTab === "work"}
                onClick={() => setMobileFlowTab("work")}
              >
                업무 화면
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileFlowTab === "erd"}
                onClick={() => setMobileFlowTab("erd")}
              >
                ERD 흐름
              </button>
            </div>
            <section className="flow-work-pane" aria-label="기존 업무 화면">
              <Outlet />
            </section>
            <div
              className="flow-resizer"
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label="업무 화면과 ERD 사이즈 조절"
              aria-valuemin={36}
              aria-valuemax={72}
              aria-valuenow={Math.round(leftPaneRatio)}
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
              onKeyDown={onResizeKeyDown}
            />
            <Suspense
              fallback={<aside role="status">DB 흐름을 불러오는 중…</aside>}
            >
              <DbFlowInspector
                events={events}
                selectedEventId={activeFlowEventId}
                onSelectEvent={selectTimelineEvent}
                playing={flowPlaying}
                onPlayingChange={setFlowPlaying}
                speed={flowSpeed}
                onSpeedChange={setFlowSpeed}
                reducedMotion={prefersReducedMotion}
                onClose={() => {
                  setFlowOpen(false);
                  setMobileFlowTab("work");
                }}
              />
            </Suspense>
            <div className="flow-timeline-wrap">
              <Suspense fallback={<p role="status">타임라인을 불러오는 중…</p>}>
                <DbFlowTimeline
                  events={events}
                  selectedEventId={activeFlowEventId}
                  onSelectEvent={selectTimelineEvent}
                  collapsed={timelineCollapsed}
                  onCollapsedChange={() =>
                    setTimelineCollapsed((value) => !value)
                  }
                />
              </Suspense>
            </div>
          </>
        ) : (
          <Outlet />
        )}
      </div>
      <footer className="site-footer">
        <div>
          <span className="brand-footer-mark">
            <img src="/chaekdam-brand.png" alt="" />
          </span>
          <strong>책담</strong>
          <span>도서관 통합 관리 시스템</span>
        </div>
        <p>
          {location.pathname === "/" ? (
            <>
              <Link to="/#library-guide">이용 안내</Link> ·{" "}
              <Link to="/signup">회원가입</Link> · FastAPI & PostgreSQL 연동
            </>
          ) : (
            "책담 도서관 통합 관리 시스템 · FastAPI & PostgreSQL 연동"
          )}
        </p>
      </footer>
    </div>
  );
}