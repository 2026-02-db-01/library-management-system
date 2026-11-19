import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLibraryStore, type ActionResult } from "../store/libraryStore";
import { ApiError } from "../api/client";
import { changeOwnPassword } from "../api/http-auth";
import { WorkspaceLayout } from "../components/layout/WorkspaceLayout";
import {
  Button,
  Card,
  Field,
  Notice,
  PageHeading,
  ResultMessage,
  Modal,
  ModalFooter,
  SearchField,
} from "../components/ui/Primitives";
import { DataTable } from "../components/tables/DataTable";
import { formatDate, isActiveLoan } from "../services/library";
import type { CorrectionType, RecordStatus } from "../types/domain";

function Result({ value }: { value: ActionResult | null }) {
  return value && <ResultMessage message={value.message} error={!value.ok} />;
}

function ChangePasswordForm() {
  const navigate = useNavigate();
  const setCurrentUser = useLibraryStore((state) => state.setCurrentUser);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorField, setErrorField] = useState<"current" | "confirm" | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword"));
    const newPassword = String(form.get("newPassword"));

    setErrorField(null);
    setMessage("");
    if (newPassword !== form.get("confirmPassword")) {
      setErrorField("confirm");
      setMessage("새 비밀번호와 확인 값이 일치하지 않습니다.");
      return;
    }

    setBusy(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      await setCurrentUser(null);
      navigate("/login", { replace: true, state: { passwordChanged: true } });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await setCurrentUser(null);
        navigate("/login", { replace: true, state: { sessionEnded: true } });
        return;
      }
      if (error instanceof ApiError && error.code === "CURRENT_PASSWORD_MISMATCH") {
        setErrorField("current");
      }
      setMessage(error instanceof ApiError
        ? error.message
        : "변경 결과를 확인할 수 없습니다. 연결을 확인한 뒤 다시 로그인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2>비밀번호 변경</h2>
      <p>변경하면 이 브라우저와 다른 기기의 로그인 세션이 종료됩니다.</p>
      <form className="modal-form" aria-label="비밀번호 변경" onSubmit={submit}>
        <Field label="현재 비밀번호">
          <input type="password" name="currentPassword" autoComplete="current-password" required maxLength={128}
            aria-invalid={errorField === "current"} aria-describedby={errorField === "current" ? "password-change-error" : undefined} />
        </Field>
        <Field label="새 비밀번호">
          <input type="password" name="newPassword" autoComplete="new-password" required minLength={12} maxLength={128}
            aria-describedby="new-password-hint" />
        </Field>
        <p id="new-password-hint">12~128자를 입력해 주세요.</p>
        <Field label="새 비밀번호 확인">
          <input type="password" name="confirmPassword" autoComplete="new-password" required maxLength={128}
            aria-invalid={errorField === "confirm"} aria-describedby={errorField === "confirm" ? "password-change-error" : undefined} />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? "변경 중…" : "비밀번호 변경"}</Button>
        {message && <p id="password-change-error" role="alert">{message}</p>}
      </form>
    </Card>
  );
}

