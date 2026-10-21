// Job A of the Review workflow's assistant check: writes what this tree's assistant reads
// (functions/_lib/assistant-input.ts) as JSON. Bundled with `vite build --ssr` (the repository's
// imports have no extensions) and run after `npm run build`, so dist/ holds the write-ups.
//
//   node <bundle>/assistant-export.js <dist folder> <notes url> <out.json>
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assistantInput } from '../functions/_lib/assistant-input'

const [dist, notesUrl, out] = process.argv.slice(2)
try {
  const input = await assistantInput({ readPage: (path) => readFile(join(dist, path), 'utf8').catch(() => null), notesUrl })
  await writeFile(out, JSON.stringify(input))
  console.log(`The assistant's input: ${input.model}, ${input.system.length} characters of system prompt, ${input.notes} public notes, ${input.articles} write-ups.`)
} catch (error) {
  console.error(`::error::The assistant check did not run: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
