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
      title: '溯洄春时',
      platform: '快看漫画',
      status: 'candidate',
      serializationStatus: 'ongoing',
      updateWeekday: 5,
      updateNote: '每周五更新',
      selectionNote: '近期持续更新，情绪转折片段讨论度较高，适合继续观察。',
      createdAt: '今天 10:20',
    },
    {
      id: 'comic-2',
      accountId: 'manga-account',
      title: '回声之后',
      platform: '快看漫画',
      status: 'selected',
      serializationStatus: 'completed',
      updateNote: '',
      selectionNote: '人物关系清晰，已有多个可拆分的高情绪片段。',
      createdAt: '昨天 18:40',
    },
  ],
  topics: [
    { id: 'topic-1', accountId: 'manga-account', comicId: 'comic-1', title: '她主动靠近后，他的脸红藏不住了', subtitle: '《溯洄春时》· 追更互动向', status: 'materials', score: 88, pillar: '新番追更', tags: ['暧昧', '脸红', '角色互动'], dueAt: '周五 20:00', referenceCount: 4, assetCount: 3, updatedAt: '10 分钟前', brief: { status: 'candidate', angle: '用栩听主动靠近与晏的害羞反应，呈现关系升温的瞬间。', coreEmotion: '暧昧、心动、轻松', hook: '他明明什么都没说，脸红已经把答案交代完了。', structure: ['用最直观的互动动作开场', '补充男主反应形成反差', '用一句个人感受收束并邀请讨论'], assetGuidance: ['主动靠近或触碰动作', '男主脸红特写', '两人同框或对视画面'], avoidances: ['不提前剧透后续剧情', '不照搬来源笔记句式'] } },
    { id: 'topic-2', accountId: 'manga-account', title: '反派第一次露出破绽的瞬间', subtitle: '经典片段 · 第 112 话', status: 'materials', score: 82, pillar: '高能片段', tags: ['反派', '名场面'], referenceCount: 3, assetCount: 7, updatedAt: '今天 09:42' },
    { id: 'topic-3', accountId: 'manga-account', title: '以为是救赎，其实是新的循环', subtitle: '完结作品 · 结局解读', status: 'review', score: 91, pillar: '完结安利', tags: ['结局', '解读', '意难平'], referenceCount: 6, assetCount: 9, updatedAt: '昨天 22:18' },
    { id: 'topic-4', accountId: 'manga-account', title: '她不是冷漠，只是太早学会告别', subtitle: '角色观察 · 女主成长线', status: 'approved', score: 86, pillar: '角色观察', tags: ['女性成长', '人物弧光'], referenceCount: 2, assetCount: 8, dueAt: '明天 19:30', updatedAt: '昨天 18:03' },
    { id: 'topic-5', accountId: 'growth-account', title: '秋招复盘：我把项目经历讲清楚的方法', subtitle: '真实面试复盘', status: 'idea', score: 79, pillar: '求职实战', tags: ['秋招', '项目介绍'], referenceCount: 2, assetCount: 1, updatedAt: '今天 08:20' },
  ],
  references: [
    { id: 'ref-1', accountId: 'manga-account', comicId: 'comic-1', title: '晏，你脸红啦？', author: '昨日雨', sourceUrl: 'https://www.xiaohongshu.com/', likes: 2260, collects: 0, comments: 0, capturedAt: '今天 10:12', insight: '互动动作和脸红反应形成明确情绪钩子。', body: '演示详情：围绕角色靠近后的害羞反应展开，正式采集时保存来源笔记原始正文。', publishedAt: '6 天前', imageCount: 6, detailStatus: 'detailed', reviewStatus: 'kept' },
    { id: 'ref-2', accountId: 'manga-account', comicId: 'comic-1', title: '听听好美！！', author: 'Banana.', sourceUrl: 'https://www.xiaohongshu.com/', likes: 123, collects: 0, comments: 0, capturedAt: '昨天 21:40', insight: '适合作为人物状态与画风补充证据。', body: '演示详情：短句表达，以人物视觉亮点为主。', publishedAt: '4 天前', imageCount: 4, detailStatus: 'detailed', reviewStatus: 'candidate' },
  ],
  researchTasks: [
    { id: 'research-1', accountId: 'manga-account', comicId: 'comic-1', keyword: '溯洄春时', keywords: ['溯洄春时', '溯洄春时 最新话', '溯洄春时 特典'], purpose: '收集一周内高互动图文，去重后保留 10 条进入详情审核', status: 'queued', limit: 10, createdAt: '今天 10:06', filters: { noteType: 'image', publishedWithin: 'week', scope: 'unseen', sort: 'most_liked' } },
  ],
  schedules: [
    { id: 'schedule-1', accountId: 'manga-account', title: '《溯洄春时》固定更新', dateLabel: '周五', kind: 'update' },
    { id: 'schedule-2', accountId: 'manga-account', title: '角色观察发布', dateLabel: '明天 19:30', kind: 'publish' },
    { id: 'schedule-3', accountId: 'manga-account', title: '本周数据复盘', dateLabel: '周日 21:00', kind: 'review' },
  ],
  assets: [
    { id: 'asset-1', accountId: 'manga-account', comicId: 'comic-1', storagePath: '', originalName: '互动-01.jpg', mimeType: 'image/jpeg', byteSize: 842000, sourceType: 'xiaohongshu', tags: ['主动靠近', '互动'], workName: '溯洄春时', chapter: '待确认', copyrightStatus: 'reference_only', createdAt: '今天 10:31', topicId: 'topic-1', topicIds: ['topic-1'], visualFormat: 'single', classificationConfidence: 0.94, classificationNote: '未发现独立图片拼接边界', reviewStatus: 'available', contentType: 'interaction', characters: ['栩听', '晏'], usageCount: 0, coverUsageCount: 0 },
    { id: 'asset-2', accountId: 'manga-account', comicId: 'comic-1', storagePath: '', originalName: '脸红-02.jpg', mimeType: 'image/jpeg', byteSize: 736000, sourceType: 'xiaohongshu', tags: ['脸红', '特写'], workName: '溯洄春时', chapter: '待确认', copyrightStatus: 'reference_only', createdAt: '今天 10:31', topicId: 'topic-1', topicIds: ['topic-1'], visualFormat: 'single', classificationConfidence: 0.91, classificationNote: '单一连续画面', reviewStatus: 'available', contentType: 'character', characters: ['晏'], usageCount: 1, coverUsageCount: 0, lastUsedAt: '32 天前' },
    { id: 'asset-3', accountId: 'manga-account', comicId: 'comic-1', storagePath: '', originalName: '对视-03.jpg', mimeType: 'image/jpeg', byteSize: 918000, sourceType: 'xiaohongshu', tags: ['对视', '同框'], workName: '溯洄春时', chapter: '待确认', copyrightStatus: 'reference_only', createdAt: '今天 10:32', topicId: 'topic-1', topicIds: ['topic-1'], visualFormat: 'single', classificationConfidence: 0.88, classificationNote: '单一连续画面', reviewStatus: 'available', contentType: 'interaction', characters: ['栩听', '晏'], usageCount: 2, coverUsageCount: 1, lastUsedAt: '18 天前' },
    { id: 'asset-4', accountId: 'manga-account', comicId: 'comic-1', storagePath: '', originalName: '台词-04.jpg', mimeType: 'image/jpeg', byteSize: 690000, sourceType: 'xiaohongshu', tags: ['台词', '暧昧'], workName: '溯洄春时', chapter: '待确认', copyrightStatus: 'reference_only', createdAt: '今天 10:32', topicIds: [], visualFormat: 'single', classificationConfidence: 0.86, classificationNote: '单张漫画截图', reviewStatus: 'available', contentType: 'dialogue', characters: ['栩听'], usageCount: 0, coverUsageCount: 0 },
    { id: 'asset-5', accountId: 'manga-account', comicId: 'comic-1', storagePath: '', originalName: '拼图-05.jpg', mimeType: 'image/jpeg', byteSize: 1210000, sourceType: 'xiaohongshu', tags: ['拼图'], workName: '溯洄春时', chapter: '待确认', copyrightStatus: 'reference_only', createdAt: '今天 10:33', topicIds: [], visualFormat: 'collage', classificationConfidence: 0.97, classificationNote: '检测到两张独立截图的拼接边界', reviewStatus: 'rejected', contentType: 'other', characters: ['栩听', '晏'], usageCount: 0, coverUsageCount: 0 },
    { id: 'asset-6', accountId: 'manga-account', comicId: 'comic-1', storagePath: '', originalName: '待确认-06.jpg', mimeType: 'image/jpeg', byteSize: 804000, sourceType: 'xiaohongshu', tags: ['待确认'], workName: '溯洄春时', chapter: '待确认', copyrightStatus: 'reference_only', createdAt: '今天 10:33', topicIds: [], visualFormat: 'uncertain', classificationConfidence: 0.56, classificationNote: '边缘结构接近拼图，需要人工确认', reviewStatus: 'pending', contentType: 'atmosphere', characters: [], usageCount: 0, coverUsageCount: 0 },
  ],
}
