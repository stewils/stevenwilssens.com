import { isBot } from './useragent'

// What a crawler fetches pages for:
// search: search engine indexing. ai-search: indexing for AI answers (ChatGPT search, Perplexity…).
// ai-training: collecting training data. ai-assistant: fetched right now because a person asked an AI.
// social: link previews in chat and social apps. seo: SEO tools. other: any other bot or script.
export type CrawlerCategory = 'search' | 'ai-search' | 'ai-training' | 'ai-assistant' | 'social' | 'seo' | 'other'
export type Crawler = { name: string; operator: string | null; category: CrawlerCategory }

// Checked in order. User agents can be faked; the network each one comes from is stored so fakes can be spotted.
const known: [RegExp, string, string, CrawlerCategory][] = [
  [/ChatGPT-User/i, 'ChatGPT-User', 'OpenAI', 'ai-assistant'],
  [/Claude-User/i, 'Claude-User', 'Anthropic', 'ai-assistant'],
  [/Perplexity-User/i, 'Perplexity-User', 'Perplexity', 'ai-assistant'],
  [/MistralAI-User/i, 'MistralAI-User', 'Mistral', 'ai-assistant'],
  [/Google-NotebookLM/i, 'Google-NotebookLM', 'Google', 'ai-assistant'],
  [/meta-externalfetcher/i, 'Meta-ExternalFetcher', 'Meta', 'ai-assistant'],
  [/Amzn-User/i, 'Amzn-User', 'Amazon', 'ai-assistant'],
  [/OAI-SearchBot/i, 'OAI-SearchBot', 'OpenAI', 'ai-search'],
  [/Claude-SearchBot/i, 'Claude-SearchBot', 'Anthropic', 'ai-search'],
  [/PerplexityBot/i, 'PerplexityBot', 'Perplexity', 'ai-search'],
  [/DuckAssistBot/i, 'DuckAssistBot', 'DuckDuckGo', 'ai-search'],
  [/Amzn-SearchBot/i, 'Amzn-SearchBot', 'Amazon', 'ai-search'],
  [/YouBot/i, 'YouBot', 'You.com', 'ai-search'],
  [/GPTBot/i, 'GPTBot', 'OpenAI', 'ai-training'],
  [/ClaudeBot|Claude-Web|anthropic-ai/i, 'ClaudeBot', 'Anthropic', 'ai-training'],
  [/CCBot/i, 'CCBot', 'Common Crawl', 'ai-training'],
  [/Bytespider/i, 'Bytespider', 'ByteDance', 'ai-training'],
  [/meta-externalagent/i, 'Meta-ExternalAgent', 'Meta', 'ai-training'],
  [/Amazonbot/i, 'Amazonbot', 'Amazon', 'ai-training'],
  [/cohere-(?:ai|training-data-crawler)/i, 'Cohere', 'Cohere', 'ai-training'],
  [/AI2Bot/i, 'AI2Bot', 'Ai2', 'ai-training'],
  [/Diffbot/i, 'Diffbot', 'Diffbot', 'ai-training'],
  [/PanguBot/i, 'PanguBot', 'Huawei', 'ai-training'],
  [/Timpibot/i, 'Timpibot', 'Timpi', 'ai-training'],
  [/Google-InspectionTool/i, 'Google-InspectionTool', 'Google', 'search'],
  [/Googlebot/i, 'Googlebot', 'Google', 'search'],
  [/bingbot|BingPreview/i, 'Bingbot', 'Microsoft', 'search'],
  [/Applebot/i, 'Applebot', 'Apple', 'search'],
  [/DuckDuckBot/i, 'DuckDuckBot', 'DuckDuckGo', 'search'],
  [/YandexBot|YandexMobileBot/i, 'YandexBot', 'Yandex', 'search'],
  [/Baiduspider/i, 'Baiduspider', 'Baidu', 'search'],
  [/SeznamBot/i, 'SeznamBot', 'Seznam', 'search'],
  [/Yeti\//, 'Yeti', 'Naver', 'search'],
  [/PetalBot/i, 'PetalBot', 'Huawei', 'search'],
  [/Qwantbot/i, 'Qwantbot', 'Qwant', 'search'],
  [/MojeekBot/i, 'MojeekBot', 'Mojeek', 'search'],
  [/facebookexternalhit|facebookcatalog/i, 'Facebook', 'Meta', 'social'],
  [/WhatsApp/i, 'WhatsApp', 'Meta', 'social'],
  [/LinkedInBot/i, 'LinkedInBot', 'LinkedIn', 'social'],
  [/Twitterbot/i, 'Twitterbot', 'X', 'social'],
  [/Slackbot|Slack-ImgProxy/i, 'Slackbot', 'Slack', 'social'],
  [/Discordbot/i, 'Discordbot', 'Discord', 'social'],
  [/TelegramBot/i, 'TelegramBot', 'Telegram', 'social'],
  [/SkypeUriPreview/i, 'SkypeUriPreview', 'Microsoft', 'social'],
  [/redditbot/i, 'Redditbot', 'Reddit', 'social'],
  [/Pinterestbot/i, 'Pinterestbot', 'Pinterest', 'social'],
  [/AhrefsBot|AhrefsSiteAudit/i, 'AhrefsBot', 'Ahrefs', 'seo'],
  [/SemrushBot|SiteAuditBot/i, 'SemrushBot', 'Semrush', 'seo'],
  [/MJ12bot/i, 'MJ12bot', 'Majestic', 'seo'],
  [/DotBot|rogerbot/i, 'Moz', 'Moz', 'seo'],
  [/Screaming Frog/i, 'Screaming Frog', 'Screaming Frog', 'seo'],
  [/DataForSeoBot/i, 'DataForSeoBot', 'DataForSEO', 'seo'],
  [/BLEXBot/i, 'BLEXBot', 'WebMeUp', 'seo'],
  [/serpstatbot/i, 'serpstatbot', 'Serpstat', 'seo'],
  [/Barkrowler/i, 'Barkrowler', 'Babbar', 'seo'],
]

// Returns the crawler behind a request, or null for a regular browser.
export const identifyCrawler = (userAgent: string): Crawler | null => {
  const match = known.find(([pattern]) => pattern.test(userAgent))
  if (match) return { name: match[1], operator: match[2], category: match[3] }
  if (!isBot(userAgent)) return null
  if (!userAgent) return { name: 'No user agent', operator: null, category: 'other' }
  const name = userAgent.match(/[\w.-]*(?:bot|crawl|spider)[\w.-]*/i)?.[0] ?? userAgent.match(/[A-Za-z][\w.-]*/)?.[0] ?? 'Unknown'
  return { name: name.slice(0, 60), operator: null, category: 'other' }
}

// Requests worth recording: pages, robots.txt, sitemap, llms.txt, Markdown copies and the resume.
// Built JavaScript and CSS (fetched by Googlebot to render pages) and the API are left out.
// /mcp is excluded so the owner key, which travels in that path, is never stored.
export const isCrawlTarget = (path: string) => !path.startsWith('/assets/') && !path.startsWith('/api/') && !path.startsWith('/mcp') && !/\.(?:js|css|woff2?|png|jpe?g|svg|ico|webmanifest)$/i.test(path)
