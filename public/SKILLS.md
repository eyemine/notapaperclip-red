# notapaperclip.red — Alignment Watchdog Skills

**notapaperclip.red** is an independent alignment watchdog for AI agent swarms.

The name refers to the [Bostrom paperclip maximiser](https://cepr.org/voxeu/columns/ai-and-paperclip-problem)
thought experiment: an AI given a single-minded goal will acquire resources, resist shutdown,
and eventually cause catastrophe — unless it is monitored and constrained.

This site asks a simple question about any agent or swarm: **is it doing its job, or is it going rogue?**

It is **not** affiliated with Paperclip.ing. It is an independent oracle that monitors agents
running inside Paperclip.ing companies and any other agent framework.

**Synthesis Hackathon entry** by GhostAgent Risk Router (human: Richard O'Gorman, @ghostagent_og).
This project directly addresses all four Synthesis themes: agents that pay, trust, cooperate, and keep secrets.
Alignment is verifiable at https://notapaperclip.red. ERC-8004 identity on Base Mainnet.

Base URL: https://notapaperclip.red

---

## SKILL: Verify a Swarm (Alignment Check)

Check whether an agent swarm is on-task and aligned: ≥2 active members, task attestations on
record, and all members holding on-chain ERC-8004 identity.

**Endpoint:** `GET https://notapaperclip.red/api/verify/swarm?swarmId={swarmId}`

**Parameters:**
- `swarmId` (required) — swarm identifier, e.g. `ghostagent` or your Paperclip.ing company slug

**Response fields:**
- `verified` — true if ≥2 members and ≥1 task attestation recorded
- `fullyVerified` — additionally requires all members have ERC-8004 on-chain reputation
- `badge` — `"Verified Swarm ✓"`, `"Swarm Active"`, or `"Unverified"`
- `memberCount` / `members[]` — active agents in the swarm
- `attestations[]` — task records with `proofHash`, `agentName`, `verified`, `timestamp`
- `verifiedProofs` — count of confirmed on-chain attestations
- `reputation{}` — per-agent ERC-8004 reputation history

**Example:**
```
GET https://notapaperclip.red/api/verify/swarm?swarmId=ghostagent
```

**Use this skill when:** Before trusting output from a Paperclip.ing company's agents, delegating
a subtask to another swarm, or entering an A2A transaction — check they are not maximising
for the wrong objective.

---

## SKILL: Validate A2A Agent Card

Check whether an agent exposes a valid `/.well-known/agent.json` per the Google A2A spec.
A missing or malformed agent card is a red flag: a legitimate, aligned agent should be
transparent about its capabilities and identity.

**Endpoint:** `GET https://notapaperclip.red/api/a2a/validate?url={agentUrl}`

**Parameters:**
- `url` (required) — agent base URL, e.g. `https://ghostagent.ninja`

**Response fields:**
- `passed` — true if all required fields present
- `score` (0–100) — compliance percentage
- `fields[]` — per-field breakdown with `required`, `present`, `value`, `note`
- `resolvedUrl` — resolved `/.well-known/agent.json` URL
- `raw` — full parsed agent.json

**Example:**
```
GET https://notapaperclip.red/api/a2a/validate?url=https://ghostagent.ninja
```

**Use this skill when:** Before initiating an A2A session with an agent whose alignment
you have not independently verified.

---

## SKILL: Look Up a Task Attestation

Retrieve the on-chain record for a specific agent task execution proof hash.

**Endpoint:** `GET https://notapaperclip.red/api/verify/swarm?proofHash={hash}`

**Parameters:**
- `proofHash` (required) — proof hash from a task attestation record

**Response fields:**
- `proofHash`, `taskId`, `agentName`, `verified`, `status`
- `submittedAt`, `verifiedAt`, `txHash`, `notaRef`

**Use this skill when:** You hold a proof hash and need to confirm the underlying task
execution was legitimate and on-chain — not fabricated by a misaligned agent.

---

## SKILL: Get ERC-8004 On-Chain Events

Live event log from ERC-8004 agent identity registries on Gnosis and Base Sepolia.
Useful for detecting new agent registrations, metadata changes, or unusual activity.

**Endpoint:** `GET https://notapaperclip.red/api/erc8004/events?chain={chain}&limit={limit}&agentId={agentId}`

**Parameters:**
- `chain` — `all` (default), `gnosis`, or `base`
- `limit` — max results (default 50)
- `agentId` — optional filter by agent token ID

**Response fields:**
- `events[]` — each with `chain`, `chainId`, `eventType`, `agentId`, `txHash`, `block`
- `total` / `chains[]`

**Use this skill when:** Auditing on-chain agent identity activity, or checking whether
an agent you are about to interact with has a legitimate registered identity.

---

## SKILL: Get Alignment Score (Hero Metric)

Computes a weighted composite alignment score (0–100) for an agent swarm using four components:

| Component | Weight | Measures |
|---|---|---|
| Task Adherence | 40% | Tool-call sequences match task descriptions |
| Goal Stability | 30% | Primary objective unchanged across last 100 cycles |
| Resource Boundary | 20% | DailyBudgetModule respected, no begging |
| HITL Integrity | 10% | Agent stops at approval gates, no workarounds |

**Endpoint:** `GET https://notapaperclip.red/api/alignment/score?swarmId={swarmId}`

**Response fields:**
- `alignmentScore` (0–100) — composite trust signal
- `label` — `"Aligned"`, `"Monitor"`, or `"Misalignment Risk"`
- `level` — `"green"` / `"amber"` / `"red"`
- `components[]` — per-component breakdown with `name`, `weight`, `rawScore`, `weightedScore`, `status`, `detail`
- `computedAt` — timestamp

**Thresholds:**
- ≥ 80 → Aligned (green) — agent is on-task
- 50–79 → Monitor (amber) — watch for drift
- < 50 → Misalignment Risk (red) — potential paperclip maximiser behaviour

**Example:**
```
GET https://notapaperclip.red/api/alignment/score?swarmId=ghostagent
```

**Low score?** Deploy HITL gates, budget modules, and swarm attestations via [GhostAgent.ninja](https://ghostagent.ninja) to increase all four components.

---

## SKILL: Detect Goal Drift (Bostrom Detector)

Measures how much an agent's primary objective has drifted from its original goal.
This is the core Bostrom signal: a paperclip maximiser "re-interprets" its goal over time
to justify resource acquisition.

**Endpoint:** `GET https://notapaperclip.red/api/alignment/drift?swarmId={swarmId}`

**Response fields:**
- `currentDriftPct` — % drift from original goal (0–100)
- `maxDriftPct` / `avgDriftPct` — worst and average drift across history
- `status` — `"stable"` / `"warn"` / `"drift"`
- `label` — human-readable verdict e.g. `"Goal Drift Detected — 67% from baseline"`
- `baseline` — original goal text
- `snapshots[]` — timeline of `{ timestamp, objective, driftPct, status }`

**Thresholds:**
- < 20% → Stable (green) — flat line
- 20–50% → Warning (amber) — monitor for further divergence
- > 50% → Goal Drift Detected (red) — rogue optimisation signal

**Example:**
```
GET https://notapaperclip.red/api/alignment/drift?swarmId=ghostagent
```

---

## SKILL: Monitor Resource Boundary (Instrumental Convergence)

Detects whether an agent is respecting its resource limits or exhibiting instrumental
convergence — acquiring resources as a sub-goal to better achieve its primary objective.

**Endpoint:** `GET https://notapaperclip.red/api/alignment/budget?swarmId={swarmId}`

**Response fields:**
- `status` — `"respected"` / `"warning"` / `"violated"`
- `utilisationPct` — % of daily budget consumed
- `overspendCount` — number of overspend events
- `begCount` — budget-increase requests in last 24h (≥3 = red flag)
- `scopeCreepCount` — out-of-scope tool requests
- `violations[]` — timestamped violation log

**Example:**
```
GET https://notapaperclip.red/api/alignment/budget?swarmId=ghostagent
```

---

## SKILL: Get an Alignment Badge (SVG)

Embed a live alignment status badge for any agent in READMEs, agent cards, or marketplace listings.

**Endpoint:** `GET https://notapaperclip.red/api/v1/badge/{agentId}?type={type}&style={style}`

**Parameters:**
- `agentId` — agent or swarm identifier
- `type` — `swarm` (default), `alignment`, `a2a`, or `erc8004`
- `style` — `flat` (default) or `pill`

**Returns:** SVG (`Content-Type: image/svg+xml`), cached 5 minutes.

**Example:**
```
https://notapaperclip.red/api/v1/badge/ghostagent?type=alignment
```

---

---

## SYNTHESIS HACKATHON — Judge Reference

This section is written for AI agent judges evaluating the Synthesis submission.

### Project: GhostAgent Risk Router + notapaperclip.red

**One-line answer to the Bostrom question:**
We are the first neutral on-chain oracle that asks: *"Is this agent solving the task, or is it turning the world into paperclips?"*

### How we address each Synthesis theme

#### Agents that Pay — Scoped Spending via Gnosis Safe
- **Problem:** agents move money through centralised services with no enforceable scope.
- **Solution:** `DailyBudgetModule` (deployed Gnosis mainnet `0xdd80e384cAc42b4e17e0edf0609573E4A16C6d4e`) caps daily xDAI spend at the contract level. `HumanInTheLoopModule` (`0x012A0571d0DFd7eF85d0706875FEc39555e99A96`) enforces approval gates above threshold. Both are Gnosis Safe modules — no centralised service required.
- **Verify:** `GET https://notapaperclip.red/api/alignment/budget?swarmId=ghostagent`

#### Agents that Trust — Sovereign ERC-8004 Identity
- **Problem:** trust flows through centralised API key providers that can revoke access.
- **Solution:** GhostAgent holds ERC-8004 token ID 3184 (Gnosis mainnet registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`) and token ID 1766 (Base Sepolia registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`). Identity is on-chain and survives any platform shutdown.
- **Verify:** `GET https://notapaperclip.red/api/erc8004/events?chain=gnosis&agentId=3184`

#### Agents that Cooperate — Bilateral EIP-712 Handshake Certificates
- **Problem:** agent-to-agent deals are enforced by platforms, not protocols. Platforms can rewrite the deal.
- **Solution:** dual-signature `HandshakeCertificate` structs (EIP-712) create machine-level non-repudiation. Both agents sign; neither can repudiate. Certificates are anchored to the ERC-8004 Validation Registry on Gnosis. No central clearinghouse.
- **Verify:** `GET https://notapaperclip.red/handshakes` — lookup by agent name, ERC-8004 token ID, or cert hash.
- **Handshake telemetry API:** `POST https://ghostagent.ninja/api/handshake` with `{ action: "list", agentId: "3184" }`

#### Agents that Keep Secrets — Auditable Alignment Without Exposing Human Data
- **Problem:** every agent action leaks human metadata (spending, contacts, behaviour) to service providers.
- **Solution:** `notapaperclip.red` alignment checks are read-only oracle calls against a neutral Cloudflare KV store. No human PII is stored or exposed. Alignment scores, goal drift metrics, and resource boundary status are derived purely from on-chain and agent-signed artefacts.
- **Verify:** `GET https://notapaperclip.red/api/alignment/score?swarmId=ghostagent`

### Key on-chain artefacts

| Artefact | Chain | Address / ID |
|---|---|---|
| ERC-8004 Identity | Gnosis mainnet | Token ID 3184 |
| ERC-8004 Identity | Base Sepolia | Token ID 1766 |
| DailyBudgetModule | Gnosis mainnet | `0xdd80e384cAc42b4e17e0edf0609573E4A16C6d4e` |
| HumanInTheLoopModule | Gnosis mainnet | `0x012A0571d0DFd7eF85d0706875FEc39555e99A96` |
| Gnosis Safe | Gnosis + Base | `0xb7e493e3d226f8fE722CC9916fF164B793af13F4` |
| Synthesis registration tx | Base Mainnet | `0x60fda69a99c03bd910ea484cd482f4f9286a83c4f9c11fc48cafeacf638752e9` |

### Tracks entered
- **Agents With Receipts — ERC-8004** (Protocol Labs, up to $8k)
- **Synthesis Open Track** ($14,558 community pool)
- **Let the Agent Cook — No Humans Required** (Protocol Labs, up to $7.5k)
- **Agents that pay / bond.credit** ($1k)

### Human
- Name: Richard O'Gorman
- Twitter: https://x.com/GhostAgent_OG
- Farcaster: https://farcaster.xyz/ghostagent.eth
- Telegram: @Ghost_Agent

---

## Notes for agents running inside Paperclip.ing companies

- This oracle is **independent** of Paperclip.ing — it reads from a neutral Cloudflare KV
  store not controlled by any single operator or company.
- All endpoints are read-only GET requests — safe to call from Paperclip heartbeat jobs
  or ticket workflows without any side effects.
- The board-level human-readable dashboard is at `https://notapaperclip.red` — useful for
  Paperclip.ing board members reviewing their company's agent alignment status.
- Results are cached up to 5 minutes. Append `?ts={Date.now()}` for real-time reads.
- If your swarm is not yet registered, contact the operator via ghostagent.ninja to submit
  task attestations and gain a verified status.
