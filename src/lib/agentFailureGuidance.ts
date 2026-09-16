export function agentFailureGuidance(message = '') {
  if (/额度|usage limit|quota|429/i.test(message)) return '检查模型账户额度后再试。'
  if (/登录|认证|unauthorized|401|token|jwt/i.test(message)) return '重新登录相关服务后再试。'
  if (/访问被拒绝|权限|验证|403|SECURITY_BLOCK|Navigation rejected/i.test(message)) return '检查浏览器登录状态、页面验证和访问权限。'
  if (/网络|连接|fetch failed|ECONN|502|503|504/i.test(message)) return '确认本地页面服务和网络连接正常后再试。'
  if (/超时|timeout|TimeoutError/i.test(message)) return '确认本地服务仍在线，稍后重新执行。'
  return '根据错误提示修复问题后重新执行。'
}
