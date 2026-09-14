export type RunErrorCategory = 'quota' | 'authentication' | 'access' | 'timeout' | 'network' | 'validation' | 'unknown'

export type ClassifiedRunError = {
  category: RunErrorCategory
  retryable: boolean
  message: string
  original: string
}

function rawError(error: unknown) {
  const value = error as { name?: unknown; message?: unknown; code?: unknown; cause?: { code?: unknown } } | null
  return [value?.name, value?.code, value?.message, value?.cause?.code]
    .filter((item) => typeof item === 'string' && item)
    .join(' · ')
    .replace(/https?:\/\/[^\s]+/g, '[链接已隐藏]')
    .slice(0, 600) || '未知错误（未提供错误详情）'
}

export function classifyRunError(error: unknown): ClassifiedRunError {
  const original = rawError(error)
  const cases: Array<[RunErrorCategory, RegExp, boolean, string]> = [
    ['quota', /usage limit|quota|余额|额度|insufficient[_ ]quota|429/i, false, '模型额度不足，请检查模型账户额度后重新执行'],
    ['authentication', /未登录|登录失效|unauthorized|invalid.*token|jwt|401/i, false, '登录或认证已失效，请重新登录相关服务后再试'],
    ['access', /SECURITY_BLOCK|Navigation rejected|访问拒绝|forbidden|权限|403|验证/i, false, '当前访问被拒绝或需要人工验证，请检查页面登录状态与权限'],
    ['timeout', /TimeoutError|ETIMEDOUT|timeout|超时|aborted/i, true, '外部服务响应超时，本次任务已安全停止；请稍后重试'],
    ['network', /fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|network|连接失败|502|503|504/i, true, '网络或本地服务暂时不可用，本次任务已安全停止；请检查服务后重试'],
    ['validation', /必须|只能|缺少|请选择|不属于|不再保留|尚未|不可生成|已发布/i, false, original],
  ]
  const matched = cases.find(([, pattern]) => pattern.test(original))
  if (!matched) return { category: 'unknown', retryable: false, message: original, original }
  const [category, , retryable, guidance] = matched
  return { category, retryable, message: guidance === original ? original : `${guidance}（${original}）`, original }
}

export function isTransientReadError(error: unknown) {
  const result = classifyRunError(error)
  return result.category === 'network' || result.category === 'timeout'
}
