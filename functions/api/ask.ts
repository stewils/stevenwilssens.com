// GET /api/ask: is the assistant on (and does it want a human check)?
// POST /api/ask: a question, answered as Server-Sent Events. See functions/_lib/ask/agent.ts.
import type { Env } from '../_lib/env'
import { ask, askStatus } from '../_lib/ask/agent'
import { D1AskStore } from '../_lib/ask/store'
import { D1Store } from '../_lib/mcp/store'

export const onRequestGet: PagesFunction<Env> = ({ env }) => askStatus(env)

export const onRequestPost: PagesFunction<Env> = ({ request, env, waitUntil }) =>
  ask(request, { env, store: new D1AskStore(env.DB), dossier: new D1Store(env.DB), waitUntil })
