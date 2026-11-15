import type { CatalogFilterValues } from "../../services/catalog";
import { normalizeIsbn } from "../../services/library";
export function CatalogFilters({
  value,
  onChange,
}: {
  value: CatalogFilterValues;
  onChange: (value: CatalogFilterValues) => void;
}) {
  let error = "";
  try {
    normalizeIsbn(value.isbn);
  } catch (e) {
    error = e instanceof Error ? e.message : "ISBN 형식을 확인하세요.";
  }
  return (
    <>
      <details className="catalog-filter-details">
        <summary>상세 검색 · 조건을 모두 만족하는 도서</summary>
        <div className="advanced-search">
          {(["author", "publisher", "isbn", "yearFrom", "yearTo"] as const).map(
            (key, i) => (
              <label key={key}>
                {
                  [
                    "저자",
                    "출판사",
                    "ISBN-10/13 정확검색",
                    "발행연도 시작",
                    "발행연도 종료",
                  ][i]
                }
                <input
                  value={value[key]}
                  onChange={(e) =>
                    onChange({ ...value, [key]: e.target.value })
                  }
                />
              </label>
            ),
          )}
          <label>
            분류
            <select
              value={value.category}
              onChange={(e) => onChange({ ...value, category: e.target.value })}
            >
              <option value="">전체</option>
              <option value="DEMO_GENERAL">합성 데모 일반</option>
            </select>
          </label>
          <label>
            대출 가능 여부
            <select
              value={value.availability}
              onChange={(e) =>
                onChange({ ...value, availability: e.target.value })
              }
            >
              <option value="">전체</option>
              <option value="available">대출 가능</option>
              <option value="unavailable">대출 불가</option>
            </select>
          </label>
        </div>
      </details>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
