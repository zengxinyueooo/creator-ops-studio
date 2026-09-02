import { describe, expect, it } from 'vitest'
import { demoState } from './demo'

describe('demo workspace', () => {
  it('contains the two planned creator accounts', () => {
    expect(demoState.accounts).toHaveLength(2)
    expect(demoState.accounts.map((account) => account.kind)).toEqual(['manga', 'growth'])
  })

  it('keeps all demo records inside an existing account', () => {
    const accountIds = new Set(demoState.accounts.map((account) => account.id))
    expect(demoState.topics.every((topic) => accountIds.has(topic.accountId))).toBe(true)
    expect(demoState.researchTasks.every((task) => accountIds.has(task.accountId))).toBe(true)
  })

  it('uses conservative OpenCLI result limits', () => {
    expect(demoState.researchTasks.every((task) => task.limit <= 20)).toBe(true)
  })
})