export function AccountPage() {
  const s = useLibraryStore(),
    navigate = useNavigate(),
    id =
      s.currentUser?.userId;
  const suspension = s.users.find((item) => item.userId === id)?.borrowingSuspendedUntil;
  const user = s.currentUser,
    [name, setName] = useState<string | null>(null),
    [phone, setPhone] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ActionResult | null>(null),
    [confirm, setConfirm] = useState(false);

  return (
    <WorkspaceLayout
      section={
        s.currentUser?.role === "MEMBER"
          ? "user"
          : s.currentUser?.role === "LIBRARIAN"
            ? "librarian"
            : "admin"
      }
    >
      <PageHeading
        title="내 계정"
        description="본인 계정의 이름, 연락처와 비밀번호를 관리합니다."
      />
      <Card>
        <p>
          로그인 ID · {user?.loginId ?? "선택 필요"} / {user?.role}
        </p>
        <form
          className="modal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const r = await s.updateProfile({
                fullName: name ?? user?.fullName ?? "",
                contact: phone ?? user?.contact ?? "",
              });
              setResult(r);
              if (r.ok && !s.dataError) { setName(null); setPhone(null); }
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="이름">
            <input
              value={name ?? user?.fullName ?? ""}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </Field>
          <Field label="연락처">
            <input
              value={phone ?? user?.contact ?? ""}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "저장 중…" : "본인 정보 저장"}
          </Button>
        </form>
        <Result value={result} />
        <Notice tone="info" title="인증 정책 안내">
          현재 로그인한 본인의 이름과 연락처만 수정할 수 있습니다.
        </Notice>
        {s.currentUser?.role === "MEMBER" && (
          <>
            <p>
              현재 대출{" "}
              {
                s.loans.filter((l) => l.memberUserId === id && isActiveLoan(l))
                  .length
              }{" "}
              / 5권
            </p>
            <p>
              신규 대출 정지 종료 ·{" "}
              {suspension
                ? new Date(suspension).toLocaleString("ko-KR")
                : "없음"}
            </p>
            <Button
              variant="danger"
              onClick={() => {
                setResult(null);
                setConfirm(true);
              }}
            >
              회원 탈퇴
            </Button>
          </>
        )}
      </Card>
      <ChangePasswordForm key={id} />
      {confirm && (
        <Modal
          title="회원 탈퇴 확인"
          description="개인정보와 과거 개인 대출 연결을 제거합니다. 되돌릴 수 없습니다."
          onClose={() => setConfirm(false)}
        >
          <p>
            미반납 도서가 있으면 탈퇴할 수 없습니다. 탈퇴 후에는 로그아웃되며
            기존 계정으로 재로그인할 수 없습니다.
          </p>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  const r = await s.withdrawMember();
                  setResult(r);
                  if (r.ok) navigate("/");
                  else setConfirm(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "처리 중…" : "탈퇴 확정"}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </WorkspaceLayout>
  );
}

