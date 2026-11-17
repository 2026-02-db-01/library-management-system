import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { httpAuthTransport } from "../api/http-auth";
import { validateAuth, type AuthValues as Values } from "../api/auth-validation";
import { Button, Card, PageHeading } from "../components/ui/Primitives";
import { useLibraryStore } from "../store/libraryStore";

const empty: Values = {
  loginId: "",
  password: "",
  confirm: "",
  fullName: "",
  contact: "",
};

export function AuthForm({ signup }: { signup: boolean }) {
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestRoleSwitch = useLibraryStore((state) => state.requestRoleSwitch);
  const setCurrentUser = useLibraryStore((state) => state.setCurrentUser);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next = validateAuth(values, signup);
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      if (signup) {
        await httpAuthTransport.signup({
          loginId: values.loginId.trim(),
          password: values.password,
          fullName: values.fullName.trim(),
          contact: values.contact.replace(/\D/g, ""),
        });
        setValues(empty);
        navigate("/login", { replace: true });
      } else {
        const user = await httpAuthTransport.login({
          loginId: values.loginId.trim(),
          password: values.password,
        });
        await setCurrentUser(user);

        const defaultPath =
          user.role === "MEMBER"
            ? "/user/books"
            : user.role === "LIBRARIAN"
              ? "/librarian"
              : "/admin";
        const requested = params.get("next");
        const allowedPrefix =
          user.role === "MEMBER"
            ? "/user/"
            : user.role === "LIBRARIAN"
              ? "/librarian"
              : "/admin";
        const destination =
          requested &&
          (requested === "/account" ||
            requested === allowedPrefix ||
            requested.startsWith(
              allowedPrefix + (allowedPrefix.endsWith("/") ? "" : "/"),
            ) ||
            requested.startsWith(allowedPrefix + "?")) &&
          !requested.startsWith("//")
            ? requested
            : defaultPath;

        requestRoleSwitch(user.role, destination.split("?")[0]);
        setValues(empty);
        navigate(destination);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "요청을 처리하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  const fields: {
    key: keyof Values;
    label: string;
    type?: string;
    autoComplete?: string;
    maxLength?: number;
  }[] = [
    {
      key: "loginId",
      label: "로그인 ID",
      autoComplete: "username",
      maxLength: 50,
    },
    {
      key: "password",
      label: "비밀번호",
      type: visible ? "text" : "password",
      autoComplete: signup ? "new-password" : "current-password",
    },
    ...(signup
      ? [
          {
            key: "confirm" as const,
            label: "비밀번호 확인",
            type: visible ? "text" : "password",
            autoComplete: "new-password",
          },
          {
            key: "fullName" as const,
            label: "이름",
            autoComplete: "name",
            maxLength: 100,
          },
          {
            key: "contact" as const,
            label: "휴대전화번호",
            type: "tel",
            autoComplete: "tel",
          },
        ]
      : []),
  ];

  return (
    <>
      <form className="modal-form" onSubmit={submit} noValidate>
        {fields.map(({ key, label, ...props }) => (
          <label className="form-field" key={key}>
            <span>{label}</span>
            <input
              {...props}
              aria-label={label}
              value={values[key]}
              onChange={(event) =>
                setValues({ ...values, [key]: event.target.value })
              }
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? `${key}-error` : undefined}
            />
            {errors[key] && (
              <span id={`${key}-error`} role="alert">
                {errors[key]}
              </span>
            )}
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
          />{" "}
          비밀번호 표시
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "처리 중…" : signup ? "회원가입" : "로그인"}
        </Button>
        {message && <p role="alert">{message}</p>}
      </form>
      <p>
        {signup ? (
          <Link to="/login">이미 계정이 있나요? 로그인</Link>
        ) : (
          <Link to="/signup">계정이 없나요? 회원가입</Link>
        )}
      </p>
      {!signup && (
        <p className="mock-login-note">
          사서(librarian) · 관리자(admin) 또는 가입한 회원 계정으로 로그인합니다.
        </p>
      )}
    </>
  );
}

function AuthPage({ signup }: { signup: boolean }) {
  const [params] = useSearchParams();
  return (
    <main className="signup-page">
      <PageHeading
        title={signup ? "회원가입" : "로그인"}
        description={
          signup
            ? "도서관 이용을 위한 일반 회원 계정을 생성합니다."
            : params.has("next")
              ? "요청하신 서비스는 로그인 후 이용할 수 있습니다."
              : "아이디와 비밀번호를 입력해 도서관 시스템에 로그인합니다."
        }
      />
      <Card>
        <AuthForm signup={signup} />
      </Card>
    </main>
  );
}

export function LoginPage() {
  return <AuthPage signup={false} />;
}

export function SignupPage() {
  return <AuthPage signup />;
}