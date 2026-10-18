// Opens the "Ask about Steven" panel from anywhere on the site, optionally with a
// question typed in, or straight on the job-description check (fit: true).
export type OpenAskOptions = { fit?: boolean }
export const openAsk = (question?: string, options: OpenAskOptions = {}) => window.dispatchEvent(new CustomEvent('sw-ask-open', { detail: { question, fit: options.fit === true } }))