export function AccountsPage() {
  const s = useLibraryStore(),
    [query, setQuery] = useState(""),
    [includeMembers, setIncludeMembers] = useState(false),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ActionResult | null>(null),
    [create, setCreate] = useState(false),
    [target, setTarget] = useState<number | null>(null),
    [reason, setReason] = useState(""),
    [v, setV] = useState({
      loginId: "",
      fullName: "",
      contact: "",
      password: "",
      role: "LIBRARIAN" as "LIBRARIAN" | "ADMIN",
    });

  const rows = s.users.filter((u) => {
    if (!includeMembers && u.role === "MEMBER") return false;
    return `${u.userId} ${u.fullName ?? ""} ${u.loginId ?? ""} ${u.role} ${u.accountStatus}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await s.addStaff(v);
      setResult(r);
      if (r.ok) {
        setCreate(false);
        setV({
          loginId: "",
          fullName: "",
          contact: "",
          password: "",
          role: "LIBRARIAN",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceLayout section="admin">
      <PageHeading
        title="계정 현황"
        description="기본적으로 직원 계정을 관리하며, 필요 시 일반 회원 상태도 함께 조회합니다. 역할은 생성 후 변경할 수 없습니다."
        actions={
          <Button
            onClick={() => {
              setResult(null);
              setCreate(true);
            }}
          >
            직원 계정 생성
          </Button>
        }
      />
      <div className="book-management-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          label="계정 필터"
          placeholder="이름, 로그인 ID, 내부 ID, 역할, 상태 검색"
        />
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={includeMembers}
            onChange={(e) => setIncludeMembers(e.target.checked)}
          />
          일반 회원(MEMBER) 상태도 함께 보기
        </label>
      </div>
      <Result value={result} />
      <Card className="table-card">
        <DataTable
          rows={rows}
          getRowKey={(u) => u.userId}
          columns={[
            {
              key: "id",
              title: "내부 ID",
              render: (u) => <code>#{u.userId}</code>,
            },
            {
              key: "identity",
              title: "이름 · 로그인 ID",
              render: (u) => (
                <span className="table-title-cell">
                  <strong>{u.fullName ?? "이름 없음"}</strong>
                  <small>{u.loginId ?? "—"}</small>
                </span>
              ),
            },
            { key: "role", title: "역할", render: (u) => u.role },
            { key: "status", title: "상태", render: (u) => u.accountStatus },
            {
              key: "action",
              title: "계정 관리",
              render: (u) =>
                u.role === "MEMBER" ? (
                  "회원 직접 관리 (가입·탈퇴)"
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setResult(null);
                      setTarget(u.userId);
                      setReason("");
                    }}
                  >
                    {u.accountStatus === "ACTIVE" ? "비활성화" : "재활성화"}
                  </Button>
                ),
            },
          ]}
        />
      </Card>
      <Notice tone="info" title="개인정보 조회 제한">
        관리자는 직원 관리에 필요한 역할·상태를 확인합니다. 회원 연락처와 개인별
        이용 내역은 제공하지 않습니다.
      </Notice>
      {create && (
        <Modal title="직원 계정 생성" onClose={() => { setCreate(false); setV({ ...v, password: "" }); }}>
          <form className="modal-form" onSubmit={submit}>
            {(["loginId", "fullName", "contact"] as const).map((key, i) => (
              <Field key={key} label={["로그인 ID", "이름", "연락처"][i]}>
                <input
                  required
                  value={v[key]}
                  onChange={(e) => setV({ ...v, [key]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="초기 비밀번호">
              <input required type="password" autoComplete="new-password" minLength={12} maxLength={128}
                value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
            </Field>
            <Field label="생성 역할">
              <select
                value={v.role}
                onChange={(e) =>
                  setV({ ...v, role: e.target.value as typeof v.role })
                }
              >
                <option value="LIBRARIAN">사서</option>
                <option value="ADMIN">관리자</option>
              </select>
            </Field>
            <Result value={result} />
            <ModalFooter>
              <Button type="submit" disabled={busy}>
                {busy ? "생성 중…" : "직원 생성"}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
      {target !== null && (
        <Modal title="직원 상태 변경" onClose={() => setTarget(null)}>
          <Field label="변경 사유">
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Result value={result} />
          <ModalFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                if (target === null || busy) return;
                setBusy(true);
                try {
                  const r = await s.setUserStatus(target, reason);
                  setResult(r);
                  if (r.ok) setTarget(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "변경 중…" : "상태 변경 확정"}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </WorkspaceLayout>
  );
}

export function CopiesPage() {
  const s = useLibraryStore(),
    [query, setQuery] = useState(""),
    [target, setTarget] = useState<number | null>(null),
    [status, setStatus] = useState<RecordStatus>("DAMAGED"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ActionResult | null>(null);
  return (
    <WorkspaceLayout section="librarian">
      <PageHeading
        title="소장본 상태 관리"
        description="정상·파손·수리·제적을 관리하고 변경 이력을 보존합니다. 제적 복원은 불가합니다."
      />
      <SearchField
        value={query}
        onChange={setQuery}
        label="소장본 검색"
        placeholder="관리번호 검색"
      />
      <Result value={result} />
      <Card className="table-card">
        <DataTable
          rows={s.copies.filter((c) =>
            c.copyCode.toLowerCase().includes(query.trim().toLowerCase()),
          )}
          getRowKey={(c) => c.copyId}
          columns={[
            {
              key: "code",
              title: "관리번호",
              render: (c) => <code>{c.copyCode}</code>,
            },
            {
              key: "book",
              title: "도서",
              render: (c) => s.books.find((b) => b.bookId === c.bookId)?.title,
            },
            {
              key: "state",
              title: "관리 상태",
              render: (c) => c.managementStatus,
            },
            {
              key: "loan",
              title: "대출 상태",
              render: (c) =>
                s.loans.some((l) => l.copyId === c.copyId && isActiveLoan(l))
                  ? "대출 중"
                  : "미대출",
            },
            {
              key: "action",
              title: "작업",
              render: (c) => (
                <Button
                  variant="secondary"
                  disabled={c.managementStatus === "RETIRED"}
                  onClick={() => {
                    setResult(null);
                    setTarget(c.copyId);
                    setReason("");
                  }}
                >
                  상태 변경
                </Button>
              ),
            },
          ]}
        />
      </Card>
      {target !== null && (
        <Modal title="소장본 상태 변경" onClose={() => setTarget(null)}>
          <Field label="새 상태">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RecordStatus)}
            >
              <option value="DAMAGED">파손</option>
              <option value="ACTIVE">수리 완료 · 정상</option>
              <option value="RETIRED">제적 · 복원 불가</option>
            </select>
          </Field>
          <Field label="사유">
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Result value={result} />
          <ModalFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                if (target === null || busy) return;
                setBusy(true);
                try {
                  const r = await s.changeCopyStatus(
                    target,
                    status,
                    reason,
                  );
                  setResult(r);
                  if (r.ok) setTarget(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "변경 중…" : "변경 확정"}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </WorkspaceLayout>
  );
}

export function CorrectionsPage() {
  const s = useLibraryStore(),
    [id, setId] = useState(0),
    [type, setType] = useState<CorrectionType>("CANCEL_LOAN"),
    [reason, setReason] = useState(""),
    [physical, setPhysical] = useState(false),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ActionResult | null>(null);

  const activeLoanId = s.loans.some((l) => l.loanId === id)
    ? id
    : (s.loans[0]?.loanId ?? 0);

  return (
    <WorkspaceLayout section="librarian">
      <PageHeading
        title="대출·반납 정정"
        description="기록을 삭제하지 않고 유효 상태를 정정합니다. 사유에는 개인정보를 입력하지 마세요."
      />
      <Card>
        <form
          className="modal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const r = await s.correctLoan(
                activeLoanId,
                { type, reason, physicalConfirmed: physical },
              );
              setResult(r);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="대출 기록">
            <select
              value={activeLoanId}
              onChange={(e) => setId(Number(e.target.value))}
            >
              {s.loans.map((l) => (
                <option key={l.loanId} value={l.loanId}>
                  #{l.loanId} ·{" "}
                  {s.copies.find((c) => c.copyId === l.copyId)?.copyCode} ·{" "}
                  {l.isCancelled ? "취소" : l.returnedAt ? "반납" : "미반납"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="정정 유형">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CorrectionType)}
            >
              <option value="CANCEL_LOAN">대출 취소</option>
              <option value="UNDO_RETURN">잘못된 반납 취소</option>
              <option value="CORRECT_DUE_DATE">
                반납예정일 정정 · 정책 미확정
              </option>
              <option value="CORRECT_RETURNED_AT">
                반납일시 정정 · 정책 미확정
              </option>
            </select>
          </Field>
          <Field label="정정 사유">
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={physical}
              onChange={(e) => setPhysical(e.target.checked)}
            />{" "}
            실물 회수 또는 실제 미반출을 확인했습니다.
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "정정 중…" : "정정 확정"}
          </Button>
        </form>
        <Result value={result} />
      </Card>
      <Notice tone="warning" title="날짜 정정 운영안 확인 필요">
        Wiki BP-11에 세부 운영 규칙이 제안으로 표시되어 있습니다. 근거·허용 범위
        확정 전에는 날짜 변경을 제한하고 원본을 보존합니다.
      </Notice>
    </WorkspaceLayout>
  );
}

export function HistoryPage() {
  const s = useLibraryStore(),
    admin = s.currentUser?.role === "ADMIN",
    [query, setQuery] = useState("");
  const rows = admin
    ? s.staffHistory.map((r) => {
        const targetUser = s.users.find(
          (u) => u.userId === r.targetStaffUserId,
        );
        return {
          id: `staff-${r.staffHistoryId}`,
          kind: r.actionType,
          target: targetUser?.fullName
            ? `#${r.targetStaffUserId} (${targetUser.fullName})`
            : `#${r.targetStaffUserId}`,
          time: r.processedAt,
          before: r.previousStatus ?? "없음",
          after: r.newStatus,
          reason: r.reason || "—",
        };
      })
    : [
        ...s.bookHistory.map((r) => ({
          id: `book-${r.bookChangeId}`,
          kind: "서지 변경",
          target: `#${r.bookId}`,
          time: r.changedAt,
          before: JSON.stringify(r.beforeValues),
          after: JSON.stringify(r.afterValues),
          reason: "—",
        })),
        ...s.copyHistory.map((r) => ({
          id: `copy-${r.copyStatusHistoryId}`,
          kind: "소장본 변경",
          target: `#${r.copyId}`,
          time: r.changedAt,
          before: r.previousStatus ?? "없음",
          after: r.newStatus,
          reason: r.reason || "—",
        })),
        ...s.corrections.map((r) => ({
          id: `correction-${r.correctionId}`,
          kind: r.correctionType,
          target: `#${r.loanId}`,
          time: r.correctedAt,
          before: JSON.stringify(r.beforeValues),
          after: JSON.stringify(r.afterValues),
          reason: r.reason || "—",
        })),
      ];
  return (
    <WorkspaceLayout section={admin ? "admin" : "librarian"}>
      <PageHeading
        title={admin ? "직원 계정 감사 이력" : "업무 변경·정정 이력"}
        description={
          admin
            ? "최신 Wiki 권한에 따라 직원 생성·상태 변경 이력만 조회합니다."
            : "서지·소장본·대출 정정 전후 사실을 보존합니다."
        }
      />
      <SearchField
        value={query}
        onChange={setQuery}
        label="이력 검색"
        placeholder="유형, 대상 ID 또는 사유"
      />
      <Card className="table-card">
        <DataTable
          rows={rows
            .filter((r) =>
              `${r.kind} ${r.target} ${r.reason}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
            )
            .sort((a, b) => b.time.localeCompare(a.time))}
          getRowKey={(r) => r.id}
          columns={[
            { key: "type", title: "업무", render: (r) => r.kind },
            { key: "target", title: "대상", render: (r) => r.target },
            { key: "time", title: "처리일", render: (r) => formatDate(r.time) },
            {
              key: "before",
              title: "변경 전",
              render: (r) => <code className="snapshot-cell">{r.before}</code>,
            },
            {
              key: "after",
              title: "변경 후",
              render: (r) => <code className="snapshot-cell">{r.after}</code>,
            },
            {
              key: "reason",
              title: "사유",
              render: (r) => r.reason,
            },
          ]}
        />
      </Card>
    </WorkspaceLayout>
  );
}

export function LoanHistoryPage() {
  const s = useLibraryStore(),
    [query, setQuery] = useState("");
  const rows = s.loans
    .filter((loan) => {
      const copy = s.copies.find((c) => c.copyId === loan.copyId),
        book = s.books.find((b) => b.bookId === copy?.bookId),
        member = s.users.find((u) => u.userId === loan.memberUserId);
      return `${copy?.copyCode} ${book?.title} ${member?.fullName ?? ""} ${loan.memberUserId ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
    })
    .sort((a, b) => b.borrowedAt.localeCompare(a.borrowedAt));
  return (
    <WorkspaceLayout section="librarian">
      <PageHeading
        title="회원·소장본 이용 이력"
        description="탈퇴 회원의 기록은 개인별로 묶지 않고 소장본 기준으로만 보존합니다."
      />
      <SearchField
        value={query}
        onChange={setQuery}
        label="이용 이력 검색"
        placeholder="회원 이름·ID, 도서명, 소장본 관리번호"
      />
      <Card className="table-card">
        <DataTable
          rows={rows}
          getRowKey={(l) => l.loanId}
          columns={[
            { key: "loanId", title: "대출 ID", render: (l) => l.loanId },
            {
              key: "copy",
              title: "소장본",
              render: (l) =>
                s.copies.find((c) => c.copyId === l.copyId)?.copyCode,
            },
            {
              key: "member",
              title: "회원",
              render: (l) =>
                l.memberUserId === null
                  ? "회원 연결 제거"
                  : s.users.find((u) => u.userId === l.memberUserId)?.fullName,
            },
            {
              key: "borrowedAt",
              title: "대출일",
              render: (l) => formatDate(l.borrowedAt),
            },
            {
              key: "currentDueDate",
              title: "현재 반납예정일",
              render: (l) => formatDate(l.currentDueDate),
            },
            {
              key: "return",
              title: "반납일",
              render: (l) => formatDate(l.returnedAt),
            },
            {
              key: "state",
              title: "상태·연장",
              render: (l) =>
                `${l.isCancelled ? "취소" : l.returnedAt ? "반납" : "미반납"} · 연장 ${s.renewals.filter((r) => r.loanId === l.loanId).length}회`,
            },
          ]}
        />
      </Card>
    </WorkspaceLayout>
  );
}