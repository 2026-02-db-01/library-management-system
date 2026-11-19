import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, BookMarked, History, RefreshCw, Search } from "lucide-react";
import { useLibraryStore } from "../../store/libraryStore";
import { AuthForm } from "../AuthPages";
import "./home.css";

export function HomePage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("title");
  const user = useLibraryStore((state) => state.currentUser);
  const role = user?.role ?? null;
  const navigate = useNavigate();
  const { hash } = useLocation();
  useEffect(() => { if (hash === "#library-guide" || hash === "#service-areas") document.getElementById(hash.slice(1))?.scrollIntoView(); }, [hash]);
  const memberLink = (to: string) => role === "MEMBER" ? to : `/login?next=${encodeURIComponent(to)}`;
  async function logout() {
    try {
      await useLibraryStore.getState().logout();
      navigate("/");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "로그아웃에 실패했습니다.");
    }
  }
  function search(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({ q: query.trim(), by: kind });
    navigate(memberLink(`/user/books?${params.toString()}`));
  }
  const services = [
    { label: "도서 검색", detail: "찾고 싶은 책을 검색해요", to: "/user/books", icon: Search },
    { label: "내 대출 현황", detail: "대출 중인 책을 확인해요", to: "/user/loans", icon: BookOpen },
    { label: "대출 연장", detail: "반납예정일을 확인해요", to: "/user/loans", icon: RefreshCw },
    { label: "이용 이력", detail: "지난 대출 내역을 살펴봐요", to: "/user/loans", icon: History },
  ];
  return <main className="landing">
    <section className="library-hero"><div className="landing-container library-hero-grid">
      <div className="library-intro"><span className="landing-kicker"><span aria-hidden="true" /> 책과 사람을 잇는 공간</span><h1>책을 찾는 순간부터,<br />이용의 모든 과정까지.</h1><p>찾고 싶은 책을 검색하고 나의 도서관 이용을 편리하게 확인하세요.</p>
        <form className="home-search" onSubmit={search}><label className="sr-only" htmlFor="home-search-kind">검색 유형</label><select id="home-search-kind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="title">제목</option><option value="author">저자</option><option value="isbn">ISBN</option></select><label className="sr-only" htmlFor="home-search-query">검색어</label><input id="home-search-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색어를 입력하세요" /><button type="submit"><Search size={19} aria-hidden="true" /> 검색</button></form>
        <p className="home-search-note">도서 검색과 내 서재는 회원 이용 화면에서 확인할 수 있습니다.</p>
      </div>
      <aside className="home-login" aria-label="로그인"><span className="home-login-icon"><BookMarked size={19} /></span>{role ? <><h2>로그인 중</h2><p>{role === "MEMBER" ? `${user?.fullName ?? "회원"} · 회원` : role === "LIBRARIAN" ? "사서 화면" : "관리자 화면"}</p><Link className="home-login-link" to={role === "MEMBER" ? "/user/loans" : role === "ADMIN" ? "/admin" : "/librarian"}>이용 화면으로 <ArrowRight size={15} /></Link><Link to="/account">내 계정</Link><button type="button" onClick={() => { void logout(); }}>로그아웃</button></> : <><h2>책담 로그인</h2><p>내 서재와 대출 현황을 확인하세요.</p><AuthForm signup={false} /></>}</aside>
    </div></section>
    <section className="landing-container library-quick" id="service-areas"><div className="library-section-title"><div><span className="landing-overline">QUICK SERVICE</span><h2>자주 찾는 서비스</h2></div><p>필요한 도서관 서비스를 바로 만나보세요.</p></div><div className="quick-grid">{services.map(({label,detail,to,icon:Icon}) => <Link className="quick-item" key={label} to={memberLink(to)}><span><Icon size={21} /></span><div><strong>{label}</strong><small>{detail}</small></div><ArrowRight size={17} /></Link>)}</div></section>
    <section className="library-guide-wrap" id="library-guide"><div className="landing-container library-guide"><div><span className="landing-overline">LIBRARY GUIDE</span><h2>알아두면 편리한 이용 안내</h2><p>책담에서 제공하는 기본 도서 이용 규칙입니다.</p></div><ul><li><strong>14일</strong><span>기본 대출 기간</span></li><li><strong>최대 5권</strong><span>회원당 대출 권수</span></li><li><strong>1회 · 7일</strong><span>기존 반납예정일 기준 연장</span></li><li><strong>사서 처리</strong><span>실물 도서 대출과 반납</span></li></ul></div></section>
  </main>;
}
