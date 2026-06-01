/**
 * Normies API client — https://api.normies.art
 * 10,000 on-chain generative NFT collection (Ethereum mainnet)
 * 40x40 monochrome bitmaps stored entirely on-chain
 * Rate limit: 60 req/min per IP, no API key required
 */

const BASE = 'https://api.normies.art';
const TIMEOUT = 5000;

export interface NormieTraits {
  Type: string;
  Gender: string;
  Age: string;
  'Hair Style': string;
  'Facial Feature': string;
  Eyes: string;
  Expression: string;
  Accessory: string;
}

export interface NormieCanvasInfo {
  actionPoints: number;
  level: number;
  isCustomized: boolean;
  delegate: string | null;
}

export interface NormieMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
}

export interface NormieOwner {
  owner: string;
  tokenId: number;
}

export interface NormieData {
  tokenId: number;
  traits: NormieTraits | null;
  canvas: NormieCanvasInfo | null;
  metadata: NormieMetadata | null;
  imageUrl: string;
  svgUrl: string;
  isAgent: boolean;
}

/** Derived image URLs — no fetch needed */
export function normieImageUrl(id: number): string {
  return `${BASE}/normie/${id}/image.png`;
}
export function normieSvgUrl(id: number): string {
  return `${BASE}/normie/${id}/image.svg`;
}

/** Fetch decoded traits for a Normie */
export async function getNormieTraits(id: number): Promise<NormieTraits | null> {
  try {
    const r = await fetch(`${BASE}/normie/${id}/traits`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    return (await r.json()) as NormieTraits;
  } catch {
    return null;
  }
}

/** Fetch Canvas metadata (level, action points, customization) */
export async function getNormieCanvasInfo(id: number): Promise<NormieCanvasInfo | null> {
  try {
    const r = await fetch(`${BASE}/normie/${id}/canvas/info`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    return (await r.json()) as NormieCanvasInfo;
  } catch {
    return null;
  }
}

/** Fetch full NFT metadata (canvas-aware: includes Level, Action Points, Customized) */
export async function getNormieMetadata(id: number): Promise<NormieMetadata | null> {
  try {
    const r = await fetch(`${BASE}/normie/${id}/metadata`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    return (await r.json()) as NormieMetadata;
  } catch {
    return null;
  }
}

/** Fetch current owner of a Normie */
export async function getNormieOwner(id: number): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/normie/${id}/owner`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    const d = await r.json() as NormieOwner;
    return d.owner ?? null;
  } catch {
    return null;
  }
}

/** Fetch all Normie IDs held by a wallet address */
export async function getNormiesByHolder(address: string): Promise<number[]> {
  try {
    const r = await fetch(`${BASE}/holders/${address}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return [];
    const d = await r.json() as { tokens?: number[] };
    return d.tokens ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch all useful Normie data for a given token ID in parallel:
 * metadata + traits + canvas/info
 * Returns null if the token doesn't exist (404).
 */
export async function getNormieData(id: number): Promise<NormieData | null> {
  if (id < 0 || id > 9999) return null;
  const [metaResult, traitsResult, canvasResult] = await Promise.allSettled([
    getNormieMetadata(id),
    getNormieTraits(id),
    getNormieCanvasInfo(id),
  ]);
  const metadata = metaResult.status === 'fulfilled' ? metaResult.value : null;
  const traits = traitsResult.status === 'fulfilled' ? traitsResult.value : null;
  const canvas = canvasResult.status === 'fulfilled' ? canvasResult.value : null;
  if (!metadata && !traits && !canvas) return null;
  const isAgent = traits?.Type === 'Agent';
  return {
    tokenId: id,
    traits,
    canvas,
    metadata,
    imageUrl: normieImageUrl(id),
    svgUrl: normieSvgUrl(id),
    isAgent,
  };
}
