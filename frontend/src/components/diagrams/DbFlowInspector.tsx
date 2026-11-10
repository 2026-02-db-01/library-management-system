import { useMemo } from 'react'
import { ArrowLeft, ArrowRight, Pause, Play, X } from 'lucide-react'
import { InteractiveErd } from './InteractiveErd'
import { Button } from '../ui/Primitives'
import type { DbFlowEvent } from '../../types/domain'

const operationLabel: Record<DbFlowEvent['operation'], string> = {
  SELECT: 'SELECT',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  COMMIT: 'COMMIT',
  ROLLBACK: 'ROLLBACK',
}

function eventsByRun(events: DbFlowEvent[]) {
  const runs = new Map<string, DbFlowEvent[]>()
  for (const event of events) runs.set(event.runId, [...(runs.get(event.runId) ?? []), event])
  return [...runs.entries()]
    .map(([runId, steps]) => ({ runId, steps: steps.sort((a, b) => a.step - b.step) }))
    .sort((a, b) => (b.steps.at(-1)?.createdAt ?? '').localeCompare(a.steps.at(-1)?.createdAt ?? ''))
}

export function DbFlowInspector({
  events,
  selectedEventId,
  onSelectEvent,
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
  reducedMotion,
  onClose,
}: {
  events: DbFlowEvent[]
  selectedEventId: string | null
  onSelectEvent: (eventId: string | null) => void
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  speed: number
  onSpeedChange: (speed: number) => void
  reducedMotion: boolean
  onClose: () => void
}) {
  const runs = useMemo(() => eventsByRun(events), [events])
  const selected = events.find((event) => event.id === selectedEventId) ?? runs[0]?.steps[0]
  const steps = runs.find((run) => run.runId === selected?.runId)?.steps ?? []
  const stepIndex = steps.findIndex((event) => event.id === selected?.id)

  function moveStep(offset: number) {
    const next = steps[stepIndex + offset]
    if (next) onSelectEvent(next.id)
  }

  return (
    <aside className="db-flow-inspector" aria-label="데이터베이스 흐름 검사기">
      <header className="db-flow-inspector-header">
        <div><span className="eyebrow">INTERACTIVE DATABASE FLOW</span><h2>DB Flow Inspector</h2></div>
        <Button variant="quiet" onClick={onClose} aria-label="DB 흐름 보기 닫기" icon={<X size={16} />}>닫기</Button>
      </header>
      <div className="flow-inspector-toolbar">
        <div className="flow-step-controls">
          <button type="button" aria-label="이전 업무 단계" onClick={() => moveStep(-1)} disabled={!steps.length || stepIndex <= 0}><ArrowLeft size={15} /></button>
          <button type="button" className="flow-play-button" aria-label={playing ? '애니메이션 일시정지' : '애니메이션 재생'} onClick={() => {
            if (!playing && selected && stepIndex === steps.length - 1 && steps[0]) onSelectEvent(steps[0].id)
            onPlayingChange(!playing)
          }} disabled={!steps.length || reducedMotion}>
            {playing ? <Pause size={15} /> : <Play size={15} />}{reducedMotion ? '정적 보기' : playing ? '일시정지' : '재생'}
          </button>
          <button type="button" aria-label="다음 업무 단계" onClick={() => moveStep(1)} disabled={!steps.length || stepIndex >= steps.length - 1}><ArrowRight size={15} /></button>
          <span className="flow-step-count">{selected && steps.length ? `${stepIndex + 1} / ${steps.length} 단계` : '기록 대기'}</span>
        </div>
        <label className="flow-speed-control"><span>속도</span><input type="range" min="0.6" max="1.8" step="0.2" value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))} aria-label="ERD 이동 점 속도" /><strong>{speed.toFixed(1)}×</strong></label>
      </div>
      <div className="flow-current-event" aria-live="polite">
        {selected ? <>
          <span className={`operation-chip operation-${selected.operation.toLowerCase()}`}>{operationLabel[selected.operation]}</span>
          <span className="flow-current-table">{selected.tableId ?? 'transaction'}</span>
          <p>{selected.message}</p>
          {selected.columnIds?.length ? <div className="flow-current-columns">컬럼 <code>{selected.columnIds.join(' · ')}</code></div> : null}
          {reducedMotion && <small className="reduced-motion-note">축소 모션 설정: 선택한 관계를 정적으로 강조합니다.</small>}
        </> : <>
          <span className="operation-chip operation-select">SELECT</span>
          <span className="flow-current-table">대기 중</span>
          <p>왼쪽 업무 화면에서 도서를 선택하거나 대출·반납·연장을 진행하면 관련 스키마 단계가 표시됩니다.</p>
        </>}
      </div>
      <div className="flow-diagram-note"><span className="flow-simulation-mark" aria-hidden="true" />시뮬레이션 — PostgreSQL 연결이나 SQL 실행은 없습니다.</div>
      <InteractiveErd density="compact" event={selected} paused={!playing || reducedMotion} speed={speed} className="flow-erd-canvas" />
      {selected && (selected.before !== undefined || selected.after !== undefined) && <details className="flow-record-change"><summary>변경 전 · 후 값 보기</summary><pre>{JSON.stringify({ before: selected.before ?? null, after: selected.after ?? null }, null, 2)}</pre></details>}
    </aside>
  )
}

