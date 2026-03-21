/**
 * GET /api/mcp/probe?url=https://agent.example.com
 *
 * Probes multiple well-known endpoints in parallel:
 *   /.well-known/agent-card.json — A2A spec v1.0 (IANA registered, canonical)
 *   /.well-known/agent.json      — A2A draft / legacy fallback
 *   /.well-known/mcp.json        — MCP server declarations
 *   /.well-known/ai-plugin.json  — OpenAI plugin manifest
 *   /AGENTS.md                   — Codex/agent instructions (plain text)
 *
 * Returns merged data from all found endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';

interface ProbeResult {
  url: string;
  found: boolean;
  data?: Record<string, unknown>;
  text?: string;
  error?: string;
}

async function probeEndpoint(url: string, acceptText = false): Promise<ProbeResult> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': acceptText ? 'text/markdown, text/plain, */*' : 'application/json', 'User-Agent': 'notapaperclip-mcp-inspector/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { url, found: false, error: `HTTP ${res.status}` };
    const text = await res.text();
    if (acceptText) {
      return { url, found: true, text: text.slice(0, 4000) };
    }
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      return { url, found: true, data };
    } catch {
      return { url, found: false, error: 'Not valid JSON' };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { url, found: false, error: msg };
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim();
  if (!rawUrl) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });

  let base = rawUrl.replace(/\/$/, '');
  if (!/^https?:\/\//.test(base)) base = `https://${base}`;

  const [agentCardJson, agentJson, mcpJson, aiPlugin, agentsMd] = await Promise.all([
    probeEndpoint(`${base}/.well-known/agent-card.json`),
    probeEndpoint(`${base}/.well-known/agent.json`),
    probeEndpoint(`${base}/.well-known/mcp.json`),
    probeEndpoint(`${base}/.well-known/ai-plugin.json`),
    probeEndpoint(`${base}/AGENTS.md`, true),
  ]);

  if (!agentCardJson.found && !agentJson.found && !mcpJson.found && !aiPlugin.found && !agentsMd.found) {
    return NextResponse.json({
      error: `No agent endpoints found at ${base}. Tried agent-card.json, agent.json, mcp.json, ai-plugin.json, AGENTS.md.`,
    }, { status: 422 });
  }

  // Merge: agent-card.json (v1.0 spec) takes priority over agent.json (legacy)
  const merged: Record<string, unknown> = {
    ...(agentJson.data ?? {}),
    ...(agentCardJson.data ?? {}),
  };

  // Lift mcpServers from mcp.json if not already in agent.json
  if (mcpJson.found && mcpJson.data) {
    if (!merged.mcpServers) {
      merged.mcpServers = mcpJson.data.mcpServers ?? mcpJson.data.servers ?? [];
    }
  }

  // Lift skills/description from ai-plugin.json if not already present
  if (aiPlugin.found && aiPlugin.data) {
    if (!merged.description && aiPlugin.data.description_for_human) {
      merged.description = aiPlugin.data.description_for_human;
    }
    if (!merged.skills && aiPlugin.data.api) {
      merged.skills = [{ name: 'OpenAI Plugin API', description: String(aiPlugin.data.description_for_model ?? ''), endpoint: (aiPlugin.data.api as Record<string, unknown>)?.url }];
    }
    merged._aiPlugin = aiPlugin.data;
  }

  return NextResponse.json({
    base,
    probed: {
      agentCardJson: { url: agentCardJson.url, found: agentCardJson.found, error: agentCardJson.error },
      agentJson:     { url: agentJson.url,     found: agentJson.found,     error: agentJson.error },
      mcpJson:       { url: mcpJson.url,       found: mcpJson.found,       error: mcpJson.error },
      aiPlugin:      { url: aiPlugin.url,      found: aiPlugin.found,      error: aiPlugin.error },
      agentsMd:      { url: agentsMd.url,      found: agentsMd.found,      error: agentsMd.error, text: agentsMd.text },
    },
    merged,
    checkedAt: Date.now(),
  });
}
