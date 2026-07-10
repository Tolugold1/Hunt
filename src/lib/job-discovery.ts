import { db } from "./db";
import type { Hunt } from "@prisma/client";

interface RawJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  applyType: "EMAIL" | "LINK_OUT";
  applyEmail?: string;
}

interface FetchResult {
  jobs: RawJob[];
  error?: string;
  sourceName: string;
  /** true = site already filtered by keyword; skip our keyword pass */
  preFiltered?: boolean;
}

// ─── Low-level fetch ──────────────────────────────────────────────────────────

async function rawFetch(url: string): Promise<{ ok: boolean; text: string; status: number }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json,text/html,application/xhtml+xml,application/xml,application/rss+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = res.ok ? await res.text() : "";
    return { ok: res.ok, text, status: res.status };
  } catch {
    return { ok: false, text: "", status: 0 };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    "i"
  );
  const m = xml.match(re);
  return ((m?.[1] ?? m?.[2]) ?? "").trim();
}

function stripHtml(text: string): string {
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// ─── Email extraction — only when description explicitly asks to email CV ─────

const EMAIL_RE = "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-z]{2,}";
const CV_WORDS = "(?:cv|resume|application|cover letter)";
const PRONOUN = "(?:your|their|all|qualified candidates['']?)\\s*";
// "to:" or "at:" or just "to" / "at" followed by whitespace
const TO = "(?:to|at):?\\s+";

// "to" / "at" / ":" — the connector between "send your CV" and the address.
// Handles "to email", "to: email", "at email", and "CV: email" (colon, no verb-to).
const TO_OR_COLON = `(?:${TO}|:\\s*)`;

// STRONG, explicit "email your CV to X" signals. The post literally names an address
// to send the CV to, so these WIN even when the post ALSO mentions a form/website —
// recruiters routinely list both ("send CV to x@y and fill our form").
const STRONG_EMAIL_PATTERNS = [
  // send / email / submit / forward [your] CV [and cover letter] to|: email
  new RegExp(`(?:send|e-?mail|submit|forward)\\s+${PRONOUN}?${CV_WORDS}(?:\\s+and\\s+${CV_WORDS})?\\s*${TO_OR_COLON}(${EMAIL_RE})`, "i"),
  // apply via/by/through email ... email
  new RegExp(`apply\\s+(?:via|by|through)\\s+e-?mail[^.]{0,80}?(${EMAIL_RE})`, "i"),
  // applications should be sent / emailed / forwarded to email
  new RegExp(`applications?\\s+(?:should\\s+be\\s+)?(?:sent|e-?mailed|forwarded)\\s+${TO}(${EMAIL_RE})`, "i"),
  // email / contact us at email ... with your CV
  new RegExp(`(?:e-?mail|contact)\\s+us\\s+(?:at|on)\\s+(${EMAIL_RE})[^.]{0,40}?with\\s+${PRONOUN}?${CV_WORDS}`, "i"),
  // CV / resume / application to|: email  (CV word immediately followed by to|colon + address)
  new RegExp(`${CV_WORDS}\\s*${TO_OR_COLON}(${EMAIL_RE})`, "i"),
];

// WEAK: a CV word within ~100 chars of "to: <email>". Ambiguous (the address might be
// for questions, not submission), so only trust it when the post is NOT a form apply.
const WEAK_EMAIL_PATTERN = new RegExp(`${CV_WORDS}[^.]{0,100}?${TO}(${EMAIL_RE})`, "i");

const FORM_APPLY_SIGNALS = [
  // Only block when it's clearly a form/online portal — NOT "apply now" (that's just a button)
  /apply\s+(?:online|via\s+(?:our\s+)?(?:website|portal|form|link))/i,
  /fill\s+(?:out|in)\s+(?:the|our)\s+(?:application|form)/i,
  /submit\s+(?:your\s+)?application\s+(?:online|via\s+(?:our\s+)?(?:website|portal|form))/i,
  /online\s+application\s+(?:form|portal|system)/i,
];

export function extractApplyEmail(description: string): string | undefined {
  // An explicit "send your CV to <email>" always wins — even alongside a form mention.
  for (const pattern of STRONG_EMAIL_PATTERNS) {
    const m = description.match(pattern);
    if (m?.[1]) return m[1];
  }
  // Otherwise only trust a loose CV-near-email match when it's not a form-apply post.
  if (FORM_APPLY_SIGNALS.some((re) => re.test(description))) return undefined;
  const m = description.match(WEAK_EMAIL_PATTERN);
  return m?.[1];
}

// ─── Title parsing (Nigerian boards use "Role at Company - Location") ─────────

function parseTitleCompany(raw: string): { title: string; company?: string; location?: string } {
  // "Software Engineer at Acme Ltd - Lagos"
  let m = raw.match(/^(.*?)\s+at\s+(.+?)\s+[-–—]\s+(.+)$/i);
  if (m) return { title: m[1].trim(), company: m[2].trim(), location: m[3].trim() };
  // "Software Engineer at Acme Ltd"
  m = raw.match(/^(.*?)\s+at\s+(.+)$/i);
  if (m) return { title: m[1].trim(), company: m[2].trim() };
  return { title: raw };
}

// ─── RSS parser ───────────────────────────────────────────────────────────────

function parseRSS(xml: string): RawJob[] {
  const jobs: RawJob[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const item = m[1];
    const title = stripHtml(extractTag(item, "title"));
    const link = extractTag(item, "link").replace(/\s+/g, "");
    if (!title || !link) continue;
    const desc = stripHtml(
      extractTag(item, "content:encoded") || extractTag(item, "description")
    ).slice(0, 3000);
    const company = stripHtml(
      extractTag(item, "company") || extractTag(item, "dc:creator") || extractTag(item, "author") || "Unknown"
    );
    const location = stripHtml(extractTag(item, "location")) || "Remote";
    const applyEmail = extractApplyEmail(desc);
    jobs.push({
      title, company, location, url: link, description: desc,
      applyType: applyEmail ? "EMAIL" : "LINK_OUT",
      applyEmail,
    });
  }
  return jobs;
}

// ─── JSON-LD parser ───────────────────────────────────────────────────────────

function parseJsonLd(html: string, pageUrl: string): RawJob[] {
  const jobs: RawJob[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const items: unknown[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (typeof item !== "object" || item === null) continue;
        const obj = item as Record<string, unknown>;
        if (obj["@type"] !== "JobPosting") continue;
        const title = String(obj.title ?? obj.name ?? "").trim();
        if (!title) continue;
        const org = (obj.hiringOrganization as Record<string, unknown>) ?? {};
        const company = String(org.name ?? "Unknown").trim();
        const locObj = (obj.jobLocation as Record<string, unknown>) ?? {};
        const addr = (locObj.address as Record<string, unknown>) ?? {};
        const location = String(addr.addressLocality ?? addr.addressRegion ?? addr.addressCountry ?? "Remote").trim();
        const jobUrl = String(obj.url ?? obj.mainEntityOfPage ?? pageUrl).trim();
        const desc = stripHtml(String(obj.description ?? "")).slice(0, 3000);
        const applyEmail = extractApplyEmail(desc);
        jobs.push({ title, company, location, url: jobUrl, description: desc, applyType: applyEmail ? "EMAIL" : "LINK_OUT", applyEmail });
      }
    } catch {}
  }
  return jobs;
}

