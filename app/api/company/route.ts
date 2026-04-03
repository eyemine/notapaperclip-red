/**
 * GET /api/company?repo=eyemine/ghostagent-ninja
 * GET /api/company?repo=eyemine/ghostagent-ninja&agent=ghostagent
 *
 * Fetches and parses Agent Companies manifests (COMPANY.md / agents/[name]/AGENTS.md)
 * from a GitHub repo's raw content. schema: agentcompanies/v1
 */

import { NextRequest, NextResponse } from 'next/server';

const GITHUB_RAW = 'https://raw.githubusercontent.com';
const CACHE_TTL  = 300_000; // 5 min in-process cache

interface CompanyManifest {
  schema:      string;
  kind:        string;
  slug:        string;
  name:        string;
  description: string;
  version:     string;
  license?:    string;
  tags?:       string[];
  metadata?:   Record<string, string>;
  body:        string;
  sourceUrl:   string;
  fetchedAt:   number;
}

interface AgentManifest {
  schema:    string;
  kind:      string;
  slug:      string;
  name:      string;
  title:     string;
  reportsTo: string | null;
  skills:    string[];
  metadata?: Record<string, unknown>;
  body:      string;
  sourceUrl: string;
}

// Simple in-process cache
const cache = new Map<string, { data: unknown; at: number }>();

function parseFrontmatter(raw: string): { fm: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { fm: {}, body: raw.trim() };
  const fmBlock = match[1];
  const body    = match[2].trim();
  const fm: Record<string, unknown> = {};
  for (const line of fmBlock.split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (!key) continue;
    // Detect list item continuation — skip (YAML list items start with '  -')
    fm[key] = val.replace(/^["']|["']$/g, '');
  }
  return { fm, body };
}

async function fetchRaw(url: string): Promise<string | null> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data as string;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'notapaperclip-oracle/1.0' } });
    if (!res.ok) return null;
    const text = await res.text();
    cache.set(url, { data: text, at: Date.now() });
    return text;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const repo  = req.nextUrl.searchParams.get('repo')?.replace(/^https?:\/\/github\.com\//, '') ?? '';
  const agent = req.nextUrl.searchParams.get('agent') ?? '';

  if (!repo || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
    return NextResponse.json({ error: 'Invalid repo — use owner/repo format' }, { status: 400 });
  }

  const base = `${GITHUB_RAW}/${repo}/main`;

  // ── Agent AGENTS.md lookup ────────────────────────────────────────────────
  if (agent) {
    const agentUrl = `${base}/agents/${agent.toLowerCase()}/AGENTS.md`;
    const raw = await fetchRaw(agentUrl);
    if (!raw) {
      return NextResponse.json({ error: `No agents/${agent}/AGENTS.md found in ${repo}` }, { status: 404 });
    }
    const { fm, body } = parseFrontmatter(raw);
    const manifest: AgentManifest = {
      schema:    String(fm.schema ?? ''),
      kind:      String(fm.kind ?? 'agent'),
      slug:      String(fm.slug ?? agent),
      name:      String(fm.name ?? agent),
      title:     String(fm.title ?? ''),
      reportsTo: fm.reportsTo ? String(fm.reportsTo) : null,
      skills:    [],
      metadata:  fm.metadata as Record<string, unknown> | undefined,
      body,
      sourceUrl: agentUrl,
    };
    return NextResponse.json(manifest);
  }

  // ── COMPANY.md lookup ─────────────────────────────────────────────────────
  const companyUrl = `${base}/COMPANY.md`;
  const raw = await fetchRaw(companyUrl);
  if (!raw) {
    return NextResponse.json({
      error: `No COMPANY.md found in ${repo}`,
      hint:  'Register at agentcompanies.io or run: npx companies.sh add ' + repo,
    }, { status: 404 });
  }

  const { fm, body } = parseFrontmatter(raw);

  if (fm.schema && !String(fm.schema).startsWith('agentcompanies/')) {
    return NextResponse.json({ error: 'Not an Agent Companies manifest (schema mismatch)' }, { status: 422 });
  }

  const manifest: CompanyManifest = {
    schema:      String(fm.schema ?? 'agentcompanies/v1'),
    kind:        String(fm.kind ?? 'company'),
    slug:        String(fm.slug ?? ''),
    name:        String(fm.name ?? ''),
    description: String(fm.description ?? ''),
    version:     String(fm.version ?? ''),
    license:     fm.license ? String(fm.license) : undefined,
    metadata:    fm.metadata as Record<string, string> | undefined,
    body,
    sourceUrl:   companyUrl,
    fetchedAt:   Date.now(),
  };

  return NextResponse.json(manifest);
}
