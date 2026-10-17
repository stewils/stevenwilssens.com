// Opens the "Ask about Steven" panel from anywhere on the site, optionally with a question typed in.
export const openAsk = (question?: string) => window.dispatchEvent(new CustomEvent('sw-ask-open', { detail: { question } }))
