import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { unavailableAuth } from "../api/auth-contract";
import { validateAuth, type AuthValues as Values } from "../api/auth-validation";
import { Button, Card, PageHeading } from "../components/ui/Primitives";
import { useLibraryStore } from "../store/libraryStore";
import type { UserRole } from "../types/domain";
import "./auth-shortcuts.css";

const empty: Values = { loginId: "", password: "", confirm: "", fullName: "", contact: "" };

export function AuthForm({ signup }: { signup: boolean }) {
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const requestRoleSwitch = useLibraryStore((state) => state.requestRoleSwitch);
  function enterMock(role: UserRole, path: string) {
    requestRoleSwitch(role, path);
    navigate(path);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next = validateAuth(values, signup); setErrors(next); setMessage("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (signup) {
        await unavailableAuth.signup({ loginId: values.loginId.trim(), password: values.password, fullName: values.fullName.trim(), contact: values.contact.replace(/\D/g, "") });
        setValues(empty); navigate("/login", { replace: true });
      } else {
        await unavailableAuth.login({ loginId: values.loginId.trim(), password: values.password });
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  }
  const fields: { key: keyof Values; label: string; type?: string; autoComplete?: string; maxLength?: number }[] = [
    { key: "loginId", label: "로그인 ID", autoComplete: "username", maxLength: 50 },
    { key: "password", label: "비밀번호", type: visible ? "text" : "password", autoComplete: signup ? "new-password" : "current-password" },
    ...(signup ? [
      { key: "confirm" as const, label: "비밀번호 확인", type: visible ? "text" : "password", autoComplete: "new-password" },
      { key: "fullName" as const, label: "이름", autoComplete: "name", maxLength: 100 },
      { key: "contact" as const, label: "휴대전화번호", type: "tel", autoComplete: "tel" },
    ] : []),
  ];
  return <><form className="modal-form" onSubmit={submit} noValidate>
      {fields.map(({ key, label, ...props }) => <label className="form-field" key={key}><span>{label}</span><input {...props} aria-label={label} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-error` : undefined} />{errors[key] && <span id={`${key}-error`} role="alert">{errors[key]}</span>}</label>)}
      <label><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /> 비밀번호 표시</label>
      <Button type="submit" disabled={busy}>{busy ? "처리 중…" : signup ? "회원가입" : "로그인"}</Button>
      {message && <p role="alert">{message}</p>}
    </form>
    <p>{signup ? <Link to="/login">이미 계정이 있나요? 로그인</Link> : <Link to="/signup">계정이 없나요? 회원가입</Link>}</p>
    {signup && <p><Link to="/signup/demo">회원가입 목업 체험하기</Link> · 실제 계정은 생성되지 않습니다.</p>}
    {!signup && <div className="mock-shortcuts" aria-label="목업 역할 바로가기"><p>로그인 없이 목업 화면 살펴보기</p><div><button type="button" onClick={() => enterMock("MEMBER", "/user/books")}>유저</button><button type="button" onClick={() => enterMock("LIBRARIAN", "/librarian")}>사서</button><button type="button" onClick={() => enterMock("ADMIN", "/admin")}>관리자</button></div><small>실제 로그인이 아닌 역할별 화면 시연입니다.</small></div>}
  </>;
}
function AuthPage({ signup }: { signup: boolean }) { const [params] = useSearchParams(); return <main className="signup-page"><PageHeading title={signup ? "회원가입" : "로그인"} description={params.has("next") ? "요청하신 서비스는 로그인 후 이용할 수 있습니다. 인증 서버 연결 준비 중이며 요청한 검색 조건은 주소에 보존됩니다." : "인증 서버 연결 준비 중입니다. 실제 계정은 서버 연결 후 이용할 수 있습니다."} /><Card><AuthForm signup={signup} /></Card></main>; }
export function LoginPage() { return <AuthPage signup={false} />; }
export function SignupPage() { return <AuthPage signup />; }
