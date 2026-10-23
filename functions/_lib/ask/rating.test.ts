// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CRITERIA, isGood, isModel, isPoor, isRateable, isWrong, OVERALL, parseRating } from './rating'

const good = { id: 7, accurate: 'yes', supported: 'partly', answers: 'yes', tone: 'yes', overall: 4 }
const parse = (body: unknown) => parseRating(typeof body === 'string' ? body : JSON.stringify(body))

describe('the rubric', () => {
  it('has four criteria, n/a only on Supported and Tone and length, and five anchors', () => {
    expect(CRITERIA.map((c) => [c.label, c.na])).toEqual([['Accurate', false], ['Supported', true], ['Answers the question', false], ['Tone and length', true]])
    expect(Object.keys(OVERALL)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('good is 4 or 5 on an accurate answer; Accurate No is wrong and poor whatever the score', () => {
    expect([1, 2, 3, 4, 5].map((overall) => isGood({ accurate: 'yes', overall }))).toEqual([false, false, false, true, true])
    expect(isGood({ accurate: 'no', overall: 5 })).toBe(false)
    expect(isWrong({ accurate: 'no' })).toBe(true)
    expect(isWrong({ accurate: 'partly' })).toBe(false)
    expect([1, 2, 3].map((overall) => isPoor({ accurate: 'yes', overall }))).toEqual([true, true, false])
    expect(isPoor({ accurate: 'no', overall: 4 })).toBe(true)
  })

  it('counts the configured model and its dated id, never a longer name that starts with it', () => {
    expect(isModel('claude-opus-5-5', 'claude-opus-5-5')).toBe(true)
    expect(isModel('claude-opus-5-5-20261001', 'claude-opus-5-5')).toBe(true)
    expect(isModel('claude-opus-5-5', 'claude-opus-5')).toBe(false)
    expect(isModel('claude-opus-5-5-2026100', 'claude-opus-5-5')).toBe(false)
    expect(isModel('claude-opus-5-5-x20261001', 'claude-opus-5-5')).toBe(false)
  })
})

describe('parsing a rating', () => {
  it('takes a whole rating, with or without a note and the box', () => {
    expect(parse(good)).toEqual({ ok: true, value: { ...good, note: null, addToQuestions: false } })
    expect(parse({ ...good, note: '  Missed the\tteam size.\n\u0007Fix it.  ', addToQuestions: true })).toEqual({ ok: true, value: { ...good, note: 'Missed the\tteam size.\nFix it.', addToQuestions: true } })
    expect(parse({ ...good, note: null })).toMatchObject({ ok: true, value: { note: null } })
    expect(parse({ ...good, note: '   ' })).toMatchObject({ ok: true, value: { note: null } })
    expect(parse({ ...good, note: 'x'.repeat(1000) })).toMatchObject({ ok: true })
    expect(parse({ ...good, supported: 'na', tone: 'na' })).toMatchObject({ ok: true, value: { supported: 'na', tone: 'na' } })
  })

  it.each([
    ['not JSON', '{bad', 'body'],
    ['an array', [], 'body'],
    ['null', null, 'body'],
    ['an unknown key', { ...good, question: 'Forged' }, 'keys'],
    ['id -1', { ...good, id: -1 }, 'id'],
    ['id 0', { ...good, id: 0 }, 'id'],
    ['id 1.5', { ...good, id: 1.5 }, 'id'],
    ['id "7"', { ...good, id: '7' }, 'id'],
    ['an unsafe id', { ...good, id: 2 ** 60 }, 'id'],
    ['criterion maybe', { ...good, accurate: 'maybe' }, 'accurate'],
    ['a missing criterion', { ...good, tone: undefined }, 'tone'],
    ['n/a on Accurate', { ...good, accurate: 'na' }, 'accurate'],
    ['n/a on Answers the question', { ...good, answers: 'na' }, 'answers'],
    ['overall 0', { ...good, overall: 0 }, 'overall'],
    ['overall 6', { ...good, overall: 6 }, 'overall'],
    ['overall 4.5', { ...good, overall: 4.5 }, 'overall'],
    ['overall "4"', { ...good, overall: '4' }, 'overall'],
    ['overall null', { ...good, overall: null }, 'overall'],
    ['overall 1e3', { ...good, overall: 1e3 }, 'overall'],
    ['a 1,001-character note', { ...good, note: 'x'.repeat(1001) }, 'note'],
    ['a note that is not text', { ...good, note: 5 }, 'note'],
    ['a box that is not a boolean', { ...good, addToQuestions: 'yes' }, 'addToQuestions'],
  ])('refuses %s and names the field', (_, body, field) => {
    expect(parse(body)).toEqual({ ok: false, field })
  })
})

describe('what can be rated', () => {
  it('only answers the model gave: answered, gap and off, a question or a fit check', () => {
    expect(['answered', 'gap', 'off', 'limited', 'failed'].map((outcome) => isRateable({ outcome, kind: 'question' }))).toEqual([true, true, true, false, false])
    expect(isRateable({ outcome: 'answered', kind: 'fit' })).toBe(true)
    expect(isRateable({ outcome: 'answered', kind: 'other' })).toBe(false)
  })
})