export function DbFlowTimeline({
  events,
  selectedEventId,
  onSelectEvent,
  collapsed,
  onCollapsedChange,
}: {
  events: DbFlowEvent[]
  selectedEventId: string | null
  onSelectEvent: (eventId: string) => void
  collapsed: boolean
  onCollapsedChange: () => void
}) {
  const runs = useMemo(() => eventsByRun(events).slice(0, 5), [events])
  const latest = events.find((event) => event.id === selectedEventId) ?? runs[0]?.steps[0]

  return (
    <section className={`db-flow-timeline ${collapsed ? 'is-collapsed' : ''}`} aria-label="Database event timeline">
      <header className="db-flow-timeline-header">
        <div><span className="eyebrow">DATABASE EVENT TIMELINE</span><h2>업무 단계와 Mock DB 이벤트</h2><span className="timeline-simulation-tag">시뮬레이션</span></div>
        {collapsed && latest && <div className="timeline-collapsed-summary"><span className={`operation-chip operation-${latest.operation.toLowerCase()}`}>{latest.operation}</span><span>{latest.tableId ?? 'transaction'} · {latest.message}</span></div>}
        <button type="button" onClick={onCollapsedChange} aria-expanded={!collapsed}>{collapsed ? '타임라인 펼치기' : '타임라인 접기'}</button>
      </header>
      {!collapsed && (runs.length ? <div className="db-flow-run-list">
        {runs.map((run) => <section className="db-flow-run" key={run.runId} aria-label={`Mock 실행 ${run.runId}`}>
          <div className="db-flow-run-label"><strong>{new Date(run.steps[0].createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong><span>{run.steps.length} steps</span></div>
          <div className="db-flow-step-list">{run.steps.map((event) => <button type="button" className={`db-flow-step ${selectedEventId === event.id ? 'is-selected' : ''} ${event.status === 'failed' ? 'is-failed' : ''}`} onClick={() => onSelectEvent(event.id)} key={event.id} aria-current={selectedEventId === event.id ? 'step' : undefined}>
            <span className={`operation-chip operation-${event.operation.toLowerCase()}`}>{event.operation}</span>
            <strong>{event.tableId ?? 'transaction'}</strong>
            <small>{event.message}</small>
            <span className={`timeline-step-status ${event.status === 'failed' ? 'status-failed' : selectedEventId === event.id ? 'status-active' : 'status-success'}`}>{event.status === 'failed' ? '실패' : selectedEventId === event.id ? '선택됨' : '완료'}</span>
          </button>)}</div>
        </section>)}
      </div> : <p className="timeline-empty">업무를 수행하면 SELECT, INSERT, UPDATE와 COMMIT/ROLLBACK 단계가 여기에 쌓입니다.</p>)}
    </section>
  )
}