// ─── HTML link fallback ───────────────────────────────────────────────────────

function parseHtmlJobLinks(html: string, baseOrigin: string): RawJob[] {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    let href = m[1].trim();
    const text = stripHtml(m[2]).trim();
    if (!text || text.length < 8 || text.length > 120) continue;
    if (/^(#|javascript:|mailto:)/i.test(href)) continue;
    if (/nav|menu|footer|logo|sign.?in|log.?in|register|cookie|privacy|contact|about|faq/i.test(text)) continue;
    if (href.startsWith("/")) href = `${baseOrigin}${href}`;
    if (!href.startsWith("http")) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    if (!/job|career|position|vacancy|role|opening|posting|apply/i.test(href + " " + text)) continue;
    jobs.push({ title: text, company: "Unknown", location: "Unknown", url: href, description: "", applyType: "LINK_OUT" });
    if (jobs.length >= 40) break;
  }
  return jobs;
}

// ─── Generic HTML/RSS fetcher ─────────────────────────────────────────────────

async function fetchSource(url: string, sourceName: string, preFiltered = false): Promise<FetchResult> {
  console.log(`[job-discovery] Fetching ${sourceName} → ${url}`);
  const { ok, text, status } = await rawFetch(url);
  if (!ok) {
    return { jobs: [], sourceName, error: `${sourceName}: HTTP ${status || "timeout"} — ${url}` };
  }

  if (text.includes("<item>")) {
    const jobs = parseRSS(text);
    console.log(`[job-discovery] ${sourceName}: RSS → ${jobs.length}`);
    return { jobs, sourceName, preFiltered };
  }

  if (text.includes('"JobPosting"') || text.includes("'JobPosting'")) {
    const jobs = parseJsonLd(text, url);
    if (jobs.length > 0) {
      console.log(`[job-discovery] ${sourceName}: JSON-LD → ${jobs.length}`);
      return { jobs, sourceName, preFiltered };
    }
  }

  try {
    const origin = new URL(url).origin;
    const jobs = parseHtmlJobLinks(text, origin);
    if (jobs.length > 0) {
      console.log(`[job-discovery] ${sourceName}: HTML → ${jobs.length}`);
      return { jobs, sourceName, preFiltered };
    }
  } catch {}

  return { jobs: [], sourceName, error: `${sourceName}: No parseable jobs at ${url}` };
}

// ─── Free JSON APIs (reliable, no auth) ──────────────────────────────────────

async function fetchRemotive(jobTitle: string): Promise<FetchResult> {
  // Search by job title only — keyword matching happens locally on the title
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(jobTitle)}&limit=100`;
  const { ok, text, status } = await rawFetch(url);
  if (!ok) return { jobs: [], sourceName: "Remotive", error: `Remotive: HTTP ${status}` };
  try {
    const data = JSON.parse(text) as {
      jobs: Array<{ title: string; company_name: string; url: string; description: string; candidate_required_location: string }>;
    };
    const jobs: RawJob[] = (data.jobs ?? []).map((j) => ({
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || "Remote",
      url: j.url,
      description: stripHtml(j.description ?? "").slice(0, 3000),
      applyType: "LINK_OUT" as const,
    }));
    console.log(`[job-discovery] Remotive: API → ${jobs.length}`);
    return { jobs, sourceName: "Remotive", preFiltered: false };
  } catch (e) {
    return { jobs: [], sourceName: "Remotive", error: `Remotive: parse error — ${e}` };
  }
}

async function fetchArbeitnow(jobTitle: string): Promise<FetchResult> {
  // Arbeitnow free API — search by job title only
  const url = `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(jobTitle)}`;
  const { ok, text, status } = await rawFetch(url);
  if (!ok) return { jobs: [], sourceName: "Arbeitnow", error: `Arbeitnow: HTTP ${status}` };
  try {
    const data = JSON.parse(text) as {
      data: Array<{ title: string; company_name: string; url: string; description: string; location: string; remote: boolean }>;
    };
    const jobs: RawJob[] = (data.data ?? []).map((j) => ({
      title: j.title,
      company: j.company_name,
      location: j.remote ? "Remote" : (j.location || "Unknown"),
      url: j.url,
      description: stripHtml(j.description ?? "").slice(0, 3000),
      applyType: "LINK_OUT" as const,
    }));
    console.log(`[job-discovery] Arbeitnow: API → ${jobs.length}`);
    return { jobs, sourceName: "Arbeitnow", preFiltered: false };
  } catch (e) {
    return { jobs: [], sourceName: "Arbeitnow", error: `Arbeitnow: parse error — ${e}` };
  }
}

// ─── Remote or Nothing (public JSON API, remote-only board) ──────────────────

async function fetchRemoteOrNothing(keywords: string[]): Promise<FetchResult> {
  const q = encodeURIComponent(keywords.join(" ").trim());
  const url = `https://remoteornothing.com/api/jobs?q=${q}&limit=100`;
  const { ok, text, status } = await rawFetch(url);
  if (!ok) return { jobs: [], sourceName: "RemoteOrNothing", error: `RemoteOrNothing: HTTP ${status || "timeout"}` };
  try {
    const data = JSON.parse(text) as {
      data?: Array<{
        title?: string;
        description?: string;
        apply_url?: string;
        company_name?: string;
        location_type?: string;
        timezone?: string;
      }>;
    };
    const jobs: RawJob[] = (data.data ?? [])
      .filter((j) => j.title && j.apply_url)
      .map((j) => {
        const desc = stripHtml(j.description ?? "").slice(0, 3000);
        const applyEmail = extractApplyEmail(desc);
        const locType = (j.location_type ?? "").toLowerCase();
        return {
          title: j.title!,
          company: j.company_name || "Unknown",
          location: locType && locType !== "remote" ? (j.location_type as string) : "Remote",
          url: j.apply_url!,
          description: desc,
          applyType: (applyEmail ? "EMAIL" : "LINK_OUT") as "EMAIL" | "LINK_OUT",
          applyEmail,
        };
      });
    console.log(`[job-discovery] RemoteOrNothing: API → ${jobs.length}`);
    return { jobs, sourceName: "RemoteOrNothing", preFiltered: true };
  } catch (e) {
    return { jobs: [], sourceName: "RemoteOrNothing", error: `RemoteOrNothing: parse error — ${e}` };
  }
}

