type Message = { role: string; stopReason?: string; errorMessage?: string; isError?: boolean; content?: unknown }

export function runFailure(messages: readonly Message[], saved: boolean, workflowLabel = '调研'): string | undefined {
  const text = (content: unknown) => Array.isArray(content)
    ? content.filter((item) => item?.type === 'text').map((item) => String(item.text)).join('\n')
    : ''
  const toolError = messages.find((message) => message.role === 'toolResult' && message.isError)
  if (toolError) return `${workflowLabel}工具失败：${text(toolError.content) || '工具未返回错误详情'}`
  const modelError = messages.findLast((message) => message.role === 'assistant' && ['error', 'aborted'].includes(message.stopReason ?? ''))
  if (modelError) return `Pi 模型请求失败：${modelError.errorMessage || modelError.stopReason}`
  if (!saved) {
    const last = messages.findLast((message) => message.role === 'assistant')
    return `${workflowLabel}未完成：${text(last?.content).slice(0, 600) || '模型没有调用保存工具'}`
  }
}

export async function readSearchResponse(response: Response) {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('调研服务返回了网页而非 JSON，请检查 CREATOR_OPS_APP_URL 是否指向 studio 页面服务')
  }
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || `本地 OpenCLI 服务返回 ${response.status}`)
  if (!Array.isArray(body.results)) throw new Error('调研服务缺少 results 数组')
  return body
}
