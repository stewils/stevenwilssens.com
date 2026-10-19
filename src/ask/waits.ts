// How long the panel waits for the human check's token: a short wait before a question
// is posted without one, a long one once Cloudflare has asked the visitor to tick the box.
// Milliseconds, in an object so the tests can shorten them.
export const waits = { token: 8000, interactive: 90_000 }
