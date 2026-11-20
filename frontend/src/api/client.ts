export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// 빌드 시점에 주입된다. 비어 있으면 상대 경로(/api/...)를 사용한다.
// 개발에서는 Vite 프록시가, 운영(OCI)에서는 같은 도메인의 nginx가 FastAPI로 전달한다.
// 백엔드가 다른 출처일 때만(예: live E2E) VITE_API_BASE_URL에 FastAPI 주소를 지정한다.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path}`
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const timeout = AbortSignal.timeout(15_000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    signal,
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(response.status, response.ok
      ? "서버 응답 형식이 올바르지 않습니다."
      : `서버 요청에 실패했습니다. (${response.status})`);
  }

  if (!response.ok) {
    const message =
      data?.message ??
      data?.detail?.message ??
      (Array.isArray(data?.detail) ? data.detail[0]?.msg : undefined) ??
      (typeof data?.detail === 'string' ? data.detail : undefined) ??
      `요청 처리 중 오류가 발생했습니다. (${response.status})`
    const code = data?.code ?? data?.detail?.code
    throw new ApiError(response.status, message, code)
  }

  return data as T
}