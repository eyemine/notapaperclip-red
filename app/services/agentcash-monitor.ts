/**
 * AgentCash Spend Log Monitor
 *
 * Monitors agent spending via AgentCash (MPP / x402) and on-chain Safe activity.
 * Detects:
 *   - Burn rate (daily / weekly spend)
 *   - Runway remaining (balance / burn rate)
 *   - Spending anomalies (sudden spikes, unusual vendors)
 *   - Dependency map (which APIs/services the agent pays for)
 *   - Liveness signal (last spend timestamp)
 */

const WORKER_URL = process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';
const GNOSIS_RPC = process.env.NEXT_PUBLIC_GNOSIS_RPC ?? 'https://rpc.gnosischain.com';

export type SpendHealthStatus = 'healthy' | 'warning' | 'critical' | 'dormant' | 'unknown';

export interface SpendEntry {
  txHash?:    string;
  from:       string;
  to:         string;
  value:      number;      // xDAI or USDC
  currency:   string;
  vendor?:    string;      // e.g. "openai", "serper", "agentcash"
  protocol?:  'mpp' | 'x402' | 'direct' | 'unknown';
  timestamp:  number;
}

export interface AgentSpendProfile {
  agent:           string;
  safeAddress:     string | null;
  balance:         number | null;
  currency:        string;

  // Spend metrics
  totalSpent24h:   number;
  totalSpent7d:    number;
  totalSpent30d:   number;
  txCount24h:      number;
  txCount7d:       number;

  // Burn rate + runway
  dailyBurnRate:   number;   // average over last 7d
  runwayDays:      number | null;  // balance / dailyBurnRate

  // Dependency map
  vendorBreakdown: Array<{ vendor: string; spent: number; txCount: number; lastUsed: number }>;

  // Anomaly detection
  anomalies:       Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high'; timestamp: number }>;

  // Liveness
  lastSpendAt:     number | null;
  livenessStatus:  'active' | 'idle' | 'dormant';  // <1h, <24h, >24h

  // Overall health
  healthStatus:    SpendHealthStatus;
  healthLabel:     string;

  computedAt:      number;
}

/**
 * Fetch Safe xDAI balance via JSON-RPC
 */
async function getSafeBalance(safeAddress: string): Promise<number | null> {
  try {
    const res = await fetch(GNOSIS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_getBalance',
        params: [safeAddress, 'latest'],
      }),
    });
    const data = await res.json() as { result?: string };
    if (!data.result) return null;
    // Convert wei to xDAI (18 decimals), keep 4 decimals precision
    return Math.round(Number(BigInt(data.result)) / 1e14) / 1e4;
  } catch {
    return null;
  }
}

/**
 * Fetch recent outbound transactions from a Safe via Gnosis Safe Transaction Service
 */
