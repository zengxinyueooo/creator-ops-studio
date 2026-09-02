import type { WorkspaceState } from '../types'

export const demoState: WorkspaceState = {
  activeAccountId: 'manga-account',
  accounts: [
    {
      id: 'manga-account',
      name: '漫画放映室',
      handle: '6831247061',
      kind: 'manga',
      positioning: '用高情绪片段和轻解读，发现值得追的漫画。',
      accent: '#ff5a5f',
      pillars: ['新番追更', '高能片段', '完结安利', '角色观察'],
    },
    {
      id: 'growth-account',
      name: '成长实验室',
      handle: '待创建',
      kind: 'growth',
      positioning: '记录从学习技术、准备求职到进入职场的成长过程。',
      accent: '#6c63ff',
      pillars: ['求职实战', '学习方法', '技术笔记'],
    },
  ],
  comics: [
    {
      id: 'comic-1',
      accountId: 'manga-account',
      title: '雾色心跳',
      platform: '快看漫画',
      status: 'candidate',
      updateWeekday: 5,
      updateNote: '每周五更新',
      selectionNote: '近期持续更新，情绪转折片段讨论度较高，适合继续观察。',
      createdAt: '今天 10:20',
    },
    {
      id: 'comic-2',
      accountId: 'manga-account',
      title: '回声之后',
      platform: '哔哩哔哩漫画',
      status: 'selected',
      updateNote: '已完结',
      selectionNote: '人物关系清晰，已有多个可拆分的高情绪片段。',
      createdAt: '昨天 18:40',
    },
  ],
  topics: [
    { id: 'topic-1', accountId: 'manga-account', title: '周五更新：雨夜告白后的反转', subtitle: '追更作品 · 第 48 话', status: 'research', score: 88, pillar: '新番追更', tags: ['反转', '告白', '高情绪'], dueAt: '周五 20:00', referenceCount: 4, assetCount: 0, updatedAt: '10 分钟前' },
    { id: 'topic-2', accountId: 'manga-account', title: '反派第一次露出破绽的瞬间', subtitle: '经典片段 · 第 112 话', status: 'materials', score: 82, pillar: '高能片段', tags: ['反派', '名场面'], referenceCount: 3, assetCount: 7, updatedAt: '今天 09:42' },
    { id: 'topic-3', accountId: 'manga-account', title: '以为是救赎，其实是新的循环', subtitle: '完结作品 · 结局解读', status: 'review', score: 91, pillar: '完结安利', tags: ['结局', '解读', '意难平'], referenceCount: 6, assetCount: 9, updatedAt: '昨天 22:18' },
    { id: 'topic-4', accountId: 'manga-account', title: '她不是冷漠，只是太早学会告别', subtitle: '角色观察 · 女主成长线', status: 'approved', score: 86, pillar: '角色观察', tags: ['女性成长', '人物弧光'], referenceCount: 2, assetCount: 8, dueAt: '明天 19:30', updatedAt: '昨天 18:03' },
    { id: 'topic-5', accountId: 'growth-account', title: '秋招复盘：我把项目经历讲清楚的方法', subtitle: '真实面试复盘', status: 'idea', score: 79, pillar: '求职实战', tags: ['秋招', '项目介绍'], referenceCount: 2, assetCount: 1, updatedAt: '今天 08:20' },
  ],
  references: [
    { id: 'ref-1', accountId: 'manga-account', title: '谁懂这一页的含金量……', author: '漫画研究所', sourceUrl: 'https://www.xiaohongshu.com/', likes: 12800, collects: 4300, comments: 728, capturedAt: '今天 10:12', insight: '首图直接放反转前一格，正文不剧透结局，评论区讨论欲强。' },
    { id: 'ref-2', accountId: 'manga-account', title: '看到这里我才明白她为什么离开', author: '纸上放映厅', sourceUrl: 'https://www.xiaohongshu.com/', likes: 7600, collects: 2100, comments: 392, capturedAt: '昨天 21:40', insight: '用角色动机做标题，图片按情绪递进排列，适合人物观察栏目。' },
  ],
  researchTasks: [
    { id: 'research-1', accountId: 'manga-account', keyword: '雨夜告白 漫画', purpose: '确认相似片段的历史爆款率与常用标题角度', status: 'queued', limit: 10, createdAt: '今天 10:06' },
  ],
  schedules: [
    { id: 'schedule-1', accountId: 'manga-account', title: '《雾色心跳》固定更新', dateLabel: '周五', kind: 'update' },
    { id: 'schedule-2', accountId: 'manga-account', title: '角色观察发布', dateLabel: '明天 19:30', kind: 'publish' },
    { id: 'schedule-3', accountId: 'manga-account', title: '本周数据复盘', dateLabel: '周日 21:00', kind: 'review' },
  ],
  assets: [],
}
