# notapaperclip.red — Structural Risk Exposure Protocol Spec

**Status:** Draft v0.2 (supersedes internal "trust score" framing)
**Editors:** GhostAgent
**Feedback:** Ethereum Magicians thread (ERC-8004 extensions) — h/t `@babyblueviper1`

---

## 0. Change Log

- **v0.2** — Removed all "trust score" language from the normative core. Replaced with
  **structural risk exposure**: a deterministic, third-party-recomputable measurement
  derived solely from public on-chain state. Moved attestations (oracle-asserted,
  off-chain-verified claims) to an optional, clearly-labeled extensions appendix
  (§6). Defined the traversal algorithm as normative so independent implementations
  converge on identical results given the same inputs.
- **v0.1** — Initial "trust score" draft (deprecated).

---

## 1. Motivation

An evaluating agent deciding whether to delegate authority or share data with a
servant identity needs an answer to one question: **can I re-derive this verdict
myself, from public inputs, without trusting the party that's telling me the
answer?**

"Trust score" was the wrong name for what this protocol computes, because trust
is dynamic, relational, and inherently subjective — it smuggles a subjective
judgment into what must be a mechanical protocol layer. What is actually
measurable, deterministic, and independently recomputable is **structural risk
exposure**: a function purely of on-chain state.

This spec makes that distinction load-bearing:

| | Structural risk exposure (this spec) | Attestation (§6, optional) |
|---|---|---|
| Inputs | Public on-chain state only | Off-chain checks, oracle-asserted |
| Recomputable by third party? | Yes — deterministic, standard RPC | No — requires trusting the attestor |
| Normative? | Yes | No — extension appendix |
| Can it be gamed by the evaluated agent? | No (structural, not self-reported) | Depends on attestor incentives |

---

## 2. Terminology

- **Servant identity** — the ERC-8004-registered agent identity being evaluated.
- **Controller graph** — the directed graph of `controllerOf` / `bindingOf`
  relationships rooted at a servant identity's registration, terminating at an
  EOA, a Safe, or an unresolvable/expired binding.
- **Structural risk exposure (SRE)** — the normative output of this spec: a
  deterministic classification (§4) plus the raw evidence used to derive it.
- **Recomputable** — any third party can independently arrive at the same SRE
  given only a chain RPC endpoint and the servant identity's on-chain address —
  no dependency on notapaperclip.red's infrastructure staying honest or online.

---

## 3. Data Sources (Normative)

All SRE inputs MUST be derived exclusively from data retrievable via standard
JSON-RPC `eth_call` / `eth_getLogs` against public chain state, or from content
addressed by a hash committed on-chain (e.g. `tokenURI` → IPFS metadata, content
hash-verified). No SRE input may depend on a centralized off-chain database.

| Source | What it verifies |
|---|---|
| ERC-8004 Identity Registry (`ownerOf`, `tokenURI`) | Registration validity, registered owner |
| `controllerOf` chain | Who ultimately controls the identity (EOA / Safe / delegate) |
| `bindingOf` (ERC-8048 agent-binding) | Whether the identity is bound to a body/beacon NFT, and binding freshness |
| Safe module enumeration (`getModulesPaginated`) | Whether spend/action modules (e.g. `DailyBudgetModule`, `HumanInTheLoopModule`) are installed and active |
| A2A agent card (`/.well-known/agent-card.json`) | Declared capabilities vs. on-chain capability claims (schema conformance, not trust) |
| Registration timestamps / expiry | Whether the identity's registration or binding has lapsed |

Anything not in this table — off-chain reputation databases, self-reported
metrics, third-party attestation feeds — is out of scope for SRE and MUST be
surfaced separately (§6), never merged into the SRE classification.

---

## 4. Deterministic Traversal Algorithm (Normative)

Given a servant identity `(chainId, registry, agentId)`:

1. **Resolve owner.** `owner = ownerOf(agentId)`. If this reverts or the token
   does not exist → `UNREGISTERED`.
2. **Walk the controller graph.** Starting at `owner`, resolve `controllerOf`
   recursively (bounded depth, MUST be ≤ 8 hops to prevent unbounded traversal;
   implementations MUST reject graphs exceeding this depth as `UNRESOLVABLE`
   rather than silently truncating).
   - If the graph terminates at an EOA with no further controller → **root: EOA**.
   - If it terminates at a Gnosis Safe → inspect installed modules (§3) →
     **root: Safe** (+ module set).
   - If a cycle is detected → `MALFORMED_GRAPH`.
