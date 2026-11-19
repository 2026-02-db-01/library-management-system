import { installApiFixture } from "./api-fixture";
import { test, expect } from "@playwright/test";
test("staff account CRUD, patron profile, catalog CRUD, copy states and server conflict handling", async ({
  page,
}) => {
  const api = await installApiFixture(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  api.setRole("ADMIN");
  await page.goto("/admin/members");
  await page.getByRole("button", { name: "직원 계정 생성" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("로그인 ID").fill("staff.ui");
  await dialog.getByLabel("이름", { exact: true }).fill("UI 직원");
  await dialog.getByLabel("연락처").fill("01088888888");
  await dialog.getByLabel("초기 비밀번호").fill("new-staff-test-password");
  await dialog.getByRole("button", { name: "직원 생성", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const row = page.getByRole("row").last();
  await row.getByRole("button", { name: "비활성화" }).click();
  await page.getByRole("dialog").getByLabel("변경 사유").fill("테스트 휴직");
  await page.getByRole("button", { name: "상태 변경 확정" }).click();
  await expect(page.getByRole("row").last()).toContainText("INACTIVE");
  await page
    .getByRole("row")
    .last()
    .getByRole("button", { name: "재활성화" })
    .click();
  await page.getByRole("dialog").getByLabel("변경 사유").fill("복직");
  await page.getByRole("button", { name: "상태 변경 확정" }).click();
  await expect(page.getByRole("row").last()).toContainText("ACTIVE");
  api.setRole("MEMBER");
  await page.goto("/account");
  await page.getByLabel("이름", { exact: true }).fill("김하늘 수정");
  await page.getByRole("button", { name: "본인 정보 저장" }).click();
  await expect(
    page.getByText("본인 정보를 수정했습니다.", { exact: false }),
  ).toBeVisible();
  api.setRole("LIBRARIAN");
  await page.goto("/librarian/books");
  await page.getByRole("button", { name: "도서 등록", exact: true }).click();
  await dialog.getByLabel("도서 제목").fill("UI 신규 도서");
  await dialog.getByPlaceholder("저자 이름").fill("한강");
  await dialog.getByRole("button", { name: "도서 등록", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const bookRow = page.getByRole("row").filter({ hasText: "UI 신규 도서" });
  await bookRow.getByRole("button", { name: "정보·소장본" }).click();
  await dialog.getByRole("button", { name: "추가", exact: true }).click();
  await expect(
    dialog.getByText("소장본 등록 완료", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/librarian/copies");
  const copyRow = page.getByRole("row").filter({ hasText: "UI 신규 도서" });
  await copyRow.getByRole("button", { name: "상태 변경" }).click();
  await dialog.getByLabel("새 상태").selectOption("DAMAGED");
  await dialog.getByLabel("사유", { exact: true }).fill("파손 확인");
  await dialog.getByRole("button", { name: "변경 확정" }).click();
  await expect(copyRow).toContainText("DAMAGED");
  await page.goto("/librarian/corrections");
  await page.getByLabel("정정 사유").fill("업무 입력 오류");
  await page.getByLabel("실물 회수 또는 실제 미반출을 확인했습니다.").check();
  expect(api.data.corrections).toHaveLength(0);
  await page.getByRole("button", { name: "정정 확정" }).click();
  await expect(
    page.getByText("정정 처리 충돌", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "DB 흐름 보기", exact: true }).click();
  await expect(page.getByRole("button", { name: "DB 흐름 보기" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/ROLLBACK/)).toHaveCount(0);
  expect(api.data.corrections).toHaveLength(0);
  expect(errors).toEqual([]);
});
