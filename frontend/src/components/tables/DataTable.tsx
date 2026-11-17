import { useState, type ReactNode } from "react";

export interface DataColumn<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "표시할 데이터가 없습니다.",
}: {
  columns: DataColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  emptyMessage?: string;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null);
  const sorted = sort
    ? [...rows].sort(
        (a, b) =>
          String((a as Record<string, unknown>)[sort.key] ?? "").localeCompare(
            String((b as Record<string, unknown>)[sort.key] ?? ""),
            "ko",
            { numeric: true },
          ) * (sort.asc ? 1 : -1),
      )
    : rows;
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 20)));
  const pageRows = sorted.slice((safePage - 1) * 20, safePage * 20);
  return (
    <>
      <div
        className="table-scroll"
        tabIndex={0}
        aria-label="데이터 표 · 가로 스크롤 가능"
      >
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  className={column.className}
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sort?.key === column.key
                      ? sort.asc
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {rows[0] &&
                  Object.prototype.hasOwnProperty.call(rows[0], column.key) ? (
                    <button
                      className="table-sort"
                      onClick={() => {
                        setSort({
                          key: column.key,
                          asc: sort?.key !== column.key || !sort.asc,
                        });
                        setPage(1);
                      }}
                    >
                      {column.title} ↕
                    </button>
                  ) : (
                    column.title
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td className={column.className} key={column.key}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 20 && (
        <div className="pagination">
          <button
            className="button button-secondary"
            disabled={safePage === 1}
            onClick={() => setPage(safePage - 1)}
          >
            이전
          </button>
          <span>
            {safePage} / {Math.ceil(rows.length / 20)} · {rows.length}건
          </span>
          <button
            className="button button-secondary"
            disabled={safePage * 20 >= rows.length}
            onClick={() => setPage(safePage + 1)}
          >
            다음
          </button>
        </div>
      )}
    </>
  );
}
