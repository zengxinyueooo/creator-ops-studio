import { expect, it } from 'vitest'
import { demoState } from '../data/demo'
import { briefTransition, manualTransitionError } from './topicWorkflow'
import { createTemplateBrief } from './briefGeneration'

const topic = { ...demoState.topics[0], brief: { ...createTemplateBrief(demoState.topics[0], demoState.comics[0], []), status: 'approved' as const } }
it('returns regenerated and rejected planning to research and preserves repeated approval progress', () => {
  expect(briefTransition({ ...topic, status: 'draft' }, 'candidate')).toBe('research')
  expect(briefTransition({ ...topic, status: 'review' }, 'rejected')).toBe('research')
  expect(briefTransition({ ...topic, status: 'draft' }, 'approved')).toBe('draft')
  expect(briefTransition({ ...topic, status: 'research', brief: { ...topic.brief, status: 'candidate' } }, 'approved')).toBe('materials')
})
it('locks published history and prevents bypassing brief approval or publishing records', () => {
  expect(() => briefTransition({ ...topic, status: 'published' }, 'approved')).toThrow()
  expect(manualTransitionError({ ...topic, status: 'published' }, 'idea')).not.toBe('')
  expect(manualTransitionError({ ...topic, status: 'research', brief: { ...topic.brief, status: 'candidate' } }, 'draft')).not.toBe('')
  expect(manualTransitionError({ ...topic, status: 'draft' }, 'published')).not.toBe('')
})