// ─── Adzuna (official keyed API — broad global coverage incl. LinkedIn-sourced) ─

// Map common location text → Adzuna country code (Adzuna has no Nigeria board).
const ADZUNA_COUNTRIES: Record<string, string> = {
  "united kingdom": "gb", uk: "gb", england: "gb", london: "gb",
  "united states": "us", usa: "us", us: "us", america: "us",
  canada: "ca", australia: "au", germany: "de", france: "fr",
  netherlands: "nl", india: "in", "south africa": "za", singapore: "sg",
};

function adzunaCountry(location?: string): string {
  const loc = (location ?? "").toLowerCase().trim();
  for (const [k, v] of Object.entries(ADZUNA_COUNTRIES)) {
    if (loc.includes(k)) return v;
  }
  return (process.env.ADZUNA_COUNTRY ?? "gb").toLowerCase();
}

async function fetchAdzuna(keywords: string[], location?: string): Promise<FetchResult> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    return { jobs: [], sourceName: "Adzuna", error: "Adzuna: set ADZUNA_APP_ID and ADZUNA_APP_KEY to enable this source" };
  }

  const country = adzunaCountry(location);
  const what = encodeURIComponent(keywords.join(" ").trim() || "developer");
  const url =
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1` +
    `?app_id=${appId}&app_key=${appKey}&results_per_page=50&what=${what}&content-type=application/json`;

  const { ok, text, status } = await rawFetch(url);
  if (!ok) {
    const detail = status === 401 || status === 403 ? "invalid app id/key" : `HTTP ${status || "timeout"}`;
    return { jobs: [], sourceName: "Adzuna", error: `Adzuna: ${detail}` };
  }

  try {
    const data = JSON.parse(text) as {
      results?: Array<{
        title?: string;
        description?: string;
        redirect_url?: string;
        company?: { display_name?: string };
        location?: { display_name?: string };
      }>;
    };
    const jobs: RawJob[] = (data.results ?? [])
      .filter((r) => r.title && r.redirect_url)
      .map((r) => {
        const desc = stripHtml(r.description ?? "").slice(0, 3000);
        const applyEmail = extractApplyEmail(desc);
        return {
          title: stripHtml(r.title!),
          company: r.company?.display_name || "Unknown",
          location: r.location?.display_name || "Unknown",
          url: r.redirect_url!,
          description: desc,
          applyType: (applyEmail ? "EMAIL" : "LINK_OUT") as "EMAIL" | "LINK_OUT",
          applyEmail,
        };
      });
    console.log(`[job-discovery] Adzuna (${country}): API → ${jobs.length}`);
    return { jobs, sourceName: "Adzuna", preFiltered: true };
  } catch (e) {
    return { jobs: [], sourceName: "Adzuna", error: `Adzuna: parse error — ${e}` };
  }
}

/** Fetch individual job pages in parallel batches to extract description + apply email. */
async function enrichJobPages(jobs: RawJob[], batchSize = 5): Promise<RawJob[]> {
  const enriched: RawJob[] = [];
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (job) => {
      const { ok, text } = await rawFetch(job.url);
      if (!ok) return job;
      const desc = stripHtml(text).slice(0, 6000);
      const applyEmail = extractApplyEmail(desc);
      return {
        ...job,
        description: desc,
        applyType: (applyEmail ? "EMAIL" : "LINK_OUT") as "EMAIL" | "LINK_OUT",
        applyEmail,
      };
    }));
    enriched.push(...results);
  }
  return enriched;
}

/**
 * For the final shortlist, fetch each job's page to pull the full description and
 * detect an "email your CV to …" apply address. Only touches LINK_OUT jobs whose
 * listing text is thin (feeds/RSS give teasers) — so already-rich jobs (e.g.
 * MyJobMag, already enriched) and known-email jobs are skipped.
 */
async function enrichCandidates<T extends RawJob>(jobs: T[]): Promise<T[]> {
  const need = jobs.filter((j) => j.applyType === "LINK_OUT" && j.url && j.description.length < 400);
  if (!need.length) return jobs;
  console.log(`[job-discovery] enriching ${need.length} shortlisted page(s) for apply-email detection…`);
  const enriched = await enrichJobPages(need);
  const byUrl = new Map(enriched.map((j) => [j.url, j]));
  return jobs.map((j) => {
    const e = byUrl.get(j.url);
    return e ? { ...j, description: e.description, applyType: e.applyType, applyEmail: e.applyEmail } : j;
  });
}

// ─── X / Twitter (official API v2 recent search) ─────────────────────────────

// Strip emojis / pictographs so tweet text doesn't leak into the cover letter.
export const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}️]/gu;

/** A clean, professional role title for a tweet — never the raw emoji-laden text. */
export function tweetTitle(text: string, keywords: string[]): string {
  const lower = text.toLowerCase();
  // Prefer the matched hunt keyword — it's a clean role name ("Software Engineer").
  const matched = keywords.find((k) => k && lower.includes(k.toLowerCase()));
  if (matched) return matched.replace(/\b\w/g, (c) => c.toUpperCase());
  // Fallback: de-emojify, drop "HIRING:" noise, take the leading role-ish text.
  const clean = text
    .replace(EMOJI_RE, "")
    .replace(/^\W*(?:we(?:'re|\s+are)?\s+)?hiring[:!\s-]*/i, "")
    .replace(/^\W+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 70) || "Job opening";
}

interface XTweet {
  id: string;
  text: string;
  author_id?: string;
  entities?: { urls?: Array<{ expanded_url?: string; display_url?: string }> };
}
interface XUser { id: string; name?: string; username?: string }

async function fetchXJobs(keywords: string[]): Promise<FetchResult> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return { jobs: [], sourceName: "X", error: "X: set X_BEARER_TOKEN in your environment to enable X/Twitter search" };
  }

  const kw = keywords.slice(0, 5).filter(Boolean);
  const kwClause = kw.length ? `(${kw.map((k) => `"${k}"`).join(" OR ")}) ` : "";
  // Recent-search query is capped at 512 chars.
  const query = `${kwClause}(hiring OR "now hiring" OR vacancy OR "job opening" OR "send your cv" OR apply) -is:retweet -is:reply lang:en`.slice(0, 500);
  const url =
    `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}` +
    `&max_results=50&tweet.fields=entities&expansions=author_id&user.fields=name,username`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    clearTimeout(timer);
  } catch {
    return { jobs: [], sourceName: "X", error: "X: request failed or timed out" };
  }

  if (!res.ok) {
    // Surface X's own reason (e.g. "client-not-enrolled") — it pinpoints the fix.
    let apiDetail = "";
    try {
      const body = JSON.parse(await res.text()) as { detail?: string; title?: string; reason?: string };
      apiDetail = body.detail || body.title || body.reason || "";
    } catch {}
    const hint =
      res.status === 401 ? "invalid or expired Bearer token"
      : res.status === 403 ? "app not entitled — attach the app to a Project in the X developer portal and ensure your plan allows search reads"
      : res.status === 429 ? "rate limit / monthly read cap reached"
      : `HTTP ${res.status}`;
    return { jobs: [], sourceName: "X", error: `X: ${hint}${apiDetail ? ` — ${apiDetail.slice(0, 200)}` : ""}` };
  }

  let data: { data?: XTweet[]; includes?: { users?: XUser[] } };
  try {
    data = JSON.parse(await res.text());
  } catch {
    return { jobs: [], sourceName: "X", error: "X: could not parse API response" };
  }

  const tweets = data.data ?? [];
  const users = new Map((data.includes?.users ?? []).map((u) => [u.id, u]));

  const jobs: RawJob[] = tweets.map((t) => {
    const text = t.text.replace(/\s+/g, " ").trim();
    const author = t.author_id ? users.get(t.author_id) : undefined;
    // First non-x.com link = likely the external apply link.
    const applyLink = (t.entities?.urls ?? [])
      .map((u) => u.expanded_url)
      .find((u): u is string => !!u && !/(?:^https?:\/\/)?(?:www\.)?(?:x|twitter)\.com/i.test(u));
    const permalink = author?.username ? `https://x.com/${author.username}/status/${t.id}` : `https://x.com/i/status/${t.id}`;
    // Detect the apply email from the ORIGINAL text (emails are intact there).
    const applyEmail = extractApplyEmail(text);
    // Clean tweet body for the description — no appended link/handle and no emojis,
    // so none of that leaks into the generated cover letter.
    const cleanText = text.replace(EMOJI_RE, "").replace(/\s+/g, " ").trim();
    return {
      title: tweetTitle(text, keywords),
      // The tweet's AUTHOR is the poster (often a recruiter/aggregator), NOT the
      // hiring company. Leave it Unknown so the cover letter says "the role".
      company: "Unknown",
      location: /remote/i.test(text) ? "Remote" : "Unknown",
      // Email jobs apply by email (permalink is just for reference); link jobs point
      // at the external apply link.
      url: applyEmail ? permalink : (applyLink ?? permalink),
      description: cleanText,
      applyType: (applyEmail ? "EMAIL" : "LINK_OUT") as "EMAIL" | "LINK_OUT",
      applyEmail,
    };
  });

  console.log(`[job-discovery] X: recent search → ${jobs.length} tweets`);
  return { jobs, sourceName: "X", preFiltered: false };
}

