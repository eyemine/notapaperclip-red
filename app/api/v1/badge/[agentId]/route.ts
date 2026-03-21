/**
 * GET /api/v1/badge/[agentId]
 *
 * Returns a dynamic SVG badge for embedding in agent cards, READMEs, marketplaces.
 * Click → redirects to full audit on notapaperclip.red
 *
 * Query params:
 *   ?type=alignment|a2a|erc8004|swarm  (default: swarm)
 *   ?style=flat|pill              (default: flat)
 */

import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL =
  process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';

async function kvGet(key: string) {
  try {
    const res  = await fetch(WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'kvGet', key }),
    });
    const data = await res.json() as { value?: string };
    return data?.value ? JSON.parse(data.value) : null;
  } catch {
    return null;
  }
}

type BadgeType = 'alignment' | 'a2a' | 'erc8004' | 'swarm';

interface BadgeConfig {
  label:  string;
  status: string;
  color:  string;
  icon:   string;
}

function getBadgeConfig(type: BadgeType, verified: boolean): BadgeConfig {
  const configs: Record<BadgeType, { label: string; icon: string }> = {
    alignment: { label: 'aligned',  icon: 'shield' },
    a2a:       { label: 'A2A',      icon: 'link'   },
    erc8004:   { label: 'ERC-8004', icon: 'star'   },
    swarm:     { label: 'swarm',    icon: 'hex'    },
  };
  const cfg = configs[type];
  return {
    label:  cfg.label,
    status: verified ? 'verified' : 'unverified',
    color:  verified ? '#22c55e' : '#ef4444',
    icon:   cfg.icon,
  };
}

function makeSvg(cfg: BadgeConfig, agentId: string, style: string): string {
  const labelW  = cfg.label.length  * 7 + 16;
  const statusW = cfg.status.length * 7 + 16;
  const totalW  = labelW + statusW;
  const r       = style === 'pill' ? 10 : 4;
  const h       = 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h}" role="img" aria-label="${cfg.label}: ${cfg.status}">
  <title>${cfg.label}: ${cfg.status}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#1a1a1a"/>
    <stop offset="1" stop-color="#111"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalW}" height="${h}" rx="${r}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${h}" fill="#2d2d2d"/>
    <rect x="${labelW}" width="${statusW}" height="${h}" fill="${cfg.color}"/>
    <rect width="${totalW}" height="${h}" fill="url(#s)" opacity="0.1"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11">
    <text x="${labelW / 2}" y="14" fill="#000" opacity="0.25">${cfg.label}</text>
    <text x="${labelW / 2}" y="13">${cfg.label}</text>
    <text x="${labelW + statusW / 2}" y="14" fill="#000" opacity="0.25">${cfg.status}</text>
    <text x="${labelW + statusW / 2}" y="13">${cfg.status}</text>
  </g>
  <a href="https://notapaperclip.red/?swarm=${encodeURIComponent(agentId)}" target="_blank">
    <rect width="${totalW}" height="${h}" fill="transparent"/>
  </a>
</svg>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const type  = (req.nextUrl.searchParams.get('type') ?? 'swarm') as BadgeType;
  const style = req.nextUrl.searchParams.get('style') ?? 'flat';

  // Look up verification status from KV
  let verified = false;
  if (type === 'alignment' || type === 'swarm') {
    const swarm = await kvGet(`swarm:config:${agentId.toLowerCase()}`);
    const attestations =
      await kvGet(`audit:tasks:${agentId.toLowerCase()}`) ??
      await kvGet(`audit:paperclip:${agentId.toLowerCase()}`);
    verified = !!(swarm || (attestations && attestations.length > 0));
  } else if (type === 'erc8004') {
    const rep = await kvGet(`reputation:agent:${agentId.toLowerCase()}`);
    verified = !!rep;
  } else if (type === 'a2a') {
    // A2A badge — check if agentId looks like a URL or slug
    const record = await kvGet(`a2a:validated:${agentId.toLowerCase()}`);
    verified = !!(record?.passed);
  }

  const cfg = getBadgeConfig(type, verified);
  const svg = makeSvg(cfg, agentId, style);

  return new NextResponse(svg, {
    headers: {
      'Content-Type':  'image/svg+xml',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
