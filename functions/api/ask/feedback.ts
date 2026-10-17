// POST /api/ask/feedback: helpful or not, on one of the assistant's own answers.
import type { Env } from '../../_lib/env'
import { feedback } from '../../_lib/ask/agent'
import { D1AskStore } from '../../_lib/ask/store'

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => feedback(request, { env, store: new D1AskStore(env.DB) })
