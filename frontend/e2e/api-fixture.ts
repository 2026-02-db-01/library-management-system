import type { Page } from "@playwright/test";
import { createSeedData, addDays, getKoreanDate } from "../src/data/mock/seed";
import type { UserRole } from "../src/types/domain";

export async function installApiFixture(page: Page) {
  const data = createSeedData();
  let identity: number | null = null;
  const passwords = new Map<number, string>();
  const passwordFor = (userId: number) => passwords.get(userId) ?? "fixture-test-password";
  let renewalError = false;
  let dropCheckoutResponse = false;
  const completedCheckouts = new Map<string, { message: string; loanId: number }>();
  let logoutError = false;
  let unavailable = false;
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  const session = () => data.users.find((user) => user.userId === identity && user.accountStatus === "ACTIVE");

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const method = route.request().method();
    const body = route.request().postDataJSON() ?? {};
    requests.push({ path, body });
    const reply = (status: number, json: unknown) => route.fulfill({ status, json });
    const ok = (message: string, loanId?: number) => reply(200, { ok: true, message, loanId });
    const error = (status: number, message: string) => reply(status, { detail: { message } });
    const actor = session();

    if (path === "/auth/me") return actor ? reply(200, actor) : error(401, "로그인이 필요합니다.");
    if (path === "/auth/login") {
      if (unavailable) return error(503, "인증 서버에 연결할 수 없습니다.");
      const user = data.users.find((candidate) => candidate.loginId === body.loginId &&
        candidate.accountStatus === "ACTIVE" && body.password === passwordFor(candidate.userId));
      if (!user) return error(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
      identity = user.userId;
      return reply(200, user);
    }
    if (path === "/auth/logout") {
      if (logoutError) return error(503, "로그아웃 요청을 처리하지 못했습니다.");
      identity = null;
      return route.fulfill({ status: 204 });
    }
    if (!actor) return error(401, "로그인이 필요합니다.");
    if (path === "/auth/change-password" && method === "POST") {
      if (body.currentPassword !== passwordFor(actor.userId)) {
        return reply(400, { code: "CURRENT_PASSWORD_MISMATCH", message: "현재 비밀번호가 올바르지 않습니다." });
      }
      passwords.set(actor.userId, body.newPassword);
      identity = null;
      return route.fulfill({ status: 204 });
    }
    if (path === "/library/state") return reply(200, actor.role === "MEMBER" ? {
      ...data,
      users: [actor],
      loans: data.loans.filter((loan) => loan.memberUserId === actor.userId),
      occupiedCopyIds: data.loans.filter((loan) => !loan.isCancelled && !loan.returnedAt).map((loan) => loan.copyId),
    } : data);
    if (path === "/users/staff" && method === "POST") {
      if (actor.role !== "ADMIN") return error(403, "관리자 전용");
      if (!body.password) return error(422, "초기 비밀번호가 필요합니다.");
      data.users.push({ userId: 9999, loginId: body.loginId, fullName: body.fullName, contact: body.contact,
        role: body.role, accountStatus: "ACTIVE", createdAt: new Date().toISOString(), borrowingSuspendedUntil: null });
      return ok("직원 계정을 생성했습니다.");
    }
    if (/^\/users\/staff\/\d+\/status$/.test(path)) {
      const target = data.users.find((user) => user.userId === Number(path.split("/")[3]));
      if (!target) return error(404, "계정 없음");
      target.accountStatus = target.accountStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      return ok("직원 상태를 변경했습니다.");
    }
    if (path === "/users/me" && method === "PATCH") {
      actor.fullName = body.fullName;
      actor.contact = body.contact;
      return ok("본인 정보를 수정했습니다.");
    }
    if (path === "/books" && method === "POST") {
      data.books.push({ bookId: 999, title: body.title, isbn: null, publisher: null,
        publicationYear: null, categoryCode: body.categoryCode });
      data.bookAuthors.push({ bookId: 999, authorId: data.authors[0].authorId });
      return reply(201, { bookId: 999 });
    }
    if (/^\/books\/\d+\/copies$/.test(path)) {
      const copy = { copyId: 9999, bookId: Number(path.split("/")[2]), copyCode: "FIXTURE-9999", managementStatus: "ACTIVE" as const };
      data.copies.push(copy);
      return reply(201, copy);
    }
    if (/^\/books\/copies\/\d+\/status$/.test(path)) {
      const copy = data.copies.find((item) => item.copyId === Number(path.split("/")[3]));
      if (!copy) return error(404, "소장본 없음");
      copy.managementStatus = body.status;
      return reply(200, copy);
    }
    if (path === "/loans/checkout") {
      if (actor.role !== "LIBRARIAN") return error(403, "사서 전용");
      const { requestId, ...payload } = body;
      const key = JSON.stringify([actor.userId, requestId, payload]);
      const previous = requestId && completedCheckouts.get(key);
      if (previous) return ok(previous.message, previous.loanId);
      const due = addDays(getKoreanDate(), 14);
      data.loans.push({ loanId: 9999, copyId: body.copyId, memberUserId: body.memberUserId,
        checkedOutByUserId: actor.userId, borrowedAt: new Date().toISOString(), initialDueDate: due,
        currentDueDate: due, returnedAt: null, returnedByUserId: null, isCancelled: false, cancelledAt: null });
      const result = { message: "대출 완료 · 반납예정일 " + due, loanId: 9999 };
      if (requestId) completedCheckouts.set(key, result);
      if (dropCheckoutResponse) {
        dropCheckoutResponse = false;
        return route.abort("connectionreset");
      }
      return ok(result.message, result.loanId);
    }
    const loan = data.loans.find((item) => item.loanId === Number(path.split("/")[2]));
    if (loan && path.endsWith("/renew")) {
      if (loan.memberUserId !== actor.userId) return error(403, "본인 대출만 연장할 수 있습니다.");
      if (renewalError) return error(409, "연장 처리 충돌");
      const previousDueDate = loan.currentDueDate;
      loan.currentDueDate = addDays(previousDueDate, 7);
      data.renewals.push({ renewalId: 9999, loanId: loan.loanId, renewedAt: new Date().toISOString(),
        previousDueDate, newDueDate: loan.currentDueDate });
      return ok("7일 연장 완료 · " + loan.currentDueDate, loan.loanId);
    }
    if (loan && path.endsWith("/return")) {
      loan.returnedAt = new Date().toISOString();
      loan.returnedByUserId = actor.userId;
      return ok("반납 완료 · 신규 대출 정지를 재계산했습니다.", loan.loanId);
    }
    if (path.endsWith("/correct")) return error(409, "정정 처리 충돌");
    return error(404, "테스트 계약에 없는 요청");
  });

  return {
    data,
    requests,
    setRole(role: UserRole, userId?: number) {
      identity = userId ?? data.users.find((user) => user.role === role && user.accountStatus === "ACTIVE")?.userId ?? null;
    },
    loseNextCheckoutResponse() { dropCheckoutResponse = true; },
    failRenewal(value: boolean) { renewalError = value; },
    failLogout(value: boolean) { logoutError = value; },
    authUnavailable() { unavailable = true; },
  };
}