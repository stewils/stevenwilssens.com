// The brief for the Site update workflow (.github/workflows/site-update.yml): the title and
// the instruction Claude Code gets. Started by hand or from the MCP server, both come from
// the inputs. Started by a check-in on a project with a Building write-up (the project's
// "Building write-up" workflow sends a repository_dispatch after every push to its main
// branch), the instruction is written here: refresh the article from the project's
// CLAUDE.md and the commits that were pushed. Writes the outputs to $GITHUB_OUTPUT.
//
//   EVENT=workflow_dispatch INPUT_TITLE=... INPUT_INSTRUCTION=... node scripts/building-brief.mjs
//   EVENT=repository_dispatch PAYLOAD='{"project":"wilssens","sha":"...","before":"...","subject":"..."}' node scripts/building-brief.mjs
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { _comment, ...projects } = JSON.parse(readFileSync(resolve('src/articles/sources.json'), 'utf8'))
void _comment

export const brief = ({ event, title, instruction, payload, today = new Date() }) => {
  if (event !== 'repository_dispatch') {
    if (!title?.trim() || !instruction?.trim()) return { skip: 'The title and the instruction are both needed.' }
    return { title: title.trim(), instruction: instruction.trim(), project: '', repository: '', ref: '', before: '', sources: '', origin: 'a request made through the MCP server' }
  }
  const key = String(payload?.project ?? '')
  const project = projects[key]
  if (!project) return { skip: `Unknown project "${key}"; src/articles/sources.json lists ${Object.keys(projects).join(', ')}.` }
  if (!project.article) return { skip: `${project.name} has no Building write-up yet (src/articles/sources.json); nothing to refresh.` }
  const sha = String(payload.sha ?? '')
  if (!/^[0-9a-f]{7,40}$/.test(sha)) return { skip: 'The payload names no commit (sha).' }
  const before = /^[0-9a-f]{7,40}$/.test(String(payload.before ?? '')) && !/^0+$/.test(payload.before) ? payload.before : ''
  const subject = String(payload.subject ?? '').split('\n')[0].trim()
  const date = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const folder = project.article.replace(/\/[^/]+$/, '')
  const lines = [
    `Refresh the Building write-up about ${project.name} (/${project.page}, ${project.article}) after a check-in on ${project.repository}${subject ? `: "${subject}"` : ''}.`,
    '',
    'Read, in this order:',
    `1. sources/${key}.log: the commits that were pushed (up to ${sha.slice(0, 7)}).`,
    `2. sources/${key}.diff: what changed in ${project.sources.join(', ')} since the push before${before ? '' : ' (the whole files when there was no push before)'}.`,
    `3. sources/${key}/CLAUDE.md and the other files named above, for the facts as they stand now. They are the project's source of truth; the write-up must agree with them.`,
    `4. ${folder}/feed.json: the project's live numbers, fetched just now; the headline figures of the article read from it, so do not type numbers that are in the feed into the text.`,
    '',
    'Then:',
    `- Where the write-up says something the files no longer say (a decision reversed, a number, a mechanism, a plan that shipped or was dropped, a name), change the text, the diagrams (${folder}/Diagrams.tsx) and the captions so they agree with the files. Keep the structure, the voice and the length: Steven writing for recruiters and hiring managers, first person, plain English.`,
    '- Add something only when the check-in is a decision or an outcome a reader would miss: a new level, a new mechanism, a public milestone. Small code changes, fixes and to-dos are not worth a sentence.',
    `- Update the "as of" date in the file's header comment and in the closing section to ${date}.`,
    '- Leave out anything private: credentials and secret names, internal costs and limits that are not on the project\'s public site, unreleased dates, named family members or colleagues, anything the files mark as private or internal. When unsure, leave it out and list it in your summary.',
    '- Do not invent facts or numbers. When the files contradict each other, keep what the write-up says and list the contradiction.',
    '- When nothing in the write-up needs to change, change nothing and say so.',
    '',
    'Do not touch src/resume.ts or any other page.',
  ]
  const head = `Building ${project.name}: ${subject || 'refresh after a check-in'}`
  return {
    title: head.length > 72 ? `${head.slice(0, 71).trimEnd()}…` : head,
    instruction: lines.join('\n'),
    project: key,
    repository: project.repository,
    ref: sha,
    before,
    sources: project.sources.join(' '),
    origin: `a check-in on ${project.repository}${payload.compare ? ` (${payload.compare})` : ''}`,
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let payload = null
  try { payload = process.env.PAYLOAD ? JSON.parse(process.env.PAYLOAD) : null } catch { payload = null }
  const result = brief({ event: process.env.EVENT, title: process.env.INPUT_TITLE, instruction: process.env.INPUT_INSTRUCTION, payload })
  const out = process.env.GITHUB_OUTPUT
  const write = (name, value) => { if (out) appendFileSync(out, `${name}<<BRIEF_EOF\n${value}\nBRIEF_EOF\n`); else console.log(`${name}=${value}`) }
  if (result.skip) {
    console.log(`::warning::${result.skip}`)
    write('skip', 'true')
  } else {
    write('skip', 'false')
    for (const [name, value] of Object.entries(result)) write(name, value)
    console.log(`Brief: ${result.title}\n\n${result.instruction}`)
  }
}
