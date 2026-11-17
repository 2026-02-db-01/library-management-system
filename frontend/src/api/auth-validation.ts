export type AuthValues = { loginId: string; password: string; confirm: string; fullName: string; contact: string };
export function validateAuth(v: AuthValues, signup: boolean): Partial<Record<keyof AuthValues, string>> {
  const errors: Partial<Record<keyof AuthValues, string>> = {};
  if (!v.loginId.trim() || v.loginId.trim().length > 50) errors.loginId = "로그인 ID를 1~50자로 입력하세요.";
  if (!v.password) errors.password = "비밀번호를 입력하세요.";
  if (signup) {
    if (!v.confirm || v.password !== v.confirm) errors.confirm = "비밀번호 확인이 일치하지 않습니다.";
    if (!v.fullName.trim() || v.fullName.trim().length > 100) errors.fullName = "이름을 1~100자로 입력하세요.";
    if (!/^\d{10,11}$/.test(v.contact.replace(/\D/g, ""))) errors.contact = "휴대전화번호를 숫자 10~11자리로 입력하세요.";
  }
  return errors;
}
