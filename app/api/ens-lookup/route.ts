/**
 * GET /api/ens-lookup?address=0x...
 *
 * Resolves an Ethereum address to its primary ENS name and text records.
 * Used to show controller wallet identity (avatar, bio, Twitter, URL, GitHub)
 * alongside an agent's trust profile on notapaperclip.red.
 *
 * Resolution chain:
 *   1. Cloudflare Ethereum gateway → eth_call → reverse registrar → primary name
 *   2. ENS metadata API (metadata.ens.domains) → avatar image URL
 *   3. ENS metadata API → text records (description, com.twitter, url, com.github, email)
 */

import { NextRequest, NextResponse } from 'next/server';

// Public ETH RPC via Cloudflare — no API key, high availability
const ETH_RPC = 'https://cloudflare-eth.com';

/**
 * Decode ABI-encoded string return value
 */
function decodeAbiString(hex: string): string {
  try {
    const data = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (data.length < 128) return '';
    const offset   = parseInt(data.slice(0, 64), 16);
    const lenStart = offset * 2;
    const length   = parseInt(data.slice(lenStart, lenStart + 64), 16);
    if (!length || length > 512) return '';
    const strHex = data.slice(lenStart + 64, lenStart + 64 + length * 2);
    let result = '';
    for (let i = 0; i < strHex.length; i += 2) {
      result += String.fromCharCode(parseInt(strHex.slice(i, i + 2), 16));
    }
    return result;
  } catch {
    return '';
  }
}

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(ETH_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: AbortSignal.timeout(6000),
    });
    const json = await res.json() as { result?: string };
    if (!json.result || json.result === '0x') return null;
    return json.result;
  } catch {
    return null;
  }
}

/**
 * Resolve primary ENS name for an address via the ENS reverse registrar.
 * Uses eth_call to the Universal Resolver: reverse(bytes) → string
 * Selector for `reverse(bytes)` = 0x3b3b57de is addr; use ENS metadata API instead.
 */
async function getPrimaryEnsName(address: string): Promise<string | null> {
  // ENS reverse node: keccak256(address.toLowerCase().slice(2) + '.addr.reverse')
  // Use the ENS metadata service — it resolves reverse records via a simple REST call.
  try {
    const res = await fetch(
      `https://api.ensideas.com/ens/resolve/${address.toLowerCase()}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json() as { name?: string };
      if (data.name && data.name !== '') return data.name;
    }
  } catch { /* non-fatal */ }

  // Fallback: try ENS universal resolver via direct reverse lookup
  try {
    // getName(address) selector on ENS ReverseRegistrar: 0x691f3431
    const reverseNode = address.toLowerCase().slice(2) + '0000000000000000';
    const result = await ethCall(
      '0x084b1c3C81545d370f3634392De611CaaBFf8148', // ENS ReverseRegistrar mainnet
      '0x691f3431' + reverseNode.padStart(64, '0'),
    );
    if (result) return decodeAbiString(result) || null;
  } catch { /* non-fatal */ }

  return null;
}

async function resolveEnsForAddress(address: string): Promise<{
  name: string | null;
  avatar: string | null;
  description: string | null;
  twitter: string | null;
  url: string | null;
  github: string | null;
  email: string | null;
}> {
  const empty = { name: null, avatar: null, description: null, twitter: null, url: null, github: null, email: null };

  const primaryName = await getPrimaryEnsName(address);
  if (!primaryName) return empty;

  // Fetch avatar URL and text records in parallel from ENS metadata API
  let avatar: string | null = null;
  let description: string | null = null;
  let twitter: string | null = null;
  let url: string | null = null;
  let github: string | null = null;
  let email: string | null = null;

  const [avatarRes, recordsRes] = await Promise.allSettled([
    fetch(`https://metadata.ens.domains/mainnet/avatar/${encodeURIComponent(primaryName)}`, {
      signal: AbortSignal.timeout(5000),
    }),
    fetch(`https://ensdata.net/${encodeURIComponent(primaryName)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    }),
  ]);

  if (avatarRes.status === 'fulfilled' && avatarRes.value.ok) {
    const ct = avatarRes.value.headers.get('content-type') ?? '';
    if (ct.startsWith('image/')) {
      avatar = `https://metadata.ens.domains/mainnet/avatar/${encodeURIComponent(primaryName)}`;
    }
  }

  if (recordsRes.status === 'fulfilled' && recordsRes.value.ok) {
    try {
      const records = await recordsRes.value.json() as Record<string, string | undefined>;
      description = records['description'] ?? null;
      twitter     = records['com.twitter'] ?? records['twitter'] ?? null;
      url         = records['url'] ?? null;
      github      = records['com.github'] ?? records['github'] ?? null;
      email       = records['email'] ?? null;
      // ensdata also returns avatar if set as a text record
      if (!avatar && records['avatar']) avatar = records['avatar'] ?? null;
    } catch { /* non-fatal */ }
  }

  return { name: primaryName, avatar, description, twitter, url, github, email };
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim().toLowerCase();

  if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Valid Ethereum address required' }, { status: 400 });
  }

  const result = await resolveEnsForAddress(address);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
}
