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

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

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