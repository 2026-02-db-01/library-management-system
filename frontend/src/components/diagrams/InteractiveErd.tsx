import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { ArrowDownRight, KeyRound, Link2, Table2 } from 'lucide-react'
import { relationships, tableMetadata, tableOrder, type TableName } from '../../data/metadata/schema'
import type { DbFlowEvent } from '../../types/domain'

type TableNodeData = {
  tableId: TableName
  active: boolean
  related: boolean
  highlightedColumns: string[]
}

type RelationshipEdgeData = {
  relationshipId: string
  active: boolean
  animate: boolean
  duration: number
  color: string
  label: string
}

const compactPositions: Record<TableName, { x: number; y: number }> = {
  book: { x: 12, y: 12 },
  author: { x: 428, y: 12 },
  app_user: { x: 220, y: 170 },
  loan_renewal: { x: 428, y: 328 },
  book_author: { x: 220, y: 12 },
  book_copy: { x: 12, y: 170 },
  loan: { x: 428, y: 170 },
}

const phonePositions: Record<TableName, { x: number; y: number }> = {
  book: { x: 12, y: 12 },
  author: { x: 12, y: 170 },
  app_user: { x: 12, y: 328 },
  loan_renewal: { x: 12, y: 486 },
  book_author: { x: 220, y: 91 },
  book_copy: { x: 220, y: 249 },
  loan: { x: 220, y: 407 },
}

const widePositions: Record<TableName, { x: number; y: number }> = {
  book: { x: 28, y: 35 },
  author: { x: 28, y: 240 },
  app_user: { x: 28, y: 445 },
  book_author: { x: 310, y: 108 },
  book_copy: { x: 310, y: 342 },
  loan: { x: 630, y: 342 },
  loan_renewal: { x: 950, y: 342 },
}

const operationColors: Record<DbFlowEvent['operation'], string> = {
  SELECT: '#315f98',
  INSERT: '#28785d',
  UPDATE: '#9a6418',
  COMMIT: '#28785d',
  ROLLBACK: '#a94447',
}

function handleOffset(index: number, count: number) {
  return `${Math.min(78, 36 + index * (36 / Math.max(1, count - 1)))}%`
}

function TableNode({ data, selected }: NodeProps<Node<TableNodeData, 'table'>>) {
  const table = tableMetadata[data.tableId]
  const primary = table.constraints.find((constraint) => constraint.kind === 'PRIMARY KEY')?.columns ?? []
  const foreign = table.columns.filter((column) => column.key === 'FK').map((column) => column.name)
  const previewColumns = table.columns.filter((column) => column.name !== 'password_hash').slice(0, 4)
  const outgoing = relationships.filter((relation) => relation.from === data.tableId)
  const incoming = relationships.filter((relation) => relation.to === data.tableId)

  return (
    <article className={`erd-flow-node ${selected ? 'is-selected' : ''} ${data.active ? 'is-active' : ''} ${data.related ? 'is-related' : ''}`}>
      {outgoing.map((relation, index) => <Handle key={`out-${relation.id}`} id={`source-${relation.id}`} type="source" position={Position.Right} style={{ top: handleOffset(index, outgoing.length) }} />)}
      {incoming.map((relation, index) => <Handle key={`in-${relation.id}`} id={`target-${relation.id}`} type="target" position={Position.Left} style={{ top: handleOffset(index, incoming.length) }} />)}
      <header className="erd-node-heading"><span className="erd-node-mark"><Table2 size={14} /></span><span><strong>{table.name}</strong><small>{table.label}</small></span><ArrowDownRight size={13} /></header>
      <p className="erd-node-description">{table.description}</p>
      <div className="erd-node-keys"><span><KeyRound size={11} /> PK <code>{primary.join(', ') || '—'}</code></span>{foreign.length > 0 && <span><Link2 size={11} /> FK <code>{foreign.join(', ')}</code></span>}</div>
      <div className="erd-node-columns">{previewColumns.map((column) => <span className={data.highlightedColumns.includes(column.name) ? 'column-highlighted' : ''} key={column.name}>{column.name}</span>)}</div>
    </article>
  )
}

function RelationshipEdge(props: EdgeProps<Edge<RelationshipEdgeData, 'foreignKey'>>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data } = props
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.24 })
  const pathId = `erd-path-${id}`
  const color = data?.color ?? '#bbc5d1'

  return (
    <>
      <BaseEdge id={pathId} path={path} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: data?.active ? 2.4 : 1.35, opacity: data?.active ? 1 : 0.72 }} />
      {data?.animate && <circle r="3.2" className="erd-flow-dot" fill={color} aria-hidden="true"><animateMotion dur={`${data.duration}s`} repeatCount="indefinite"><mpath href={`#${pathId}`} /></animateMotion></circle>}
    </>
  )
}

