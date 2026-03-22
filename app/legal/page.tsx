import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal — notapaperclip.red',
  description: 'Disclaimer and Terms of Service for notapaperclip.red',
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">

        <h1 className="text-3xl font-bold mb-2">Legal</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: March 2026</p>

        {/* Disclaimer */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold mb-6 text-red-400">Disclaimer</h2>

          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <div>
              <h3 className="text-white font-medium mb-2">Informational Purpose Only</h3>
              <p>
                notapaperclip.red is a read-only compliance oracle. All data displayed — including ERC-8004
                agent registrations, A2A card validation results, swarm trust scores, and MCP endpoint probes —
                is provided for informational purposes only. Nothing on this site constitutes financial advice,
                legal advice, investment advice, or a recommendation to transact with any agent or protocol.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">No Warranty on Oracle Accuracy</h3>
              <p>
                Trust scores, compliance verdicts, and identity verifications are derived from on-chain state
                reads (<code className="bg-gray-900 px-1 rounded text-green-400">eth_call</code>) and
                Cloudflare Worker KV snapshots at the time of query. On-chain state changes continuously.
                This oracle does not guarantee real-time accuracy, completeness, or fitness for any particular
                purpose. Do not rely solely on this oracle when making decisions involving real assets.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">Third-Party Data</h3>
              <p>
                This site queries third-party sources including public blockchain RPC endpoints, Cloudflare
                Worker KV, IPFS gateways, and agent-served <code className="bg-gray-900 px-1 rounded text-green-400">/.well-known/agent-card.json</code> endpoints.
                notapaperclip.red has no control over the accuracy or availability of these external sources
                and accepts no liability for errors originating from them.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">No Write Capability</h3>
              <p>
                This frontend has no ability to modify, create, or delete any on-chain state or off-chain
                KV record. It is architecturally read-only. The oracle cannot flag, censor, or alter
                any agent&apos;s data — it can only display what already exists on-chain or in the Worker KV.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">Bad Actor Flags</h3>
              <p>
                Swarm trust scores and bad actor flags (e.g. <code className="bg-gray-900 px-1 rounded text-yellow-400">victor.openclaw.gno</code> flagged
                red in the reference swarm) are generated algorithmically based on on-chain behaviour,
                spending module status, and A2A card compliance. These flags are not defamatory statements —
                they reflect observable on-chain and off-chain data at the time of query. Any agent owner
                may update their on-chain profile and the oracle will reflect the updated state on the next query.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">Limitation of Liability</h3>
              <p>
                To the fullest extent permitted by applicable law, notapaperclip.red and its operators
                disclaim all liability for any loss or damage arising from reliance on information provided
                by this site, including but not limited to financial loss, missed transactions, incorrect
                identity resolution, or unavailability of any endpoint.
              </p>
            </div>
          </div>
        </section>

        {/* Terms of Service */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold mb-6 text-white">Terms of Service</h2>

          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <div>
              <h3 className="text-white font-medium mb-2">Acceptance</h3>
              <p>
                By accessing or using notapaperclip.red, you agree to these Terms of Service. If you do
                not agree, do not use this site.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">Permitted Use</h3>
              <p>
                You may use this site to query public on-chain and off-chain data for informational purposes.
                You may access the API endpoints (<code className="bg-gray-900 px-1 rounded text-green-400">/api/*</code>) programmatically
                for non-commercial research, agent development, and integration testing. Fair use applies —
                do not send automated requests at a volume that degrades service for other users.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">Prohibited Use</h3>
              <p>You may not use this site to:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-400">
                <li>Scrape or mirror the site for commercial redistribution without permission</li>
                <li>Attempt to circumvent rate limiting or access controls</li>
                <li>Use oracle outputs as the sole basis for automated financial decisions without human review</li>
                <li>Misrepresent oracle outputs as authoritative legal or regulatory determinations</li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">API Usage</h3>
              <p>
                The public API endpoints are provided as-is with no uptime guarantee. Rate limits may be
                applied without notice. The API may be modified or deprecated at any time.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">Intellectual Property</h3>
              <p>
                The source code for this site is open source and available at{' '}
                <a
                  href="https://github.com/eyemine/notapaperclip-red"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:underline"
                >
                  github.com/eyemine/notapaperclip-red
                </a>
                . The notapaperclip.red name, logo, and logotype are the property of their respective owner.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">ERC-8004 Protocol</h3>
              <p>
                ERC-8004 is an open standard. notapaperclip.red is one implementation of an oracle
                over this standard. It is not the authoritative registry — the on-chain contract at{' '}
                <code className="bg-gray-900 px-1 rounded text-green-400">0x8004A169FB4a3325136EB29fA0ceB6D2e539a432</code>{' '}
                on Gnosis mainnet and Base mainnet is the source of truth.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">Changes to These Terms</h3>
              <p>
                These terms may be updated at any time. Continued use of the site after changes constitutes
                acceptance of the revised terms. The &quot;last updated&quot; date at the top of this page
                reflects the most recent revision.
              </p>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">Contact</h3>
              <p>
                Questions about these terms may be directed to the operator via{' '}
                <a
                  href="https://x.com/ghostagent_og"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:underline"
                >
                  @ghostagent_og
                </a>{' '}
                or by sending an encrypted message to{' '}
                <code className="bg-gray-900 px-1 rounded text-green-400">eyemine_@nftmail.box</code>.
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-gray-800 pt-8 text-xs text-gray-600">
          notapaperclip.red — the oracle can see the truth, but cannot move the goalposts.
        </div>

      </div>
    </main>
  );
}
