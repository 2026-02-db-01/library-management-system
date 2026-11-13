import { useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Braces, Database, KeyRound, LockKeyhole, Search, ShieldCheck, Table2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { CatalogGrid } from '../../components/catalog/TableCard'
import { ErDiagram } from '../../components/diagrams/ErDiagram'
import { DataTable } from '../../components/tables/DataTable'
import { WorkspaceLayout } from '../../components/layout/WorkspaceLayout'
import { Badge, Button, Card, EmptyState, MetricCard, Notice, PageHeading, SectionHeading } from '../../components/ui/Primitives'
import { dictionary, relationships, tableMetadata, tableOrder, type ConstraintKind, type TableName } from '../../data/metadata/schema'
import { getPreviewRows, type PreviewRow } from '../../services/tablePreview'
import { formatDate } from '../../services/library'
import { useLibraryStore } from '../../store/libraryStore'
import { NotFoundPage } from '../not-found/NotFoundPage'

export function DbConsoleCatalogPage() {
  const constraintCount = tableOrder.reduce((total, tableName) => total + tableMetadata[tableName].constraints.length, 0)
  const foreignKeyCount = tableOrder.reduce((total, tableName) => total + tableMetadata[tableName].constraints.filter((constraint) => constraint.kind === 'FOREIGN KEY').length, 0)
  const indexCount = tableOrder.reduce((total, tableName) => total + tableMetadata[tableName].indexes.length, 0)

  return (
    <WorkspaceLayout section="console">
      <PageHeading eyebrow="DB CONSOLE · CATALOG" title="데이터 카탈로그" description="database/schema.sql에 정의된 PostgreSQL 구조의 읽기 전용 설계 뷰입니다." actions={<Badge tone="blue">SCHEMA SNAPSHOT</Badge>} />
      <div className="metric-grid four">
        <MetricCard label="테이블" value={tableOrder.length} note="물리 모델과 동일" icon={<Table2 size={17} />} tone="navy" />
        <MetricCard label="컬럼" value={tableOrder.reduce((total, name) => total + tableMetadata[name].columns.length, 0)} note="테이블 정의 기준" icon={<Braces size={17} />} tone="blue" />
        <MetricCard label="외래키" value={foreignKeyCount} note="모두 삭제 제한 RESTRICT" icon={<ArrowRight size={17} />} tone="blue" />
        <MetricCard label="인덱스" value={indexCount} note={`${constraintCount}개 테이블 제약조건`} icon={<Database size={17} />} tone="green" />
      </div>
      <Notice tone="warning" title="연결되지 않은 설계 뷰">현재 PostgreSQL에 접속하지 않습니다. 테이블 정의는 저장소의 `database/schema.sql`을 기준으로 작성했습니다.</Notice>
      <div className="catalog-route-actions"><Link to="/admin/db-console/erd" className="button button-secondary">ERD 관계 보기 <ArrowRight size={15} /></Link><Link to="/admin/db-console/constraints" className="button button-quiet">제약조건 탐색</Link></div>
      <SectionHeading title="테이블 목록" description="schema.sql에 정의된 7개 테이블" />
      <CatalogGrid />
    </WorkspaceLayout>
  )
}

export function DbTablePage() {
  const { tableName } = useParams()
  const isKnownTable = tableOrder.includes(tableName as TableName)
  if (!isKnownTable) return <NotFoundPage />
  return <DbTableDetail key={tableName} tableName={tableName as TableName} />
}

export function SchemaMetadataPage() {
  const { tableName } = useParams()
  const isKnownTable = tableOrder.includes(tableName as TableName)
  if (!isKnownTable) return <NotFoundPage />
  const table = tableMetadata[tableName as TableName]
  const related = relationships.filter((relation) => relation.from === table.name || relation.to === table.name)

  return (
    <main className="public-schema-page shell-width">
      <div className="breadcrumb"><Link to="/">홈</Link><ArrowRight size={13} /><Link to="/#catalog">데이터 카탈로그</Link><ArrowRight size={13} /><code>{table.name}</code></div>
      <PageHeading eyebrow={`SCHEMA METADATA · ${table.columns.length} COLUMNS`} title={table.name} description={table.description} actions={<Badge tone="blue">schema.sql 기준</Badge>} />
      <Notice tone="info" title="읽기 전용 메타데이터">이 화면은 스키마 설계 설명입니다. 테이블 행을 조회하거나 SQL을 실행하지 않습니다.</Notice>
      <div className="table-detail-summary"><div><span>한글명</span><strong>{table.label}</strong></div><div><span>컬럼</span><strong>{table.columns.length}</strong></div><div><span>기본키</span><strong>{table.constraints.find((constraint) => constraint.kind === 'PRIMARY KEY')?.columns.join(', ') ?? '없음'}</strong></div><div><span>인덱스</span><strong>{table.indexes.length}</strong></div></div>
      <section className="public-schema-section"><SectionHeading title="컬럼 정의" description="자료형, NULL 허용 여부, 키 및 참조 대상" /><DataTable rows={table.columns} getRowKey={(column) => column.name} columns={[
        { key: 'name', title: '컬럼', render: (column) => <code>{column.name}</code> },
        { key: 'type', title: '자료형', render: (column) => <code>{column.type}</code> },
        { key: 'key', title: '키', render: (column) => column.key ? <Badge tone={column.key === 'PK' ? 'blue' : column.key === 'FK' ? 'amber' : 'neutral'}>{column.key}</Badge> : '—' },
        { key: 'null', title: 'NULL', render: (column) => column.nullable ? '허용' : '불가' },
        { key: 'unique', title: 'UNIQUE', render: (column) => column.key === 'UNIQUE' || table.constraints.some((constraint) => constraint.kind === 'UNIQUE' && constraint.columns.includes(column.name)) ? '예' : '—' },
        { key: 'default', title: '기본값 / 참조', render: (column) => <span className="metadata-reference">{column.defaultValue ?? column.reference ?? '—'}</span> },
        { key: 'description', title: '설명', render: (column) => <span className="metadata-description">{column.description}</span> },
      ]} /></section>
      <section className="public-schema-section"><SectionHeading title="제약조건" description="PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK" /><DataTable rows={table.constraints} getRowKey={(constraint) => constraint.name} columns={[
        { key: 'name', title: '이름', render: (constraint) => <code>{constraint.name}</code> },
        { key: 'kind', title: '유형', render: (constraint) => <Badge tone={constraint.kind === 'PRIMARY KEY' ? 'blue' : constraint.kind === 'FOREIGN KEY' ? 'amber' : 'neutral'}>{constraint.kind}</Badge> },
        { key: 'definition', title: '정의', render: (constraint) => <code className="constraint-definition">{constraint.definition}</code> },
        { key: 'purpose', title: '설명', render: (constraint) => <span className="metadata-description">{constraint.purpose}</span> },
      ]} /></section>
      <section className="public-schema-section"><SectionHeading title="인덱스" description={`${table.indexes.length}개 인덱스`} />{table.indexes.length ? <DataTable rows={table.indexes} getRowKey={(index) => index.name} columns={[
        { key: 'name', title: '이름', render: (index) => <code>{index.name}</code> },
        { key: 'type', title: '유형', render: (index) => `${index.unique ? 'UNIQUE' : 'INDEX'}${index.partial ? ' · PARTIAL' : ''}` },
        { key: 'definition', title: '정의', render: (index) => <code className="constraint-definition">{index.definition}</code> },
        { key: 'purpose', title: '용도', render: (index) => <span className="metadata-description">{index.purpose}</span> },
      ]} /> : <p className="erd-detail-empty">별도 인덱스가 정의되지 않았습니다.</p>}</section>
      <section className="public-schema-section"><SectionHeading title="직접 연결된 테이블" description="실제 외래키 참조 방향" />{related.length ? <div className="public-related-tables">{related.map((relation) => <Link key={relation.id} to={`/schema/${relation.from === table.name ? relation.to : relation.from}`}><span>{relation.from}.{relation.fromColumn} → {relation.to}.{relation.toColumn}</span><small>{relation.role}</small></Link>)}</div> : <p className="erd-detail-empty">직접 연결된 외래키가 없습니다.</p>}</section>
      <div className="public-schema-footer"><Link className="button button-secondary" to="/#erd-demo"><span>인터랙티브 ERD로 돌아가기</span><ArrowRight size={15} /></Link></div>
    </main>
  )
}

function DbTableDetail({ tableName }: { tableName: TableName }) {
  const table = tableMetadata[tableName]
  const data = useLibraryStore(useShallow((state) => ({ users: state.users, books: state.books, authors: state.authors, bookAuthors: state.bookAuthors, copies: state.copies, loans: state.loans, renewals: state.renewals })))
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)
  const safeColumns = table.columns.filter((column) => column.name !== 'password_hash')
  const [visibleColumns, setVisibleColumns] = useState<string[]>(safeColumns.map((column) => column.name))
  const allRows = getPreviewRows(tableName, data)

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    const rows = allRows.filter((row) => !term || Object.values(row).some((value) => String(value ?? 'NULL').toLocaleLowerCase().includes(term)))
    if (!sortBy) return rows
    return [...rows].sort((a, b) => {
      const left = a[sortBy]
      const right = b[sortBy]
      const compare = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''), 'ko')
      return sortDirection === 'asc' ? compare : -compare
    })
  }, [allRows, search, sortBy, sortDirection])
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function toggleSort(columnName: string) {
    if (sortBy === columnName) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortBy(columnName); setSortDirection('asc') }
    setPage(1)
  }

  function toggleColumn(columnName: string) {
    setVisibleColumns((current) => current.includes(columnName) ? current.filter((name) => name !== columnName) : [...current, columnName])
  }

  return (
    <WorkspaceLayout section="console">
      <div className="breadcrumb"><Link to="/admin/db-console/catalog">데이터 카탈로그</Link><ArrowRight size={13} /><code>{table.name}</code></div>
      <PageHeading eyebrow={`TABLE DETAIL · ${table.columns.length} COLUMNS`} title={table.name} description={table.description} actions={<Badge tone="blue">PostgreSQL · DDL 기준</Badge>} />
      <div className="table-detail-summary">
        <div><span>한글명</span><strong>{table.label}</strong></div>
        <div><span>컬럼</span><strong>{table.columns.length}</strong></div>
        <div><span>기본키</span><strong>{table.constraints.find((constraint) => constraint.kind === 'PRIMARY KEY')?.columns.join(', ') ?? '없음'}</strong></div>
        <div><span>제약조건</span><strong>{table.constraints.length}</strong></div>
        <div><span>명시 인덱스</span><strong>{table.indexes.length}</strong></div>
      </div>

      <Card className="table-card schema-column-card">
        <SectionHeading title="컬럼 정의" description="자료형, NULL, 기본값과 키 역할은 schema.sql을 기준으로 합니다." />
        <DataTable rows={table.columns} getRowKey={(column) => column.name} columns={[
          { key: 'column', title: '컬럼명', render: (column) => <span className="table-title-cell"><code>{column.name}</code>{column.reference && <small>{column.reference}</small>}</span> },
          { key: 'type', title: '데이터 타입', render: (column) => <code className="sql-type">{column.type}</code> },
          { key: 'nullable', title: 'NULL 허용', render: (column) => <Badge tone={column.nullable ? 'neutral' : 'blue'}>{column.nullable ? 'YES' : 'NOT NULL'}</Badge> },
          { key: 'default', title: '기본값', render: (column) => column.defaultValue ? <code>{column.defaultValue}</code> : <span className="muted-small">—</span> },
          { key: 'key', title: '키', render: (column) => <span className="key-badges">{column.key && <Badge tone={column.key === 'PK' ? 'blue' : column.key === 'FK' ? 'amber' : 'green'}>{column.key}</Badge>}</span> },
          { key: 'description', title: '설명', render: (column) => <span className="metadata-description">{column.description}</span> },
        ]} />
      </Card>

      <div className="table-detail-two-column">
        <Card className="table-card"><SectionHeading title="제약조건" description="이름과 실제 정의" /><div className="constraint-list">{table.constraints.map((constraint) => <div key={constraint.name}><div className="constraint-list-top"><code>{constraint.name}</code><Badge tone={constraint.kind === 'PRIMARY KEY' ? 'blue' : constraint.kind === 'FOREIGN KEY' ? 'amber' : constraint.kind === 'UNIQUE' ? 'green' : 'neutral'}>{constraint.kind}</Badge></div><code className="constraint-definition">{constraint.definition}</code><p>{constraint.purpose}</p></div>)}</div></Card>
        <Card className="table-card"><SectionHeading title="인덱스" description="schema.sql에 명시된 인덱스" /><div className="index-list">{table.indexes.length ? table.indexes.map((index) => <div className={index.unique && index.partial ? 'partial-index-card' : ''} key={index.name}><div><code>{index.name}</code><span>{index.unique && <Badge tone="blue">UNIQUE</Badge>}{index.partial && <Badge tone="amber">부분 인덱스</Badge>}</span></div><code className="index-definition">{index.definition}</code><p>{index.purpose}</p></div>) : <EmptyState title="추가 인덱스 없음" description="PK·UNIQUE 인덱스는 PostgreSQL이 자동으로 생성합니다." />}</div></Card>
      </div>

      <Card className="table-card data-preview-card">
        <div className="table-card-heading"><SectionHeading title="데이터 미리보기" description={`공유 Mock Store의 ${allRows.length}개 행 · 실제 DB 접속 없음`} /><Badge tone="blue">DEMO ROWS</Badge></div>
        <div className="preview-toolbar">
          <label className="catalog-search-input"><Search size={16} /><span className="sr-only">미리보기 검색</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="행 값 검색" /></label>
          <details className="column-chooser"><summary>컬럼 표시 <ArrowDown size={13} /></summary><div>{safeColumns.map((column) => <label key={column.name}><input type="checkbox" checked={visibleColumns.includes(column.name)} onChange={() => toggleColumn(column.name)} />{column.name}</label>)}</div></details>
          <label className="page-size-picker">행 수 <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value={6}>6</option><option value={10}>10</option><option value={20}>20</option></select></label>
        </div>
        <div className="table-scroll"><table className="data-table preview-table"><thead><tr>{safeColumns.filter((column) => visibleColumns.includes(column.name)).map((column) => <th key={column.name} scope="col"><button className="sort-button" onClick={() => toggleSort(column.name)}>{column.name}{sortBy === column.name ? sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} />}</button></th>)}</tr></thead><tbody>
          {pageRows.length ? pageRows.map((row, rowIndex) => <tr key={`${tableName}-${rowIndex}`}>{safeColumns.filter((column) => visibleColumns.includes(column.name)).map((column) => <td key={column.name}>{renderPreviewValue(row[column.name])}</td>)}</tr>) : <tr><td colSpan={visibleColumns.length || 1} className="table-empty">검색 결과가 없습니다.</td></tr>}
        </tbody></table></div>
        {tableName === 'app_user' && <p className="redaction-note"><LockKeyhole size={13} /> `password_hash`는 민감정보라 미리보기에서 제외했습니다.</p>}
        <div className="table-pagination"><span>{filteredRows.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRows.length)} / ${filteredRows.length}행` : '0행'}</span><div><Button variant="secondary" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>이전</Button><span>{currentPage} / {pageCount}</span><Button variant="secondary" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>다음</Button></div></div>
      </Card>
      <Notice tone="warning" title="읽기 전용 프리뷰">SQL 실행, DB 연결, 변경 쿼리는 제공하지 않습니다. 데이터 미리보기는 Mock Store에서 파생됩니다.</Notice>
    </WorkspaceLayout>
  )
}

function renderPreviewValue(value: PreviewRow[string]) {
  if (value === null || value === undefined) return <span className="null-value">NULL</span>
  if (typeof value === 'string' && value.includes('T') && !Number.isNaN(Date.parse(value))) return formatDate(value)
  return String(value)
}

export function DbErdPage() {
  return <WorkspaceLayout section="console"><PageHeading eyebrow="DB CONSOLE · RELATIONSHIPS" title="ERD 관계 탐색" description="기본키·외래키 연결과 loan의 세 처리 역할을 구분해 확인합니다." actions={<Badge tone="blue">8 FOREIGN KEYS</Badge>} /><ErDiagram /><Notice tone="info" title="이력 기반 상태">대출 중·연체 상태는 별도 테이블에 저장하지 않습니다. `loan.returned_at`, `current_due_date`와 연결된 실물 소장본을 기준으로 계산합니다.</Notice></WorkspaceLayout>
}

export function DbConstraintsPage() {
  const [filter, setFilter] = useState<'ALL' | ConstraintKind>('ALL')
  const allConstraints = tableOrder.flatMap((tableName) => tableMetadata[tableName].constraints.map((constraint) => ({ ...constraint, tableName })))
  const visibleConstraints = filter === 'ALL' ? allConstraints : allConstraints.filter((constraint) => constraint.kind === filter)
  const counts = {
    pk: allConstraints.filter((item) => item.kind === 'PRIMARY KEY').length,
    fk: allConstraints.filter((item) => item.kind === 'FOREIGN KEY').length,
    unique: allConstraints.filter((item) => item.kind === 'UNIQUE').length,
    check: allConstraints.filter((item) => item.kind === 'CHECK').length,
  }

  return (
    <WorkspaceLayout section="console">
      <PageHeading eyebrow="DB CONSOLE · INTEGRITY" title="제약조건 탐색" description="실제 스키마에 정의된 키·검사식·부분 UNIQUE 인덱스가 데이터 무결성을 보장하는 방식을 설명합니다." />
      <div className="metric-grid four">
        <MetricCard label="기본키" value={counts.pk} note="테이블 식별 기준" icon={<KeyRound size={17} />} tone="navy" />
        <MetricCard label="외래키" value={counts.fk} note="모두 ON DELETE RESTRICT" icon={<ArrowRight size={17} />} tone="blue" />
        <MetricCard label="UNIQUE" value={counts.unique + 2} note="제약 3개 + 부분 인덱스 2개" icon={<ShieldCheck size={17} />} tone="green" />
        <MetricCard label="CHECK" value={counts.check} note="형식·역할·날짜 검사" icon={<Braces size={17} />} tone="amber" />
      </div>
      <div className="partial-index-explainer">
        <div className="partial-index-heading"><span className="partial-index-icon"><LockKeyhole size={18} /></span><div><span className="eyebrow">PARTIAL UNIQUE INDEX · ACTIVE LOAN GUARD</span><h2>미반납 대출은 회원당 1건, 소장본당 1건</h2><p>`returned_at IS NULL`인 행에만 UNIQUE를 적용해 현재 중복 대출은 막고, 반납된 과거 이력은 유지합니다.</p></div></div>
        <div className="partial-index-cards">{['uq_loan_active_member', 'uq_loan_active_copy'].map((name) => {
          const index = tableMetadata.loan.indexes.find((item) => item.name === name)
          return index && <div className="partial-index-item" key={name}><code>{index.name}</code><code className="index-definition">{index.definition}</code><p>{index.purpose}</p></div>
        })}</div>
        <div className="partial-index-flow"><span>미반납 LOAN</span><ArrowRight size={15} /><span>부분 UNIQUE 조건 검사</span><ArrowRight size={15} /><strong>동시 대출 중복 차단</strong></div>
      </div>
      <div className="constraint-filter-tabs">{(['ALL', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK'] as const).map((kind) => <button key={kind} className={filter === kind ? 'selected' : ''} onClick={() => setFilter(kind)}>{kind === 'ALL' ? '전체' : kind}<span>{kind === 'ALL' ? allConstraints.length : allConstraints.filter((item) => item.kind === kind).length}</span></button>)}</div>
      <Card className="table-card"><DataTable rows={visibleConstraints} getRowKey={(constraint) => constraint.name} columns={[
        { key: 'name', title: '제약조건명', render: (constraint) => <code>{constraint.name}</code> },
        { key: 'table', title: '테이블', render: (constraint) => <Link className="schema-table-link" to={`/admin/db-console/tables/${constraint.tableName}`}>{constraint.tableName}</Link> },
        { key: 'kind', title: '유형', render: (constraint) => <Badge tone={constraint.kind === 'PRIMARY KEY' ? 'blue' : constraint.kind === 'FOREIGN KEY' ? 'amber' : constraint.kind === 'UNIQUE' ? 'green' : 'neutral'}>{constraint.kind}</Badge> },
        { key: 'definition', title: '정의', render: (constraint) => <code className="constraint-definition">{constraint.definition}</code> },
        { key: 'purpose', title: '설명', render: (constraint) => <span className="metadata-description">{constraint.purpose}</span> },
      ]} /></Card>
      <Notice tone="info" title="삭제 제한">외래키는 모두 `ON DELETE RESTRICT`입니다. 회원·도서·소장본을 물리 삭제하지 않고 비활성 또는 제적 상태로 관리해 대출 이력을 보존합니다.</Notice>
    </WorkspaceLayout>
  )
}

export function DbDictionaryPage() {
  const [query, setQuery] = useState('')
  const items = dictionary.filter((item) => `${item.term} ${item.english} ${item.definition} ${item.table} ${item.columns}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  return (
    <WorkspaceLayout section="console">
      <PageHeading eyebrow="DB CONSOLE · GLOSSARY" title="데이터 사전" description="Wiki 업무 분석·데이터 모델과 물리 스키마에서 사용하는 주요 용어를 연결합니다." />
      <div className="dictionary-toolbar"><label className="catalog-search-input"><Search size={16} /><span className="sr-only">용어 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업무 용어, 영문 명칭, 테이블 검색" /></label><span className="toolbar-count">{items.length}개 용어</span></div>
      {items.length ? <div className="dictionary-grid">{items.map((item) => {
        const relatedTables = item.table.split(',').map((name) => name.trim())
        return <Card className="dictionary-card" key={item.term}><div className="dictionary-term-heading"><div><h2>{item.term}</h2><span>{item.english}</span></div><span className="dictionary-mark">TERM</span></div><p>{item.definition}</p><div className="dictionary-related"><span>관련 테이블</span><div>{relatedTables.map((table) => <Link key={table} to={`/admin/db-console/tables/${table}`}>{table}</Link>)}</div></div><div className="dictionary-columns"><span>관련 컬럼</span><code>{item.columns}</code></div></Card>
      })}</div> : <Card><EmptyState title="일치하는 용어가 없습니다" description="검색어를 바꿔 다시 확인해 주세요." /></Card>}
      <Notice tone="info" title="용어 출처">Wiki의 업무 규칙과 개념·논리·물리 모델에서 사용한 정의를 반영했습니다. 정식 용어 사전 문서는 별도 연결 없이 현재 공개된 Wiki의 표현을 기준으로 정리했습니다.</Notice>
    </WorkspaceLayout>
  )
}
