import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLibraryStore, type ActionResult } from "../store/libraryStore";
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
export function AccountPage() {
  const s = useLibraryStore(),
    navigate = useNavigate(),
    id =
      s.demoRole === "MEMBER"
        ? s.demoMemberId
        : s.demoRole === "LIBRARIAN"
          ? s.demoLibrarianId
          : s.demoAdminId;
  const user = s.users.find((u) => u.userId === id),
    [name, setName] = useState(user?.fullName ?? ""),
    [phone, setPhone] = useState(user?.contact ?? ""),
    [result, setResult] = useState<ActionResult | null>(null),
    [confirm, setConfirm] = useState(false);
  return (
    <WorkspaceLayout
      section={
        s.demoRole === "MEMBER"
          ? "user"
          : s.demoRole === "LIBRARIAN"
            ? "librarian"
            : "admin"
      }
    >
      <PageHeading
        title="내 계정"
        description="본인 정보만 수정합니다. 비밀번호와 인증 서버는 연결되지 않은 데모입니다."
      />
      <Card>
        <p>
          로그인 ID · {user?.loginId ?? "선택 필요"} / {user?.role}
        </p>
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            setResult(s.updateProfile(id, { fullName: name, contact: phone }));
          }}
        >
          <Field label="이름">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </Field>
          <Field label="연락처">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
            />
          </Field>
          <Button type="submit">본인 정보 저장</Button>
        </form>
        <Result value={result} />
        <Notice tone="info" title="인증 정책 미확정">
          비밀번호 변경과 직원 최초 비밀번호 설정은 실제 인증 연결 시
          제공합니다. 현재 역할 선택은 Mock 데모입니다.
        </Notice>
        {s.demoRole === "MEMBER" && (
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
              {user?.borrowingSuspendedUntil
                ? new Date(user.borrowingSuspendedUntil).toLocaleString("ko-KR")
                : "없음"}
            </p>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              회원 탈퇴
            </Button>
          </>
        )}
      </Card>
      {confirm && (
        <Modal
          title="회원 탈퇴 확인"
          description="개인정보와 과거 개인 대출 연결을 제거합니다. 되돌릴 수 없습니다."
          onClose={() => setConfirm(false)}
        >
          <p>
            미반납 도서가 있으면 탈퇴할 수 없습니다. 탈퇴 후 ID 재사용 정책이
            확정되지 않아 이 데모의 재가입은 제한됩니다.
          </p>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const r = s.withdrawMember(id);
                setResult(r);
                if (r.ok) navigate("/");
                else setConfirm(false);
              }}
            >
              탈퇴 확정
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </WorkspaceLayout>
  );
}
export function SignupPage() {
  const s = useLibraryStore(),
    [v, setV] = useState({ loginId: "", fullName: "", contact: "" }),
    [result, setResult] = useState<ActionResult | null>(null);
  return (
    <main className="signup-page">
      <PageHeading
        title="회원가입 데모"
        description="관리자 승인 없이 일반 회원으로 가입합니다. 실제 인증 계정은 생성하지 않습니다."
      />
      <Card>
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            setResult(s.addMember(v));
          }}
        >
          {(["loginId", "fullName", "contact"] as const).map((key, i) => (
            <Field key={key} label={["로그인 ID", "이름", "연락처"][i]}>
              <input
                required
                value={v[key]}
                onChange={(e) => setV({ ...v, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Button type="submit">일반 회원 가입</Button>
        </form>
        <Result value={result} />
        <a href="/">홈으로</a>
      </Card>
    </main>
  );
}
export function AccountsPage() {
  const s = useLibraryStore(),
    [query, setQuery] = useState(""),
    [result, setResult] = useState<ActionResult | null>(null),
    [create, setCreate] = useState(false),
    [target, setTarget] = useState<number | null>(null),
    [reason, setReason] = useState(""),
    [v, setV] = useState({
      loginId: "",
      fullName: "",
      contact: "",
      role: "LIBRARIAN" as "LIBRARIAN" | "ADMIN",
    });
  const rows = s.users.filter((u) =>
    `${u.userId} ${u.role} ${u.accountStatus}`.includes(query),
  );
  function submit(e: FormEvent) {
    e.preventDefault();
    const r = s.addStaff(v);
    setResult(r);
    if (r.ok) setCreate(false);
  }
  return (
    <WorkspaceLayout section="admin">
      <PageHeading
        title="계정 현황"
        description="회원은 상태만 조회하고, 직원 계정은 생성·비활성화·재활성화합니다. 역할은 생성 후 변경할 수 없습니다."
        actions={
          <Button onClick={() => setCreate(true)}>직원 계정 생성</Button>
        }
      />
      <SearchField
        value={query}
        onChange={setQuery}
        label="계정 필터"
        placeholder="ID, 역할, 상태 검색"
      />
      <Result value={result} />
      <Card className="table-card">
        <DataTable
          rows={rows}
          getRowKey={(u) => u.userId}
          columns={[
            {
              key: "id",
              title: "내부 ID",
              render: (u) => <code>{u.userId}</code>,
            },
            { key: "role", title: "역할", render: (u) => u.role },
            { key: "status", title: "상태", render: (u) => u.accountStatus },
            {
              key: "action",
              title: "직원 상태",
              render: (u) =>
                u.role === "MEMBER" ? (
                  "본인 가입·탈퇴"
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
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
        <Modal title="직원 계정 생성" onClose={() => setCreate(false)}>
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
              <Button type="submit">직원 생성</Button>
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
              onClick={() => {
                const r = s.setUserStatus(target, reason);
                setResult(r);
                if (r.ok) setTarget(null);
              }}
            >
              상태 변경 확정
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
    [failure, setFailure] = useState(false),
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
          rows={s.copies.filter((c) => c.copyCode.includes(query))}
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
          <label>
            <input
              type="checkbox"
              checked={failure}
              onChange={(e) => setFailure(e.target.checked)}
            />{" "}
            이력 저장 실패 시연
          </label>
          <Result value={result} />
          <ModalFooter>
            <Button
              onClick={() => {
                const r = s.changeCopyStatus(target, status, reason, failure);
                setResult(r);
                if (r.ok) setTarget(null);
              }}
            >
              변경 확정
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </WorkspaceLayout>
  );
}
export function CorrectionsPage() {
  const s = useLibraryStore(),
    [id, setId] = useState(s.loans[0]?.loanId ?? 0),
    [type, setType] = useState<CorrectionType>("CANCEL_LOAN"),
    [reason, setReason] = useState(""),
    [physical, setPhysical] = useState(false),
    [result, setResult] = useState<ActionResult | null>(null),
    [failure, setFailure] = useState(false);
  return (
    <WorkspaceLayout section="librarian">
      <PageHeading
        title="대출·반납 정정"
        description="기록을 삭제하지 않고 유효 상태를 정정합니다. 사유에는 개인정보를 입력하지 마세요."
      />
      <Card>
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            setResult(
              s.correctLoan(
                id,
                { type, reason, physicalConfirmed: physical },
                { simulateFailure: failure },
              ),
            );
          }}
        >
          <Field label="대출 기록">
            <select value={id} onChange={(e) => setId(Number(e.target.value))}>
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
          <label>
            <input
              type="checkbox"
              checked={failure}
              onChange={(e) => setFailure(e.target.checked)}
            />{" "}
            이력 저장 실패 · 전체 롤백 시연
          </label>
          <Button type="submit">정정 확정</Button>
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
    admin = s.demoRole === "ADMIN",
    [query, setQuery] = useState("");
  const rows = admin
    ? s.staffHistory.map((r) => ({
        id: `staff-${r.staffHistoryId}`,
        kind: r.actionType,
        target: String(r.targetStaffUserId),
        time: r.processedAt,
        before: r.previousStatus ?? "없음",
        after: r.newStatus,
      }))
    : [
        ...s.bookHistory.map((r) => ({
          id: `book-${r.bookChangeId}`,
          kind: "서지 변경",
          target: String(r.bookId),
          time: r.changedAt,
          before: JSON.stringify(r.beforeValues),
          after: JSON.stringify(r.afterValues),
        })),
        ...s.copyHistory.map((r) => ({
          id: `copy-${r.copyStatusHistoryId}`,
          kind: "소장본 변경",
          target: String(r.copyId),
          time: r.changedAt,
          before: r.previousStatus ?? "없음",
          after: r.newStatus,
        })),
        ...s.corrections.map((r) => ({
          id: `correction-${r.correctionId}`,
          kind: r.correctionType,
          target: String(r.loanId),
          time: r.correctedAt,
          before: JSON.stringify(r.beforeValues),
          after: JSON.stringify(r.afterValues),
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
        placeholder="유형 또는 대상 ID"
      />
      <Card className="table-card">
        <DataTable
          rows={rows
            .filter((r) => `${r.kind} ${r.target}`.includes(query))
            .sort((a, b) => b.time.localeCompare(a.time))}
          getRowKey={(r) => r.id}
          columns={[
            { key: "type", title: "업무", render: (r) => r.kind },
            { key: "target", title: "대상 ID", render: (r) => r.target },
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
