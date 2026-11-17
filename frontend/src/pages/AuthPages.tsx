import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { unavailableAuth } from "../api/auth-contract";
import { authenticateMock, mockAuthEnabled } from "../api/mock-auth";
import { validateAuth, type AuthValues as Values } from "../api/auth-validation";
import { Button, Card, PageHeading } from "../components/ui/Primitives";
import { useLibraryStore } from "../store/libraryStore";

const empty: Values = { loginId: "", password: "", confirm: "", fullName: "", contact: "" };

export function AuthForm({ signup }: { signup: boolean }) {
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestRoleSwitch = useLibraryStore((state) => state.requestRoleSwitch);
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
        const account = authenticateMock(values.loginId, values.password);
        const activeUser = useLibraryStore.getState().users.some((user) => user.role === account.role && user.accountStatus === "ACTIVE");
        if (!activeUser) throw new Error("이 역할의 활성 목업 계정이 없습니다. 목업 데이터를 확인해 주세요.");
        const requested = params.get("next");
        const allowedPrefix = account.role === "MEMBER" ? "/user/" : account.role === "LIBRARIAN" ? "/librarian" : "/admin";
        const destination = requested && (requested === "/account" || requested === allowedPrefix || requested.startsWith(allowedPrefix + (allowedPrefix.endsWith("/") ? "" : "/")) || requested.startsWith(allowedPrefix + "?")) && !requested.startsWith("//") ? requested : account.path;
        requestRoleSwitch(account.role, destination.split("?")[0]);
        setValues(empty);
        navigate(destination);
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
    {!signup && <p className="mock-login-note">{mockAuthEnabled() ? "고정 테스트 계정을 사용하는 목업 로그인입니다. 실제 인증 서버에 연결되지 않습니다." : "실제 인증 서버가 연결되지 않았습니다."}</p>}
  </>;
}
function AuthPage({ signup }: { signup: boolean }) { const [params] = useSearchParams(); return <main className="signup-page"><PageHeading title={signup ? "회원가입" : "로그인"} description={signup ? "실제 회원가입 서버는 연결되지 않았습니다." : params.has("next") ? "요청하신 서비스는 목업 로그인 후 이용할 수 있습니다." : "고정 테스트 계정으로 목업을 이용합니다. 실제 인증 서버는 연결되지 않았습니다."} /><Card><AuthForm signup={signup} /></Card></main>; }
export function LoginPage() { return <AuthPage signup={false} />; }
export function SignupPage() { return <AuthPage signup />; }
