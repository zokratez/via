/**
 * PubMed E-utilities scraper for peptide research.
 *
 * Foundation layer of the daily research ingest. Pure storage — no
 * relevance filtering, no LLM drafting, no UI surface. Runs from a
 * cron handler (src/app/api/cron/scrape-pubmed/route.ts).
 *
 * Algorithm:
 *   1. For each peptide in PEPTIDE_TERMS, call esearch.fcgi over the
 *      last 7 days of publications. Returns PMIDs.
 *   2. Cross-tab PMID → set of terms that matched it (a single paper
 *      can match multiple peptides).
 *   3. Look up existing PMIDs in the DB; skip those.
 *   4. Batch efetch.fcgi for new PMIDs (up to 20 per call). Parse the
 *      XML response for title, abstract, authors, journal, date.
 *   5. Insert each new article with the matched-terms array.
 *
 * Rate limit: NCBI allows 3 req/sec without an API key. We sleep
 * 334ms between API calls. With 10 terms + batched efetch, a typical
 * run is ~20 HTTP calls = ~7 seconds plus response time.
 *
 * Error handling: per-term failures log and continue. A failed efetch
 * for one PMID skips that record only.
 *
 * XML parsing: PubMed's XML structure is stable. We regex-parse the
 * specific fields we need rather than add a parser dependency.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const PEPTIDE_TERMS = [
  "retatrutide",
  "cagrilintide",
  "survodutide",
  "semaglutide",
  "tirzepatide",
  "BPC-157",
  "TB-500",
  "KPV",
  "GHK-Cu",
  "MOTS-c",
] as const;

const NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const RATE_LIMIT_MS = 334; // ~3 req/sec
const SEARCH_RETMAX = 20;
const EFETCH_BATCH = 20;
const DAYS_LOOKBACK = 7;

type PubMedRecord = {
  pmid: string;
  title: string;
  abstract: string | null;
  authors: string[];
  journal: string | null;
  publishedDate: string | null; // ISO yyyy-mm-dd
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role env vars missing");
  }
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function formatPubMedDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function dateRange(): { mindate: string; maxdate: string } {
  const today = new Date();
  const past = new Date(today.getTime() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000);
  return { mindate: formatPubMedDate(past), maxdate: formatPubMedDate(today) };
}

async function esearchTerm(
  term: string,
  range: { mindate: string; maxdate: string },
): Promise<string[]> {
  const url =
    `${NCBI_BASE}/esearch.fcgi?db=pubmed` +
    `&term=${encodeURIComponent(term)}` +
    `&retmode=json` +
    `&retmax=${SEARCH_RETMAX}` +
    `&sort=date` +
    `&datetype=pdat` +
    `&mindate=${range.mindate}` +
    `&maxdate=${range.maxdate}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`esearch ${res.status} for "${term}"`);
  }
  const data = (await res.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  return data.esearchresult?.idlist ?? [];
}

/**
 * Pull the first capture group from a regex applied to xml, decoding
 * a small set of HTML entities. Returns null if no match.
 */
