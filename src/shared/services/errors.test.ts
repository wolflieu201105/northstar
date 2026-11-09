import { describe, expect, it } from 'vitest'
import { serviceError } from './errors'

describe('revision conflict compatibility', () => {
  it.each(['40001', 'PT409'])('recognizes %s as a conflict requiring draft review', (code) => {
    expect(serviceError({ code, message: 'Server revision mismatch' })).toMatchObject({
      code: '40001', uncertain: false,
      message: 'This record changed. Reload it and review your draft before saving again.',
    })
  })
})