const nodeTypes = { table: TableNode }
const edgeTypes = { foreignKey: RelationshipEdge }

function GraphCanvas({
  canvasId,
  density,
  event,
  onNodeSelect,
  onRelationSelect,
  onNodeActivate,
  selectedRelationId,
  paused,
  speed,
}: {
  canvasId: string
  density: 'compact' | 'wide'
  event?: DbFlowEvent
  onNodeSelect?: (table: TableName) => void
  onRelationSelect?: (id: string) => void
  onNodeActivate?: (table: TableName) => void
  selectedRelationId?: string
  paused: boolean
  speed: number
}) {
  const { fitView, setCenter } = useReactFlow()
  const [isPhoneWidth, setIsPhoneWidth] = useState(() => window.matchMedia('(max-width: 600px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 600px)')
    const update = (event: MediaQueryListEvent) => setIsPhoneWidth(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const canvas = document.getElementById(canvasId)
    if (!canvas) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => fitView({ padding: 0.12, minZoom: density === 'compact' ? 0.48 : 0.62, maxZoom: 1.1, duration: 180 }))
    })
    observer.observe(canvas)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [canvasId, density, fitView])
  const compactLayout = isPhoneWidth ? phonePositions : compactPositions
  const relatedTables = useMemo(() => {
    const relation = relationships.find((item) => item.id === event?.relationId)
    return new Set([event?.tableId, relation?.from, relation?.to].filter(Boolean))
  }, [event?.relationId, event?.tableId])
  const nodeList = useMemo(() => tableOrder.map((tableId) => ({
    id: tableId,
    type: 'table' as const,
    position: density === 'compact' ? compactLayout[tableId] : widePositions[tableId],
    data: {
      tableId,
      active: event?.tableId === tableId,
      related: relatedTables.has(tableId),
      highlightedColumns: event?.tableId === tableId ? event.columnIds ?? [] : [],
    },
  })), [compactLayout, density, event, relatedTables])
  const edgeList = useMemo(() => relationships.map((relation) => {
    const active = event?.relationId === relation.id || selectedRelationId === relation.id
    const color = active ? operationColors[event?.operation ?? 'SELECT'] : '#bac4d0'
    return {
      id: relation.id,
      type: 'foreignKey' as const,
      source: relation.from,
      target: relation.to,
      sourceHandle: `source-${relation.id}`,
      targetHandle: `target-${relation.id}`,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      data: { relationshipId: relation.id, active, animate: active && !paused, duration: 1.45 / speed, color, label: relation.label },
    }
  }), [event?.operation, event?.relationId, paused, selectedRelationId, speed])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData, 'table'>>(nodeList)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<RelationshipEdgeData, 'foreignKey'>>(edgeList)

  useEffect(() => setNodes(nodeList), [nodeList, setNodes])
  useEffect(() => setEdges(edgeList), [edgeList, setEdges])

  const focusTable = useCallback((tableId: TableName) => {
    const position = density === 'compact' ? compactLayout[tableId] : widePositions[tableId]
    setCenter(position.x + 108, position.y + 72, { zoom: density === 'compact' ? 0.88 : 1, duration: 250 })
  }, [compactLayout, density, setCenter])

  const onNodeClick = useCallback((_: MouseEvent, node: Node<TableNodeData, 'table'>) => {
    onNodeSelect?.(node.id as TableName)
    focusTable(node.id as TableName)
  }, [focusTable, onNodeSelect])
  const onNodeDoubleClick = useCallback((_: MouseEvent, node: Node<TableNodeData, 'table'>) => {
    onNodeActivate?.(node.id as TableName)
  }, [onNodeActivate])
  const onEdgeClick = useCallback((_: MouseEvent, edge: Edge<RelationshipEdgeData, 'foreignKey'>) => {
    onRelationSelect?.(edge.id)
  }, [onRelationSelect])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onEdgeClick={onEdgeClick}
      fitView
      fitViewOptions={{ padding: 0.12, minZoom: density === 'compact' ? 0.48 : 0.62, maxZoom: 1.1 }}
      minZoom={0.32}
      maxZoom={1.55}
      nodesConnectable={false}
      aria-label="7개 도서관 테이블과 실제 외래키 관계"
    >
      <Background color="#dce2e9" gap={22} size={1} />
      <Controls showInteractive={false} />
      {density === 'wide' && <MiniMap pannable zoomable nodeColor={(node) => (node.data as TableNodeData | undefined)?.active ? '#315f98' : '#dce2e9'} />}
    </ReactFlow>
  )
}

