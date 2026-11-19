export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
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
  const response = await fetch(path, {
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