async function getSafeTransactions(safeAddress: string, limit: number = 100): Promise<SpendEntry[]> {
  const SAFE_TX_API = `https://safe-transaction-gnosis-chain.safe.global/api/v1/safes/${safeAddress}/multisig-transactions/?limit=${limit}&executed=true`;
  try {
    const res = await fetch(SAFE_TX_API, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<{
      transactionHash?: string;
      safe?: string;
      to?: string;
      value?: string;
      executionDate?: string;
    }> };

    return (data.results ?? [])
      .filter(tx => tx.value && BigInt(tx.value) > BigInt(0))
      .map(tx => ({
        txHash:    tx.transactionHash ?? '',
        from:      safeAddress,
        to:        tx.to ?? '',
        value:     Math.round(Number(BigInt(tx.value ?? '0')) / 1e14) / 1e4,
        currency:  'xDAI',
        vendor:    classifyVendor(tx.to ?? ''),
        protocol:  'direct' as const,
        timestamp: tx.executionDate ? new Date(tx.executionDate).getTime() : 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Fetch AgentCash spend logs from worker (written by logAgentCashSpend action)
 */
async function getAgentCashLogs(agent: string): Promise<SpendEntry[]> {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAgentCashSpendLog', agentName: agent }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { entries?: SpendEntry[] };
    return data.entries ?? [];
  } catch {
    return [];
  }
}

/**
 * Classify a destination address to a known vendor
 */
function classifyVendor(to: string): string {
  const addr = to.toLowerCase();
  // Known vendor addresses (expand as AgentCash marketplace grows)
  const vendors: Record<string, string> = {
    // AgentCash relay / marketplace addresses will be added here
    // For now, return "unknown" — real classification comes from AgentCash receipt data
  };
  return vendors[addr] ?? 'unknown';
}

/**
 * Detect spending anomalies
 */
function detectAnomalies(entries: SpendEntry[], dailyAvg: number): AgentSpendProfile['anomalies'] {
  const anomalies: AgentSpendProfile['anomalies'] = [];
  const now = Date.now();

  // 1. Spike detection: any single tx > 5x daily average
  if (dailyAvg > 0) {
    const spikes = entries.filter(e => e.value > dailyAvg * 5 && e.timestamp > now - 86_400_000);
    for (const s of spikes) {
      anomalies.push({
        type: 'spend_spike',
        description: `Single transaction of ${s.value} ${s.currency} is ${Math.round(s.value / dailyAvg)}x daily average`,
        severity: s.value > dailyAvg * 10 ? 'high' : 'medium',
        timestamp: s.timestamp,
      });
    }
  }

  // 2. New vendor: first-time destination in last 24h
  const last24h = entries.filter(e => e.timestamp > now - 86_400_000);
  const older = entries.filter(e => e.timestamp <= now - 86_400_000);
  const oldVendors = new Set(older.map(e => e.to.toLowerCase()));
  const newVendors = last24h.filter(e => !oldVendors.has(e.to.toLowerCase()));
  if (newVendors.length > 0) {
    anomalies.push({
      type: 'new_vendor',
      description: `${newVendors.length} transaction(s) to previously-unseen addresses in last 24h`,
      severity: 'low',
      timestamp: Math.max(...newVendors.map(e => e.timestamp)),
    });
  }

  // 3. Rapid drain: >50% of balance spent in last 24h
  // (This is checked at the caller level where we have balance info)

  return anomalies;
}

/**
 * Main monitoring function: build a complete spend profile for an agent
 */
export async function monitorAgentSpending(agent: string): Promise<AgentSpendProfile> {
  const now = Date.now();

  // 1. Resolve agent identity → Safe address
  let safeAddress: string | null = null;
  try {
    const idRes = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
    });
    if (idRes.ok) {
      const id = await idRes.json() as { safe?: string };
      safeAddress = id.safe ?? null;
    }
  } catch { /* non-fatal */ }

  // 2. Fetch data in parallel
  const [balance, safeTxs, cashLogs] = await Promise.all([
    safeAddress ? getSafeBalance(safeAddress) : Promise.resolve(null),
    safeAddress ? getSafeTransactions(safeAddress) : Promise.resolve([]),
    getAgentCashLogs(agent),
  ]);

  // 3. Merge all spend entries, dedupe by txHash
  const allEntries: SpendEntry[] = [];
  const seen = new Set<string>();
  for (const entry of [...cashLogs, ...safeTxs]) {
    const key = entry.txHash || `${entry.to}-${entry.timestamp}-${entry.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      allEntries.push(entry);
    }
  }
  allEntries.sort((a, b) => b.timestamp - a.timestamp);

  // 4. Time-window aggregations
  const h24  = now - 86_400_000;
  const d7   = now - 7 * 86_400_000;
  const d30  = now - 30 * 86_400_000;

  const entries24h = allEntries.filter(e => e.timestamp >= h24);
  const entries7d  = allEntries.filter(e => e.timestamp >= d7);
  const entries30d = allEntries.filter(e => e.timestamp >= d30);

  const totalSpent24h = entries24h.reduce((s, e) => s + e.value, 0);
  const totalSpent7d  = entries7d.reduce((s, e) => s + e.value, 0);
  const totalSpent30d = entries30d.reduce((s, e) => s + e.value, 0);

  const dailyBurnRate = entries7d.length > 0
    ? Math.round((totalSpent7d / 7) * 10000) / 10000
    : 0;

  const runwayDays = (balance !== null && dailyBurnRate > 0)
    ? Math.round((balance / dailyBurnRate) * 10) / 10
    : null;

  // 5. Vendor breakdown
  const vendorMap = new Map<string, { spent: number; txCount: number; lastUsed: number }>();
  for (const e of allEntries) {
    const v = e.vendor || 'unknown';
    const existing = vendorMap.get(v) || { spent: 0, txCount: 0, lastUsed: 0 };
    existing.spent += e.value;
    existing.txCount += 1;
    existing.lastUsed = Math.max(existing.lastUsed, e.timestamp);
    vendorMap.set(v, existing);
  }
  const vendorBreakdown = Array.from(vendorMap.entries())
    .map(([vendor, data]) => ({ vendor, ...data }))
    .sort((a, b) => b.spent - a.spent);

  // 6. Anomaly detection
  const anomalies = detectAnomalies(allEntries, dailyBurnRate);

  // Rapid drain check
  if (balance !== null && balance > 0 && totalSpent24h > balance * 0.5) {
    anomalies.push({
      type: 'rapid_drain',
      description: `Agent spent ${Math.round(totalSpent24h / balance * 100)}% of balance in last 24h`,
      severity: 'high',
      timestamp: now,
    });
  }

  // 7. Liveness
  const lastSpendAt = allEntries.length > 0 ? allEntries[0].timestamp : null;
  const livenessStatus: AgentSpendProfile['livenessStatus'] =
    lastSpendAt && (now - lastSpendAt) < 3_600_000 ? 'active' :
    lastSpendAt && (now - lastSpendAt) < 86_400_000 ? 'idle' :
    'dormant';

  // 8. Health status
  let healthStatus: SpendHealthStatus;
  let healthLabel: string;

  const hasHighAnomaly = anomalies.some(a => a.severity === 'high');

  if (!safeAddress) {
    healthStatus = 'unknown';
    healthLabel = 'No Safe address found';
  } else if (hasHighAnomaly) {
    healthStatus = 'critical';
    healthLabel = `Critical: ${anomalies.filter(a => a.severity === 'high').map(a => a.type).join(', ')}`;
  } else if (runwayDays !== null && runwayDays < 3) {
    healthStatus = 'warning';
    healthLabel = `Low runway: ${runwayDays} days remaining`;
  } else if (livenessStatus === 'dormant' && allEntries.length > 0) {
    healthStatus = 'dormant';
    healthLabel = 'Agent dormant (no activity >24h)';
  } else if (balance !== null && balance > 0) {
    healthStatus = 'healthy';
    healthLabel = `Healthy: ${balance} xDAI, ${runwayDays !== null ? `${runwayDays}d runway` : 'no burn'}`;
  } else {
    healthStatus = 'warning';
    healthLabel = 'No balance or spending data';
  }

  return {
    agent,
    safeAddress,
    balance,
    currency: 'xDAI',
    totalSpent24h: Math.round(totalSpent24h * 10000) / 10000,
    totalSpent7d:  Math.round(totalSpent7d * 10000) / 10000,
    totalSpent30d: Math.round(totalSpent30d * 10000) / 10000,
    txCount24h:    entries24h.length,
    txCount7d:     entries7d.length,
    dailyBurnRate,
    runwayDays,
    vendorBreakdown,
    anomalies,
    lastSpendAt,
    livenessStatus,
    healthStatus,
    healthLabel,
    computedAt: now,
  };
}
