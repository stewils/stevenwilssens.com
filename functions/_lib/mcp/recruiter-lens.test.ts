// The recruiter lens on made-up roles, so every date rule stays tested now that Steven's
// own timeline (rightly) trips none of them: overlaps, gaps, short stints, plateaus,
// company changes, and the two boundaries that must stay quiet.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '../../../src/resume'

const data = vi.hoisted(() => ({ experiences: [] as Entry[] }))
vi.mock('../../../src/resume', async (importOriginal) => ({ ...await importOriginal<typeof import('../../../src/resume')>(), experiences: data.experiences }))

const { recruiterLens } = await import('./tools')

const role = (overrides: Partial<Entry>): Entry => ({ key: 'k', role: 'Engineer', company: 'Contoso', dates: 'Jan 2000 - Dec 2000', location: 'Seattle', summary: 'Summary.', points: [], ...overrides })
const flags = (key: string) => recruiterLens(key).flags

beforeEach(() => {
  // Newest first, as in src/resume.ts.
  data.experiences.splice(0, Infinity,
    role({ key: 'plateau', role: 'Senior Engineer', company: 'Fabrikam', dates: 'Jan 2019 - Dec 2023' }),
    role({ key: 'same-month', role: 'Engineer', company: 'Fabrikam', dates: 'Jan 2018 - Dec 2018' }),
    role({ key: 'gap', role: 'Developer', company: 'Fabrikam', dates: 'Apr 2007 - Jan 2018' }),
    role({ key: 'short', role: 'Consultant', company: 'Northwind', dates: 'Jan 2006 - Nov 2006' }),
    role({ key: 'month-after', role: 'Developer', company: 'Cosmos', dates: 'Jan 2005 - Dec 2005' }),
    role({ key: 'overlap', role: 'Trainer', company: 'Info Support', dates: 'Jan 2004 - Dec 2004' }),
    role({ key: 'first', role: 'Developer and Trainer', company: 'Info Support', dates: 'Jan 2001 - Dec 2004' }),
  )
})

describe('the recruiter lens on made-up roles', () => {
  it('flags an overlap with the role before', () => {
    expect(flags('overlap')).toContain('Overlaps with Developer and Trainer at Info Support (Jan 2001 - Dec 2004).')
  })

  it('flags neither an overlap nor a gap when a role starts the month the last one ends, or the month after', () => {
    for (const key of ['same-month', 'month-after']) expect(flags(key).filter((flag) => /Overlaps|unaccounted/.test(flag)), key).toEqual([])
    expect(flags('month-after')).toEqual(['Company change from Info Support.'])
  })

  it('flags the months between two roles', () => {
    expect(flags('gap')).toContain('4 months unaccounted for before this role.')
  })

  it('flags a short stint, a plateau and a company change, and no change within one company', () => {
    expect(flags('short')).toEqual(['Short stint: 11 months.', 'Company change from Cosmos.'])
    expect(flags('plateau')).toEqual(['5 years in one role without a visible promotion.'])
    expect(flags('gap')).toContain('Company change from Northwind.')
    expect(flags('same-month').some((flag) => flag.startsWith('Company change'))).toBe(false)
  })

  it('has nothing to say about the first role, or a role it does not know', () => {
    expect(flags('first')).toEqual([])
    expect(recruiterLens('nobody')).toEqual({ flags: [], angles: [] })
  })
})