export function InteractiveErd({
  density = 'wide',
  event,
  onNodeActivate,
  navigateOnSelect = false,
  showMotionControls = false,
  paused = true,
  speed = 1,
  className = '',
}: {
  density?: 'compact' | 'wide'
  event?: DbFlowEvent
  onNodeActivate?: (table: TableName) => void
  navigateOnSelect?: boolean
  showMotionControls?: boolean
  paused?: boolean
  speed?: number
  className?: string
}) {
  const canvasId = useId()
  const [selectedTable, setSelectedTable] = useState<TableName | null>(null)
  const [selectedRelationId, setSelectedRelationId] = useState<string | undefined>()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [localPaused, setLocalPaused] = useState(paused)
  const [animationSpeed, setAnimationSpeed] = useState(speed)
  const isPaused = showMotionControls ? localPaused : paused

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const activeTable = event?.tableId && tableOrder.includes(event.tableId as TableName) ? event.tableId as TableName : selectedTable
  const selectedRelation = relationships.find((relation) => relation.id === selectedRelationId)
  const selectedMetadata = activeTable ? tableMetadata[activeTable] : undefined

  return (
    <div className={`interactive-erd interactive-erd-${density} ${className}`}>
      <div className="interactive-erd-toolbar">
        <div><span className="eyebrow">POSTGRESQL SCHEMA · 7 TABLES</span><strong>외래키 관계 탐색</strong></div>
        {showMotionControls && <div className="erd-motion-controls">
          <button type="button" onClick={() => setLocalPaused((value) => !value)} aria-label={isPaused ? '관계선 이동 재생' : '관계선 이동 일시정지'} title={prefersReducedMotion ? '축소 모션이 설정되어 단계별 정적 강조로 표시됩니다.' : undefined}>
            {prefersReducedMotion ? '정적 강조' : isPaused ? '재생' : '일시정지'}
          </button>
          <label><span className="sr-only">애니메이션 속도</span><input name="relationshipAnimationSpeed" type="range" min="0.6" max="1.8" step="0.2" value={animationSpeed} onChange={(e) => setAnimationSpeed(Number(e.target.value))} aria-label="관계선 애니메이션 속도" /><small>{animationSpeed.toFixed(1)}×</small></label>
        </div>}
      </div>
      <div id={canvasId} className="interactive-erd-canvas" role="region" aria-label="확대, 축소, 이동 가능한 ERD">
        <ReactFlowProvider>
          <GraphCanvas
            canvasId={canvasId}
            density={density}
            event={event}
            paused={isPaused || prefersReducedMotion}
            speed={animationSpeed}
            selectedRelationId={selectedRelationId}
            onNodeSelect={(table) => {
              setSelectedTable(table)
              setSelectedRelationId(undefined)
              if (navigateOnSelect) onNodeActivate?.(table)
            }}
            onRelationSelect={(id) => { setSelectedRelationId(id); setSelectedTable(null) }}
            onNodeActivate={onNodeActivate}
          />
        </ReactFlowProvider>
      </div>
      <div className="interactive-erd-detail" aria-live="polite">
        {selectedRelation ? <>
          <div className="erd-detail-heading"><Link2 size={15} /><strong>{selectedRelation.constraint}</strong><span>FOREIGN KEY</span></div>
          <p><code>{selectedRelation.from}.{selectedRelation.fromColumn}</code>가 <code>{selectedRelation.to}.{selectedRelation.toColumn}</code>를 참조합니다. {selectedRelation.role} · 삭제 시 RESTRICT</p>
        </> : selectedMetadata ? <>
          <div className="erd-detail-heading"><Table2 size={15} /><strong>{selectedMetadata.name}</strong><span>{selectedMetadata.columns.length} COLUMNS</span></div>
          <div className="erd-column-list">{selectedMetadata.columns.map((column) => <span key={column.name}><code>{column.name}</code><small>{column.type}{column.nullable ? ' · NULL' : ' · NOT NULL'}{column.key ? ` · ${column.key}` : ''}</small></span>)}</div>
        </> : <p className="erd-detail-empty">테이블이나 관계선을 선택하면 컬럼과 참조 방향을 볼 수 있습니다.</p>}
        {!selectedRelation && selectedMetadata?.indexes.length ? <div className="erd-index-summary"><KeyRound size={12} /> 인덱스 {selectedMetadata.indexes.map((index) => index.name).join(' · ')}</div> : null}
      </div>
    </div>
  )
}
