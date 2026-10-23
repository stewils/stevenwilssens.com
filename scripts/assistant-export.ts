// Job A of the Review workflow's assistant check: writes what this tree's assistant reads
// (functions/_lib/assistant-input.ts) as JSON. Bundled with `vite build --ssr` (the repository's
// imports have no extensions) and run after `npm run build`, so dist/ holds the write-ups.
//
//   node <bundle>/assistant-export.js <dist folder> <notes url> <out.json>
//
// Exit 0 with the file written, or exit 1 with "::error::The assistant check did not run: …"
// (the notes cannot be read, say): the check is then never run without them.
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assistantInput } from '../functions/_lib/assistant-input'

type Deps = { build?: typeof assistantInput; write?: (path: string, text: string) => Promise<void>; log?: (line: string) => void; error?: (line: string) => void }

export const runExport = async ([dist, notesUrl, out]: string[], { build = assistantInput, write = (path, text) => writeFile(path, text), log = console.log, error = console.error }: Deps = {}) => {
  if (!dist || !notesUrl || !out) {
    error('Usage: node assistant-export.js <dist folder> <notes url> <out.json>')
    return 2
  }
  try {
    const input = await build({ readPage: (path) => readFile(join(dist, path), 'utf8').catch(() => null), notesUrl })
    await write(out, JSON.stringify(input))
    log(`The assistant's input: ${input.model}, ${input.system.length} characters of system prompt, ${input.notes} public notes, ${input.articles} write-ups.`)
    return 0
  } catch (failure) {
    error(`::error::The assistant check did not run: ${failure instanceof Error ? failure.message : String(failure)}`)
    return 1
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exit(await runExport(process.argv.slice(2)))
