import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { useLibraryStore } from "../../store/libraryStore";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export type WorkspaceKey = "user" | "librarian" | "admin" | "console";

const workspaceConfig: Record<
  WorkspaceKey,
  {
    title: string;
    english: string;
    description: string;
    links: { label: string; to: string; end?: boolean }[];
  }
> = {
  user: {
    title: "유저 서비스",
    english: "USER SERVICE",
    description: "도서 검색과 내 대출 현황을 확인합니다.",
    links: [
      { label: "도서 검색", to: "/user/books" },
      { label: "내 대출 현황", to: "/user/loans" },
      { label: "내 계정", to: "/account" },
    ],
  },
  librarian: {
    title: "사서 업무 시스템",
    english: "LIBRARY DESK",
    description: "대출·반납을 처리하고 연체와 연장 이력을 확인합니다.",
    links: [
      { label: "업무 현황", to: "/librarian", end: true },
      { label: "서지정보 관리", to: "/librarian/books" },
      { label: "저자 관리", to: "/librarian/authors" },
      { label: "소장본 상태", to: "/librarian/copies" },
      { label: "대출·반납 정정", to: "/librarian/corrections" },
      { label: "이용 이력", to: "/librarian/loans" },
      { label: "변경 이력", to: "/librarian/history" },
      { label: "내 계정", to: "/account" },
      { label: "도서 대출", to: "/librarian/checkout" },
      { label: "도서 반납", to: "/librarian/returns" },
      { label: "연장 이력", to: "/librarian/renewals" },
      { label: "연체 조회", to: "/librarian/overdue" },
    ],
  },
  admin: {
    title: "관리자 대시보드",
    english: "ADMINISTRATION",
    description: "회원·도서 관리와 업무 통계를 확인합니다.",
    links: [
      { label: "대시보드", to: "/admin", end: true },
      { label: "직원 감사 이력", to: "/admin/history" },
      { label: "내 계정", to: "/account" },
      { label: "계정 현황", to: "/admin/members" },
      { label: "도서 관리", to: "/admin/books" },
      { label: "Authors", to: "/admin/authors" },
      { label: "업무 통계", to: "/admin/statistics" },
    ],
  },
  console: {
    title: "DB Console",
    english: "SCHEMA EXPLORER",
    description: "설계 스키마와 관계를 탐색합니다.",
    links: [
      { label: "데이터 카탈로그", to: "/admin/db-console/catalog" },
      { label: "ERD 관계", to: "/admin/db-console/erd" },
      { label: "제약조건", to: "/admin/db-console/constraints" },
      { label: "데이터 사전", to: "/admin/db-console/dictionary" },
    ],
  },
};

export function WorkspaceLayout({
  section,
  children,
}: {
  section: WorkspaceKey;
  children: ReactNode;
}) {
  const config = workspaceConfig[section];
  const location = useLocation();
  const currentUser = useLibraryStore((state) => state.currentUser);
  const hasLoadedData = useLibraryStore((state) => state.hasLoadedData);
  const dataError = useLibraryStore((state) => state.dataError);
  const syncState = useLibraryStore((state) => state.syncState);
  const [retrying, setRetrying] = useState(false);
  const showUnavailable = currentUser !== null && !hasLoadedData && !!dataError;

  async function retryLoad() {
    if (retrying) return;
    setRetrying(true);
    try {
      await syncState();
    } catch {
      // The store exposes the failure in dataError; keep the retry view visible.
    } finally {
      setRetrying(false);
    }
  }

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
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `workspace-nav-link ${isActive ? "active" : ""}`
              }
            >
              <span>{link.label}</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="workspace-content" key={location.pathname}>
        {showUnavailable ? (
          <section role="alert" aria-label="업무 데이터 조회 실패">
            <h1>업무 데이터를 불러오지 못했습니다.</h1>
            <p>서버 조회에 실패했습니다. 실제 회원·도서·대출 건수가 0이라는 뜻이 아닙니다.</p>
            <p>{dataError}</p>
            <button type="button" onClick={retryLoad} disabled={retrying}>
              {retrying ? "재시도 중…" : "다시 시도"}
            </button>
          </section>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