function extractFirst(xml: string, re: RegExp): string | null {
  const m = xml.match(re);
  if (!m) return null;
  return decodeEntities(m[1].trim());
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function parsePubmedArticle(xml: string): PubMedRecord | null {
  const pmid = extractFirst(xml, /<PMID[^>]*>(\d+)<\/PMID>/);
  if (!pmid) return null;

  // ArticleTitle may contain inline tags (italic, sub, sup). Strip them.
  const titleRaw = extractFirst(xml, /<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
  const title = titleRaw ? titleRaw.replace(/<[^>]+>/g, "").trim() : null;
  if (!title) return null;

  // Abstract may have multiple <AbstractText> sections (structured abstracts).
  const abstractMatches = [
    ...xml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g),
  ];
  const abstract =
    abstractMatches.length > 0
      ? abstractMatches
          .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, "").trim()))
          .filter((s) => s.length > 0)
          .join("\n\n")
      : null;

  // Authors: LastName + ForeName (or CollectiveName fallback).
  const authors: string[] = [];
  const authorMatches = [
    ...xml.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/g),
  ];
  for (const m of authorMatches) {
    const block = m[1];
    const last = extractFirst(block, /<LastName>([\s\S]*?)<\/LastName>/);
    const fore = extractFirst(block, /<ForeName>([\s\S]*?)<\/ForeName>/);
    const collective = extractFirst(
      block,
      /<CollectiveName>([\s\S]*?)<\/CollectiveName>/,
    );
    if (last) {
      authors.push(fore ? `${fore} ${last}` : last);
    } else if (collective) {
      authors.push(collective);
    }
  }

  // Journal: the first <Title> inside <Journal>.
  const journalBlock = xml.match(/<Journal[^>]*>([\s\S]*?)<\/Journal>/);
  const journal = journalBlock
    ? extractFirst(journalBlock[1], /<Title>([\s\S]*?)<\/Title>/)
    : null;

  // Published date: prefer ArticleDate, fall back to PubMedPubDate (pubmed).
  let publishedDate: string | null = null;
  const articleDate = xml.match(
    /<ArticleDate[^>]*>([\s\S]*?)<\/ArticleDate>/,
  );
  if (articleDate) {
    const y = extractFirst(articleDate[1], /<Year>(\d+)<\/Year>/);
    const m = extractFirst(articleDate[1], /<Month>(\d+)<\/Month>/);
    const d = extractFirst(articleDate[1], /<Day>(\d+)<\/Day>/);
    if (y && m && d) {
      publishedDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  if (!publishedDate) {
    const pubmedDate = xml.match(
      /<PubMedPubDate PubStatus="pubmed">([\s\S]*?)<\/PubMedPubDate>/,
    );
    if (pubmedDate) {
      const y = extractFirst(pubmedDate[1], /<Year>(\d+)<\/Year>/);
      const m = extractFirst(pubmedDate[1], /<Month>(\d+)<\/Month>/);
      const d = extractFirst(pubmedDate[1], /<Day>(\d+)<\/Day>/);
      if (y && m && d) {
        publishedDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
  }

  return { pmid, title, abstract, authors, journal, publishedDate };
}

async function efetchBatch(pmids: string[]): Promise<PubMedRecord[]> {
  if (pmids.length === 0) return [];
  const url =
    `${NCBI_BASE}/efetch.fcgi?db=pubmed` +
    `&id=${pmids.join(",")}` +
    `&retmode=xml`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`efetch ${res.status} for ${pmids.length} pmids`);
  }
  const xml = await res.text();
  const records: PubMedRecord[] = [];
  // Split on PubmedArticle boundary. Keep the opening tag with each chunk.
  const articles = xml.split(/(?=<PubmedArticle[\s>])/);
  for (const block of articles) {
    if (!block.includes("<PubmedArticle")) continue;
    const rec = parsePubmedArticle(block);
    if (rec) records.push(rec);
  }
  return records;
}

export async function scrapePubMed(): Promise<{
  inserted: number;
  skipped: number;
}> {
  const range = dateRange();

  // Step 1: esearch per term, build PMID → matched terms map.
  const pmidToTerms = new Map<string, Set<string>>();
  for (const term of PEPTIDE_TERMS) {
    try {
      const pmids = await esearchTerm(term, range);
      for (const pmid of pmids) {
        const set = pmidToTerms.get(pmid) ?? new Set<string>();
        set.add(term);
        pmidToTerms.set(pmid, set);
      }
    } catch (err) {
      console.error(`[scrape-pubmed] esearch failed for "${term}"`, err);
    }
    await sleep(RATE_LIMIT_MS);
  }

  const allPmids = Array.from(pmidToTerms.keys());
  if (allPmids.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Step 2: filter out PMIDs already in DB.
  const admin = getAdminClient();
  const { data: existing, error: lookupErr } = await admin
    .from("peptide_research_raw")
    .select("pubmed_id")
    .in("pubmed_id", allPmids);
  if (lookupErr) {
    throw new Error(`dedup lookup failed: ${lookupErr.message}`);
  }
  const existingIds = new Set((existing ?? []).map((r) => r.pubmed_id));
  const newPmids = allPmids.filter((p) => !existingIds.has(p));
  const skippedFromDedup = allPmids.length - newPmids.length;

  // Step 3: batched efetch + insert.
  let inserted = 0;
  let fetchFailures = 0;
  for (let i = 0; i < newPmids.length; i += EFETCH_BATCH) {
    const batch = newPmids.slice(i, i + EFETCH_BATCH);
    let records: PubMedRecord[] = [];
    try {
      records = await efetchBatch(batch);
    } catch (err) {
      console.error(`[scrape-pubmed] efetch batch failed`, err);
      fetchFailures += batch.length;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const rows = records.map((r) => ({
      pubmed_id: r.pmid,
      title: r.title,
      abstract: r.abstract,
      authors: r.authors,
      journal: r.journal,
      published_date: r.publishedDate,
      url: `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`,
      peptides_matched: Array.from(pmidToTerms.get(r.pmid) ?? []),
    }));

    if (rows.length > 0) {
      const { error: insertErr, count } = await admin
        .from("peptide_research_raw")
        .insert(rows, { count: "exact" });
      if (insertErr) {
        console.error(`[scrape-pubmed] insert failed`, insertErr);
      } else {
        inserted += count ?? rows.length;
      }
    }

    // Records in `batch` that didn't parse into `records` are skipped silently.
    fetchFailures += batch.length - records.length;
    await sleep(RATE_LIMIT_MS);
  }

  return {
    inserted,
    skipped: skippedFromDedup + fetchFailures,
  };
}
