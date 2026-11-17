import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { UserRole } from "../../types/domain";
import "./library-nav.css";

type Item = { label: string; to: string; role?: UserRole };
type Group = { label: string; items: Item[]; role?: UserRole };
const groups: Group[] = [
  { label: "도서 검색", items: [{ label: "도서 검색", to: "/user/books", role: "MEMBER" }, { label: "상세 검색", to: "/user/books?advanced=1", role: "MEMBER" }] },
  { label: "내 서재", items: [{ label: "내 대출 현황", to: "/user/loans", role: "MEMBER" }, { label: "이용 이력", to: "/user/loans", role: "MEMBER" }, { label: "내 계정", to: "/account", role: "MEMBER" }] },
  { label: "이용 안내", items: [{ label: "도서관 이용 안내", to: "/#library-guide" }] },
  { label: "회원정보", items: [{ label: "회원가입", to: "/signup" }, { label: "내 정보 수정", to: "/account", role: "MEMBER" }] },
  { label: "사서 업무", role: "LIBRARIAN", items: [{ label: "업무 현황", to: "/librarian" }, { label: "도서 대출", to: "/librarian/checkout" }, { label: "도서 반납", to: "/librarian/returns" }, { label: "도서 관리", to: "/librarian/books" }, { label: "저자 관리", to: "/librarian/authors" }, { label: "소장본 상태", to: "/librarian/copies" }, { label: "대출·반납 정정", to: "/librarian/corrections" }, { label: "연체 조회", to: "/librarian/overdue" }] },
  { label: "운영 관리", role: "ADMIN", items: [{ label: "운영 대시보드", to: "/admin" }, { label: "직원 계정 관리", to: "/admin/members" }, { label: "직원 변경 이력", to: "/admin/history" }, { label: "통계", to: "/admin/statistics" }] },
  { label: "DB 구조", role: "ADMIN", items: [{ label: "ERD", to: "/admin/db-console/erd" }, { label: "테이블 카탈로그", to: "/admin/db-console/catalog" }, { label: "제약조건", to: "/admin/db-console/constraints" }, { label: "데이터 사전", to: "/admin/db-console/dictionary" }] },
];

export function LibraryNav({ role, mobile = false, onNavigate }: { role: UserRole | null; mobile?: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const location = useLocation();
  return <nav className={mobile ? "library-nav library-nav-mobile" : "library-nav library-nav-desktop"} aria-label={mobile ? "모바일 메뉴" : "주요 메뉴"} onMouseLeave={() => !mobile && setOpen(null)} onKeyDown={(e) => { if (e.key === "Escape") { setOpen(null); (e.target as HTMLElement).closest(".library-nav-group")?.querySelector<HTMLButtonElement>("button")?.focus(); } }}>
    {groups.filter((group) => !group.role || group.role === role).map((group) => {
      const expanded = open === group.label;
      return <div className="library-nav-group" key={group.label} onMouseEnter={() => !mobile && setOpen(group.label)}>
        <button type="button" className={`library-nav-trigger ${group.items.some((item) => item.to.split("?")[0] === location.pathname && location.pathname !== "/") ? "active" : ""}`} aria-expanded={expanded} aria-controls={`${mobile ? "mobile" : "desktop"}-${group.label}`} onClick={() => setOpen(expanded ? null : group.label)}>{group.label}<span aria-hidden="true">⌄</span></button>
        <div id={`${mobile ? "mobile" : "desktop"}-${group.label}`} className="library-nav-dropdown" hidden={!expanded}>
          {group.items.map((item) => { const allowed = !item.role || role === item.role || (item.to === "/account" && !!role); const target = allowed ? item.to : `/login?next=${encodeURIComponent(item.to)}`; return <Link key={item.label} to={target} onClick={() => { setOpen(null); onNavigate?.(); }}>{item.label}</Link>; })}
        </div>
      </div>;
    })}
  </nav>;
}