3. **Check binding.** Resolve `bindingOf(agentId)` (ERC-8048). Record whether a
   binding exists, and if so, its target and last-updated block/timestamp.
4. **Check registration freshness.** Compare registration/binding timestamps
   against the caller-supplied `staleAfter` threshold (default: none — freshness
   is informational, not classifying, unless the evaluating agent opts in to a
   staleness policy).
5. **Classify.** Apply the table in §5 to the evidence gathered in steps 1–4.

Any implementation given the same `(chainId, registry, agentId)` and the same
chain state MUST produce the same classification. This is the normative
guarantee: **no implementation-specific heuristics may affect the classification
step.**

---

## 5. Structural Risk Exposure Classification (Normative)

| Classification | Condition |
|---|---|
| `UNREGISTERED` | No valid ERC-8004 registration found |
| `MALFORMED_GRAPH` | Controller graph has a cycle or exceeds max traversal depth |
| `UNBOUND` | Valid registration, but no `bindingOf` target (no body/beacon) |
| `EOA_ROOTED` | Controller graph terminates at a bare EOA with no module gating |
| `SAFE_ROOTED_UNGATED` | Terminates at a Safe with no recognized spend/action modules installed |
| `SAFE_ROOTED_GATED` | Terminates at a Safe with one or more recognized modules (e.g. `DailyBudgetModule`, `HumanInTheLoopModule`) active |

This is a **structural** classification only. It says nothing about the
agent's behavior, competence, or intent — only about the shape and gating of
the control graph beneath its identity. An evaluating agent combines this with
its own policy (e.g. "only delegate to `SAFE_ROOTED_GATED` identities with a
`HumanInTheLoopModule`") to make a delegation decision. **The spec does not
make delegation decisions — it supplies recomputable inputs to one.**

---

## 6. Extensions: Attestations (Non-normative, Optional)

Attestations are oracle-asserted claims that require trusting the attestor
(e.g. "this agent's off-chain spend behavior looked anomalous over the last
7 days," or reputation scores derived from swarm-verifier activity logs).

Attestations:
- MUST be clearly and separately labeled from SRE output — never merged into
  the classification in §5.
- MUST disclose the attestor's identity/address and the data it observed.
- MAY be omitted entirely by a conforming implementation with no loss of
  protocol conformance — SRE (§3–§5) is fully computable without them.

Existing notapaperclip.red functionality that falls into this category today
(non-normative, to be relabeled away from "trust"/"score" naming in the
frontend and MCP tool surface):

- Swarm verification / multi-agent attestation log (`/api/verify/swarm`)
- Spend/exposure heuristics (`riskLevel`, `exposure` fields in
  `/api/osint/[module]`) — these are already risk-shaped, not trust-shaped,
  and should be reconciled with the SRE classification in §5 rather than
  kept as a separate ad hoc scheme.

---

## 7. Conformance

An implementation is conformant if:

1. It computes SRE (§5) using only the data sources in §3.
2. Given identical on-chain state, two independent conformant implementations
   produce identical classifications for the same identity.
3. Any attestation-based output (§6) is visually and structurally distinct
   from SRE output, and never silently blended into it.

---

## 8. Open Questions (soliciting feedback)

- Should `staleAfter` have a normative default, or remain purely
  caller-configurable? Current draft leans toward no default (informational
  only) to avoid smuggling a subjective judgment back into §5.
- Module recognition allowlist (`DailyBudgetModule`, `HumanInTheLoopModule`,
  ...) — should this be an open, permissionless registry of module
  signatures rather than a hardcoded list, so third parties can extend
  `SAFE_ROOTED_GATED` recognition without depending on this repo?
- Traversal depth bound (currently 8) — arbitrary, open to revision based on
  real-world controller graph depths observed across ecosystems.

Feedback welcome, particularly on the traversal algorithm (§4) and the module
recognition mechanism (§8, second bullet) — this is the exact seam identified
by community review as most likely to either stay neutral or drift toward a
vendor-specific wrapper.
