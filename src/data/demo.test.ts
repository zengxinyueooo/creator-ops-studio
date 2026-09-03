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
    expect(demoState.assets.every((asset) => accountIds.has(asset.accountId))).toBe(true)
  })

  it('uses bounded, comic-linked OpenCLI batches', () => {
    expect(demoState.researchTasks.every((task) => task.limit <= 10)).toBe(true)
    expect(demoState.researchTasks.every((task) => task.keywords.length >= 2 && task.keywords.length <= 3)).toBe(true)
    expect(demoState.researchTasks.every((task) => demoState.comics.some((comic) => comic.id === task.comicId))).toBe(true)
  })

  it('only links selectable single-image assets to topics', () => {
    const linkedAssets = demoState.assets.filter((asset) => asset.topicIds.length > 0)
    expect(linkedAssets.every((asset) => asset.visualFormat === 'single' && asset.reviewStatus === 'available')).toBe(true)
    for (const topic of demoState.topics) {
      const linkedCount = demoState.assets.filter((asset) => asset.topicIds.includes(topic.id)).length
      if (linkedCount > 0) expect(topic.assetCount).toBe(linkedCount)
    }
  })
})
