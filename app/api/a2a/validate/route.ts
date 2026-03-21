/**
 * GET /api/a2a/validate?url=https://agent.example.com
 *
 * Fetches /.well-known/agent-card.json (A2A v1.0, canonical) with fallback
 * to /.well-known/agent.json (legacy draft) and validates against the spec.
 *
 * v1.0 required: name, description, version, supportedInterfaces, defaultInputModes, defaultOutputModes
 * v1.0 recommended: provider, securitySchemes, skills, iconUrl, documentationUrl
 */

import { NextRequest, NextResponse } from 'next/server';

interface FieldSpec {
  field:    string;
  required: boolean;
  note?:    string;
  check?:   (val: unknown) => string | undefined;
}

const FIELD_SPECS: FieldSpec[] = [
  { field: 'name',                 required: true },
  { field: 'description',          required: true },
  { field: 'version',              required: true },
  { field: 'supportedInterfaces',  required: true,  check: v => Array.isArray(v) && (v as unknown[]).length > 0 ? undefined : 'should be a non-empty array of {url, protocolBinding, protocolVersion}' },
  { field: 'defaultInputModes',    required: true,  check: v => Array.isArray(v) ? undefined : 'should be an array' },
  { field: 'defaultOutputModes',   required: true,  check: v => Array.isArray(v) ? undefined : 'should be an array' },
  { field: 'provider',             required: false, note: 'recommended — {organization, url}' },
  { field: 'securitySchemes',      required: false, note: 'recommended — OAuth2 / OpenID schemes (replaces authentication)' },
  { field: 'skills',               required: false, note: 'recommended — array of {id, name, description, tags}' },
  { field: 'iconUrl',              required: false, note: 'optional — agent icon image URL' },
  { field: 'documentationUrl',     required: false, note: 'optional — link to agent API docs' },
  { field: 'capabilities',         required: false, note: 'optional — {streaming, pushNotifications, stateTransitionHistory}' },
  // Legacy v0.2 fields — still accepted
  { field: 'url',                  required: false, note: 'legacy v0.2 — replaced by supportedInterfaces in v1.0' },
  { field: 'authentication',       required: false, note: 'legacy v0.2 — replaced by securitySchemes in v1.0' },
];

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Normalise — strip trailing slash, ensure https
  let base = rawUrl.replace(/\/$/, '');
  if (!/^https?:\/\//.test(base)) base = `https://${base}`;

  // If the user passed a full /.well-known/ URL directly, use it as-is plus its sibling;
  // otherwise strip any existing /.well-known path and append candidates.
  let candidates: string[];
  const wellKnownMatch = base.match(/^(https?:\/\/[^/]+)(\/.well-known\/.*)?$/);
  const origin = wellKnownMatch?.[1] ?? base.replace(/\/.well-known\/.*$/, '');
  if (base.includes('/.well-known/')) {
    // Passed a direct well-known URL — try both siblings from same origin
    candidates = [
      `${origin}/.well-known/agent-card.json`,
      `${origin}/.well-known/agent.json`,
    ];
  } else {
    // Try v1.0 canonical first, fall back to legacy
    candidates = [
      `${base}/.well-known/agent-card.json`,
      `${base}/.well-known/agent.json`,
    ];
  }

  let raw: Record<string, unknown> | null = null;
  let resolvedUrl = candidates[0];

  for (const candidateUrl of candidates) {
    try {
      const res = await fetch(candidateUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'notapaperclip-validator/1.0' },
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      try {
        raw = JSON.parse(text) as Record<string, unknown>;
        resolvedUrl = candidateUrl;
        break;
      } catch { continue; }
    } catch { continue; }
  }

  if (!raw) {
    return NextResponse.json({
      error: `Could not fetch agent card — tried agent-card.json and agent.json. Make sure at least one is publicly accessible.`,
    }, { status: 422 });
  }

  // Validate fields
  const fields = FIELD_SPECS.map(spec => {
    const present = spec.field in raw && raw[spec.field] !== null && raw[spec.field] !== '';
    const val     = raw[spec.field];
    const note    = present && spec.check ? spec.check(val) : (!present && spec.note ? spec.note : undefined);
    return {
      field:    spec.field,
      required: spec.required,
      present,
      value:    present ? String(val).slice(0, 120) : undefined,
      note,
    };
  });

  const requiredFields = fields.filter(f => f.required);
  const passCount      = requiredFields.filter(f => f.present).length;
  const score          = Math.round((passCount / requiredFields.length) * 100);
  const passed         = requiredFields.every(f => f.present);

  return NextResponse.json({
    url:         rawUrl,
    resolvedUrl: resolvedUrl,
    passed,
    score,
    fields,
    raw,
    checkedAt:   Date.now(),
  });
}