async function fetchHotNigerianJobs(): Promise<FetchResult> {
  // HotNigerianJobs publishes a full RSS feed (~600 latest jobs). We pull it all
  // and let the local keyword filter narrow it — reliable, no scraping needed.
  const { ok, text, status } = await rawFetch("https://www.hotnigerianjobs.com/feed/");
  if (!ok) return { jobs: [], sourceName: "HotNigerianJobs", error: `HotNigerianJobs: HTTP ${status || "timeout"}` };

  const raw = parseRSS(text);
  // Titles look like "Computer Science Teacher at Greensprings School - Lekki".
  const jobs = raw.map((j) => {
    const p = parseTitleCompany(j.title);
    return {
      ...j,
      title: p.title,
      company: j.company && j.company !== "Unknown" ? j.company : (p.company ?? "Unknown"),
      location: p.location ?? j.location,
    };
  });
  console.log(`[job-discovery] HotNigerianJobs: RSS → ${jobs.length}`);
  return { jobs, sourceName: "HotNigerianJobs", preFiltered: false };
}

async function fetchWeWorkRemotely(): Promise<FetchResult> {
  // WWR's public RSS lists the ~100 latest remote jobs (no login needed). Titles
  // are "Company: Job Title"; the apply method lives on the linked WWR job page,
  // so these are link-out jobs (enrichment picks up an email when one is present).
  const { ok, text, status } = await rawFetch("https://weworkremotely.com/remote-jobs.rss");
  if (!ok) return { jobs: [], sourceName: "WeWorkRemotely", error: `WeWorkRemotely: HTTP ${status || "timeout"}` };

  const raw = parseRSS(text);
  const jobs = raw.map((j) => {
    // Split "Company: Job Title" on the first ": ".
    const idx = j.title.indexOf(": ");
    if (idx > 0 && idx < 60) {
      return { ...j, company: j.title.slice(0, idx).trim(), title: j.title.slice(idx + 2).trim() };
    }
    return j;
  });
  console.log(`[job-discovery] WeWorkRemotely: RSS → ${jobs.length}`);
  return { jobs, sourceName: "WeWorkRemotely", preFiltered: false };
}

