import { describe, expect, it } from 'vitest'
import { splitCitedSources } from '../src/pipeline/answer.js'

// A parent asks two things in one message, so the answer rests on two sources.
// FLOW: model calls two tools -> cites both -> every id checked -> answered, or discarded
// 1. one question is often two questions: "what time do you close and what if I am late"
// 2. an answer resting on two tools must cite both, or half of it is unsourced
// 3. one invented id among several is still an invented id -- the whole answer goes

describe('reading the sources an answer claims', () => {
  it('reads a single source', () => {
    expect(splitCitedSources('center:hours')).toEqual(['center:hours'])
  })

  it('reads two sources separated by a comma', () => {
    expect(splitCitedSources('center:hours, abc@1')).toEqual(['center:hours', 'abc@1'])
  })

  it('copes with the model using "and" instead of a comma', () => {
    expect(splitCitedSources('center:hours and abc@1')).toEqual(['center:hours', 'abc@1'])
  })

  it('ignores empty pieces from a trailing comma', () => {
    expect(splitCitedSources('center:hours, ')).toEqual(['center:hours'])
  })

  it('returns nothing for a blank line', () => {
    expect(splitCitedSources('')).toEqual([])
  })

  it('returns nothing when the model cited nothing', () => {
    expect(splitCitedSources(null)).toEqual([])
  })

  it('trims whitespace the model left around an id', () => {
    expect(splitCitedSources('  center:hours ,  abc@1  ')).toEqual(['center:hours', 'abc@1'])
  })

  it('drops a bare "none", which is the model saying it claimed no fact', () => {
    expect(splitCitedSources('none')).toEqual([])
  })
})
