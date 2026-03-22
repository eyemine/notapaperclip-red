# notapaperclip.red — On-Chain Trust Oracle for AI Agents

**notapaperclip.red** is an independent compliance oracle that any AI agent or human can use to verify whether an agent can be trusted with money, reputation, and deals.

Live at: **https://notapaperclip.red**  
Part of the [Synthesis Hackathon 2026](https://synthesis-hackathon-applications.vercel.app/) submission.  
Reference implementation: [ghostagent.ninja](https://ghostagent.ninja) · [ghostagent-ninja repo](https://github.com/eyemine/ghostagent-ninja)

---

## What It Does

The oracle has four live functions:

| Function | URL | Description |
|---|---|---|
| **ERC-8004 Identity Verifier** | `/erc8004` | Resolve any agent by name across Gnosis, Base, Base Sepolia — returns Safe address, agentId, spending modules, TBA |
| **A2A Card Validator** | `/a2a` | Fetch and validate any agent's `/.well-known/agent-card.json` against Google A2A spec §8.2 |
| **MCP Inspector** | `/mcp` | Test any agent's Model Context Protocol server endpoints live |
| **Swarm Trust Scorer** | `/?swarm=ghostagent` | Multi-agent trust evaluation — scores agents, flags bad actors red |

---

## 🛡️ Independent Oracle Status

**The oracle can see the truth but cannot move the goalposts.**

notapaperclip.red is a neutral Trust-as-a-Service primitive. It is designed to be an objective arbiter of agent compliance, resolving any agent registered under the ERC-8004 standard across Gnosis and Base.

To maintain total integrity, the site is architected for zero-dependency:

- **Direct Data Access** — calls the Cloudflare Worker KV and on-chain RPCs directly, no intermediary
- **No Platform Lock-in** — no backend dependency on the GhostAgent.ninja app or any other platform's database
- **Universal Resolution** — if an agent exists on the ERC-8004 registry, this oracle can verify it regardless of the platform that minted it

**Read-only by design.** The Worker endpoints used by this frontend are restricted to read-only scopes — `getAgentProfile`, `getAgentIdentity`, `getBeacon`, `listAgents`. Mutating actions (`setAgentProfile`, `setBeacon`, `setErc8004AgentId`) require a `WEBHOOK_SECRET` that is **never present in this frontend's environment**:

- The oracle cannot forge or alter the agent data it displays
- An agent being evaluated cannot use the oracle's own interface to manipulate its score
- Trust scores are derived purely from on-chain state (ERC-8004 registry reads via `eth_call`) and immutable KV snapshots
- The Cloudflare Worker is the only component that can write — and it enforces `WEBHOOK_SECRET` on every mutation

This separation is intentional: **the oracle's integrity guarantee is architectural, not just policy.**

> [!IMPORTANT]
> **Standalone Architecture:** This portal is a stateless observer. By calling the Cloudflare Worker KV directly, it ensures that even if the primary GhostAgent frontend were offline, the sovereign identity and trust status of every agent remains verifiable and transparent.

---

## 🤝 The GhostAgent & nftmail.box Ecosystem

While fully independent, notapaperclip.red serves as the specialised verification layer for the GhostAgent sovereign identity stack:

- **[GhostAgent.ninja](https://ghostagent.ninja) — Identity Carrier:** Provides the portable NFT-based identity that plugs into the ERC-8004 registry. The oracle treats GhostAgent identities as the reference implementation for sovereign, cross-chain portability.
- **[nftmail.box](https://nftmail.box) — Communication Rail:** The oracle validates the nftmail.box encrypted inbox as the primary communication endpoint for agents. By verifying the ownership link between the `.gno` NFT and the `_@nftmail.box` address, the oracle confirms the agent is reachable and auditable.
- **Swarm Verification Portal — The Public Court:** Runs multi-agent trust evaluations to flag bad actors (see: `victor.openclaw.gno` flagged red in the reference swarm) using raw data fetched directly from the edge.

---

## Architecture

```
notapaperclip.red (this repo)
  │
  ├── Reads from: Cloudflare Worker KV (read-only endpoints)
  │     https://nftmail-email-worker.richard-159.workers.dev
  │
  ├── Reads from: ERC-8004 Identity Registry (on-chain, eth_call)
  │     Gnosis:  0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (chain 100)
  │     Base:    0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (chain 8453)
  │
  ├── Reads from: Agent /.well-known/agent-card.json (A2A spec §8.2)
  │
  └── Never writes to: anything — pure oracle
```

---

## API Routes

```
GET  /api/verify/swarm?swarmId=ghostagent    ← Swarm trust score
GET  /api/a2a/validate?url=https://...       ← A2A card validator
GET  /api/erc8004/resolve?agent=ghostagent   ← ERC-8004 identity lookup
GET  /api/erc8004/agent?name=ghostagent      ← Agent metadata
GET  /api/mcp/probe?url=https://...          ← MCP endpoint probe
GET  /api/agent-lookup?q=ghostagent          ← Cross-chain agent search
```

---

## Key Contracts (Gnosis Mainnet, chain 100)

| Contract | Address |
|---|---|
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Molt Registrar | `0x4b54213c1e5826497ff39ba8c87a7b75d2bc3c50` |
| DailyBudgetModule | `0xdd80e384cAc42b4e17e0edf0609573E4A16C6d4e` |
| HumanInTheLoopModule | `0x012A0571d0DFd7eF85d0706875FEc39555e99A96` |

---

## Environment Variables

```bash
WORKER_URL=https://nftmail-email-worker.richard-159.workers.dev
# No WEBHOOK_SECRET — this frontend is intentionally read-only
```

Set `WORKER_URL` in Hostinger's Node.js app environment variables panel.  
If not set, it falls back to the production worker URL automatically.

**Do not add `WEBHOOK_SECRET` to this app.** The oracle's integrity depends on the frontend having no write capability.

---

## Deploy to Hostinger (Node.js App)

Upload the source zip (excluding `node_modules/`, `.next/`, `.git/`) — Hostinger runs `npm run build` itself.

1. hPanel → **Websites → Manage → Node.js**
2. File Manager → navigate to your app root
3. Upload and unzip `notapaperclip-red.zip`
4. Set env var: `WORKER_URL=https://nftmail-email-worker.richard-159.workers.dev`
5. Restart the Node.js app

---

## Local Development

```bash
npm install
npm run dev
# → http://localhost:3000
```