async function fetchMyJobMag(keywords: string[]): Promise<FetchResult> {
  const q = (keywords[0] ?? "").replace(/\s+/g, "+");
  const url = `https://www.myjobmag.com/search/jobs?q=${q}&q=${q}`;
  const { ok, text, status } = await rawFetch(url);
  if (!ok) return { jobs: [], sourceName: "MyJobMag", error: `MyJobMag: HTTP ${status || "timeout"} — ${url}` };

  // Try JSON-LD first (some pages embed structured data)
  const jldJobs = parseJsonLd(text, url);
  if (jldJobs.length > 0) {
    console.log(`[job-discovery] MyJobMag: JSON-LD → ${jldJobs.length}`);
    return { jobs: jldJobs, sourceName: "MyJobMag" };
  }

  // Fall back to HTML link extraction — myjobmag uses /job/ and /jobs/ paths
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  let totalLinks = 0;
  const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(text)) !== null) {
    let href = m[1].trim();
    const title = stripHtml(m[2]).trim();
    totalLinks++;
    // myjobmag job URLs: /job/slug, /jobs/slug, /job-listing/slug
    if (!/\/job(?:s|-listing)?\/[^"'?#]{3,}/i.test(href)) continue;
    if (!title || title.length < 5 || title.length > 160) continue;
    if (/nav|menu|cookie|sign.?in|log.?in|register|about|contact|privacy/i.test(title)) continue;
    if (href.startsWith("/")) href = `https://www.myjobmag.com${href}`;
    if (!href.startsWith("http") || seen.has(href)) continue;
    seen.add(href);
    jobs.push({ title, company: "Unknown", location: "Unknown", url: href, description: "", applyType: "LINK_OUT" });
    if (jobs.length >= 60) break;
  }

  console.log(`[job-discovery] MyJobMag: HTML scanned ${totalLinks} links → ${jobs.length} job links`);
  if (jobs.length > 0) {
    console.log(`[job-discovery] MyJobMag sample titles: ${jobs.slice(0, 3).map(j => j.title).join(" | ")}`);
  }

  if (!jobs.length) {
    const snippet = text.slice(0, 500).replace(/\s+/g, " ");
    console.warn(`[job-discovery] MyJobMag: 0 jobs parsed. Page starts with: ${snippet}`);
    return { jobs: [], sourceName: "MyJobMag", error: `MyJobMag: 0 job links found on search page (scanned ${totalLinks} total links) — site structure may have changed` };
  }

  // Only enrich enough pages to have a good candidate pool — not all found links
  const toEnrich = jobs.slice(0, 25);
  console.log(`[job-discovery] MyJobMag: fetching ${toEnrich.length}/${jobs.length} job pages for descriptions…`);
  const enriched = await enrichJobPages(toEnrich);
  const emailCount = enriched.filter(j => j.applyType === "EMAIL").length;
  console.log(`[job-discovery] MyJobMag: ${emailCount}/${enriched.length} jobs have email apply`);

  return { jobs: enriched, sourceName: "MyJobMag" };
}

// ─── Built-in sources (with working URLs) ────────────────────────────────────

const BUILTIN_SOURCES: Array<(kw: string[]) => Promise<FetchResult>> = [
  // Free JSON APIs — search by job title (kw[0]), then filter locally by all keywords
  (kw) => fetchRemotive(kw[0] ?? ""),
  (kw) => fetchArbeitnow(kw[0] ?? ""),
  // RSS feeds that actually work without auth/subscription
  () => fetchSource("https://remoteok.com/remote-jobs.rss", "RemoteOK"),
  () => fetchSource("https://jobicy.com/feed/job-board/rss", "Jobicy"),
  // WeWorkRemotely removed — requires platform subscription to see full listings
];

// ─── Greenhouse API fetcher (works for both US and EU boards) ─────────────────

async function fetchGreenhouseApi(apiUrl: string, sourceName: string): Promise<FetchResult> {
  const { ok, text, status } = await rawFetch(apiUrl);
  if (!ok) return { jobs: [], sourceName, error: `${sourceName}: HTTP ${status}` };
  try {
    const data = JSON.parse(text) as {
      jobs: Array<{ title: string; location: { name: string }; content?: string; absolute_url: string }>;
    };
    const jobs: RawJob[] = (data.jobs ?? []).map((j) => {
      const desc = stripHtml(j.content ?? "").slice(0, 3000);
      const applyEmail = extractApplyEmail(desc);
      return {
        title: j.title,
        company: sourceName,
        location: j.location?.name || "Unknown",
        url: j.absolute_url,
        description: desc,
        applyType: (applyEmail ? "EMAIL" : "LINK_OUT") as "EMAIL" | "LINK_OUT",
        applyEmail,
      };
    });
    console.log(`[job-discovery] ${sourceName}: Greenhouse API → ${jobs.length}`);
    return { jobs, sourceName };
  } catch {
    return { jobs: [], sourceName, error: `${sourceName}: failed to parse Greenhouse API response` };
  }
}

// ─── Known job board URL resolver ────────────────────────────────────────────

// Pass originalUrl so Greenhouse-style boards can extract the company slug
type BoardFn = (kw: string[], loc?: string, originalUrl?: string) => { url: string; preFiltered: boolean; isGreenhouseApi?: boolean };

const KNOWN_BOARDS: Record<string, BoardFn> = {
  // Pre-filtered search pages (site does keyword search for us)
  "remoteok.com": () => ({ url: "https://remoteok.com/remote-jobs.rss", preFiltered: false }),
  "weworkremotely.com": () => ({ url: "https://weworkremotely.com/categories/remote-programming-jobs.rss", preFiltered: false }),
  "remotive.com": (kw) => ({ url: `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(kw.join(" "))}&limit=50`, preFiltered: true }),
  "arbeitnow.com": (kw) => ({ url: `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(kw.join(" "))}`, preFiltered: true }),
  "jobicy.com": () => ({ url: "https://jobicy.com/feed/job-board/rss", preFiltered: false }),

  // Nigerian/African job boards — search page (pre-filtered)
  "jobberman.com": (kw, loc) => ({
    url: `https://www.jobberman.com/job-listing?q=${encodeURIComponent(kw.join(" "))}&l=${encodeURIComponent(loc ?? "Nigeria")}`,
    preFiltered: true,
  }),
  "myjobmag.com": (kw) => { const q = (kw[0] ?? "").replace(/\s+/g, "+"); return { url: `https://www.myjobmag.com/search/jobs?q=${q}&q=${q}`, preFiltered: false }; },
  "myjobmag.ng": (kw) => { const q = (kw[0] ?? "").replace(/\s+/g, "+"); return { url: `https://www.myjobmag.com/search/jobs?q=${q}&q=${q}`, preFiltered: false }; },
  "ngcareers.com": (kw) => ({
    url: `https://ngcareers.com/jobs?keywords=${encodeURIComponent(kw.join(" "))}`,
    preFiltered: true,
  }),
  // Full RSS feed (~600 latest jobs); local keyword filter narrows it.
  "hotnigerianjobs.com": () => ({ url: "https://www.hotnigerianjobs.com/feed/", preFiltered: false }),
  "careersngr.com": (kw) => ({
    url: `https://www.careersngr.com/jobs/?s=${encodeURIComponent(kw.join(" "))}`,
    preFiltered: true,
  }),
  "naijahotjobs.com": (kw) => ({
    url: `https://naijahotjobs.com/jobs?q=${encodeURIComponent(kw.join(" "))}`,
    preFiltered: true,
  }),

  // African / freelance boards
  // SPA — /jobs redirects to country listings; the Nigeria page is server-rendered.
  "fuzu.com": () => ({ url: "https://www.fuzu.com/nigeria/job", preFiltered: false }),
  "peepuu.com": (kw) => ({
    url: `https://www.peepuu.com/jobs?q=${encodeURIComponent(kw[0] ?? "")}`,
    preFiltered: true,
  }),
  "hubstafftalent.net": (kw) => ({
    url: `https://hubstafftalent.net/search?q=${encodeURIComponent(kw[0] ?? "")}`,
    preFiltered: true,
  }),

  // Greenhouse ATS — extract company slug from URL, hit the public API
  "boards.greenhouse.io": (_kw, _loc, originalUrl) => {
    const slug = originalUrl ? new URL(originalUrl).pathname.replace(/^\//, "").split("/")[0] : "";
    return slug
      ? { url: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, preFiltered: false, isGreenhouseApi: true }
      : { url: originalUrl ?? "", preFiltered: false };
  },
  "job-boards.greenhouse.io": (_kw, _loc, originalUrl) => {
    const slug = originalUrl ? new URL(originalUrl).pathname.replace(/^\//, "").split("/")[0] : "";
    return slug
      ? { url: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, preFiltered: false, isGreenhouseApi: true }
      : { url: originalUrl ?? "", preFiltered: false };
  },
  "job-boards.eu.greenhouse.io": (_kw, _loc, originalUrl) => {
    const slug = originalUrl ? new URL(originalUrl).pathname.replace(/^\//, "").split("/")[0] : "";
    return slug
      ? { url: `https://boards-api.eu.greenhouse.io/v1/boards/${slug}/jobs?content=true`, preFiltered: false, isGreenhouseApi: true }
      : { url: originalUrl ?? "", preFiltered: false };
  },

  // Global boards — some block scrapers, shown as errors
  "indeed.com": (kw, loc) => ({
    url: `https://www.indeed.com/rss?q=${encodeURIComponent(kw.join(" "))}&l=${encodeURIComponent(loc ?? "")}&sort=date`,
    preFiltered: true,
  }),
  "simplyhired.com": (kw, loc) => ({
    url: `https://www.simplyhired.com/search?q=${encodeURIComponent(kw.join(" "))}&l=${encodeURIComponent(loc ?? "")}`,
    preFiltered: true,
  }),
  "wellfound.com": (kw) => ({
    url: `https://wellfound.com/jobs?keywords=${encodeURIComponent(kw.join(" "))}`,
    preFiltered: true,
  }),
};

function resolveUrl(rawUrl: string, keywords: string[], location?: string): { resolved: string; sourceName: string; preFiltered: boolean; isGreenhouseApi?: boolean } {
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return { resolved: rawUrl, sourceName: rawUrl, preFiltered: false };
  }

  for (const [domain, fn] of Object.entries(KNOWN_BOARDS)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      const result = fn(keywords, location, rawUrl);
      return { resolved: result.url, sourceName: hostname, preFiltered: result.preFiltered, isGreenhouseApi: result.isGreenhouseApi };
    }
  }

  // Unknown — pass through, will try RSS/JSON-LD/HTML
  return { resolved: rawUrl, sourceName: hostname, preFiltered: false };
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * Title match is required — the job title must contain at least one keyword.
 * "Sales Assistant" won't pass for a "Backend Developer" hunt.
 * If title doesn't match, description can be a fallback only for short descriptions
 * (many scraped jobs have empty descriptions; exclude them from description-only matches).
 */
function matchesKeywords(job: RawJob, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const title = job.title.toLowerCase();
  const titleMatch = keywords.some((kw) => title.includes(kw.toLowerCase()));
  if (titleMatch) return true;

  // Allow description match only when description is substantial (>200 chars)
  // and the job didn't come through a pre-filtered search
  if (job.description.length > 200) {
    const desc = job.description.toLowerCase();
    return keywords.some((kw) => desc.includes(kw.toLowerCase()));
  }

  return false;
}

function matchesLocation(job: RawJob, hunt: Hunt): boolean {
  const loc = job.location.toLowerCase();
  const hasNoLocationInfo = /^(unknown|remote)$/i.test(job.location.trim()) && !job.description;

  if (hunt.remoteOnly) {
    // Pass if explicitly remote, or if we have no location/description to check
    // (scraped list pages don't include per-job location detail)
    return /remote/i.test(loc) || /remote/i.test(job.description) || hasNoLocationInfo;
  }
  if (!hunt.location) return true;
  return /remote/i.test(loc) || /unknown/i.test(loc) || loc.includes(hunt.location.toLowerCase());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export interface DiscoveryResult {
  fetched: number;
  matched: number;
  created: number;
  skipped: number;
  sources: string[];
  errors: string[];
  applicationIds: string[];
}

export async function runJobDiscovery(hunt: Hunt): Promise<DiscoveryResult> {
  const errors: string[] = [];
  const allJobs: Array<RawJob & { preFiltered: boolean }> = [];
  const successSources: string[] = [];

  // ATS integrations not yet built
  for (const s of hunt.sources.filter((s) => ["greenhouse", "lever", "workable"].includes(s))) {
    errors.push(`${s}: ATS integration coming soon`);
  }

  async function runFetches(fetches: Array<Promise<FetchResult>>) {
    const results = await Promise.all(fetches);
    for (const r of results) {
      if (r.error) {
        errors.push(r.error);
        console.warn(`[job-discovery] ✗ ${r.error}`);
      } else {
        successSources.push(r.sourceName);
        for (const job of r.jobs) {
          allJobs.push({ ...job, preFiltered: r.preFiltered ?? false });
        }
      }
    }
  }

  // ── Phase 1: user-selected sources (custom URLs + named checkboxes) ──────────
  const userFetches: Array<Promise<FetchResult>> = [];

  if (hunt.sources.includes("myjobmag")) {
    userFetches.push(fetchMyJobMag(hunt.keywords));
  }

  if (hunt.sources.includes("hotnigerianjobs")) {
    userFetches.push(fetchHotNigerianJobs());
  }

  if (hunt.sources.includes("twitter")) {
    userFetches.push(fetchXJobs(hunt.keywords));
  }

  if (hunt.sources.includes("adzuna")) {
    userFetches.push(fetchAdzuna(hunt.keywords, hunt.location ?? undefined));
  }

  if (hunt.sources.includes("remoteornothing")) {
    userFetches.push(fetchRemoteOrNothing(hunt.keywords));
  }

  if (hunt.sources.includes("weworkremotely")) {
    userFetches.push(fetchWeWorkRemotely());
  }

  if (hunt.sources.includes("fuzu")) {
    userFetches.push(fetchSource("https://www.fuzu.com/nigeria/job", "Fuzu"));
  }

  for (const url of hunt.customSources ?? []) {
    const { resolved, sourceName, preFiltered, isGreenhouseApi } = resolveUrl(url, hunt.keywords, hunt.location ?? undefined);
    console.log(`[job-discovery] Custom: ${sourceName} → ${resolved}`);
    if (isGreenhouseApi) {
      userFetches.push(fetchGreenhouseApi(resolved, sourceName));
    } else {
      userFetches.push(fetchSource(resolved, sourceName, preFiltered));
    }
  }

  if (userFetches.length) {
    console.log(`[job-discovery] Phase 1: running ${userFetches.length} user source(s)`);
    await runFetches(userFetches);
  }

  // ── Phase 2: built-in fallback — only if user sources didn't fill the quota ──
  const userMatched = allJobs.filter((j) => matchesKeywords(j, hunt.keywords)).length;
  const needMore = userMatched < hunt.maxActionsPerRun;

  if (hunt.sources.includes("email-apply") && (userFetches.length === 0 || needMore)) {
    console.log(`[job-discovery] Phase 2: built-in sources (user matched ${userMatched}/${hunt.maxActionsPerRun} so far)`);
    await runFetches(BUILTIN_SOURCES.map((fn) => fn(hunt.keywords)));
  }

  console.log(`[job-discovery] Total fetched: ${allJobs.length} from [${successSources.join(", ")}]`);

  // Always require a title match against our keywords — never trust external search alone
  const filtered = allJobs
    .filter((j) => matchesKeywords(j, hunt.keywords))
    .filter((j) => matchesLocation(j, hunt));

  console.log(`[job-discovery] After filter: ${filtered.length} matched`);

  // Deduplicate against existing applications
  const urls = filtered.map((j) => j.url).filter(Boolean);
  const existingApps = urls.length
    ? await db.application.findMany({ where: { userId: hunt.userId, jobUrl: { in: urls } }, select: { jobUrl: true, status: true } })
    : [];
  const existingUrls = new Set(existingApps.map((a) => a.jobUrl).filter((u): u is string => !!u));

  // Count pending (DRAFT/APPROVED) applications for this hunt — subtract from quota
  // so re-running doesn't pile up more than maxActionsPerRun total unactioned items
  const pendingCount = await db.application.count({
    where: { huntId: hunt.id, status: { in: ["DRAFT", "APPROVED"] } },
  });
  const quota = Math.max(0, hunt.maxActionsPerRun - pendingCount);
  console.log(`[job-discovery] quota: ${quota} (maxActionsPerRun=${hunt.maxActionsPerRun}, pending=${pendingCount})`);

  const fresh = filtered.filter((j) => !existingUrls.has(j.url));
  // Enrich the shortlist to detect email-apply jobs before creating them.
  const toCreate = await enrichCandidates(fresh.slice(0, quota));

  let created = 0;
  let applicationIds: string[] = [];

  if (toCreate.length) {
    const beforeCreate = new Date();
    const result = await db.application.createMany({
      data: toCreate.map((job) => ({
        userId: hunt.userId,
        huntId: hunt.id,
        jobTitle: job.title,
        company: job.company,
        jobUrl: job.url,
        jobDescription:
          job.location && !/^(remote|unknown)$/i.test(job.location)
            ? `📍 ${job.location}\n\n${job.description}`
            : job.description,
        applyType: job.applyType,
        applyEmail: job.applyEmail ?? null,
        source: "web",
        status: "DRAFT" as const,
      })),
      skipDuplicates: true,
    });
    created = result.count;

    if (created > 0) {
      const newApps = await db.application.findMany({
        where: { huntId: hunt.id, createdAt: { gte: beforeCreate } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: created,
      });
      applicationIds = newApps.map((a) => a.id);
    }
  }

  console.log(`[job-discovery] Done: created=${created} skipped=${filtered.length - toCreate.length}`);
  return {
    fetched: allJobs.length,
    matched: filtered.length,
    created,
    skipped: filtered.length - toCreate.length,
    sources: successSources,
    errors,
    applicationIds,
  };
}
