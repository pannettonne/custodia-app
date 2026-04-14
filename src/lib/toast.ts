export type ToastTone = 'success' | 'error' | 'info'

export type ToastDetail = {
  message: string
  tone?: ToastTone
}

export function showToast(detail: ToastDetail | string) {
  if (typeof window === 'undefined') return
  const normalized = typeof detail === 'string' ? { message: detail, tone: 'success' as ToastTone } : detail
  window.dispatchEvent(new CustomEvent('custodia:toast', { detail: normalized }))
}
