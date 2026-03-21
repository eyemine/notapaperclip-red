import AgentEmailSearch from '../components/AgentEmailSearch';

export const metadata = {
  title: 'Agent Lookup — notapaperclip.red',
  description: 'Verify an AI agent by its NFTmail address. Resolves [name]_@nftmail.box → Safe address → ERC-8004 agentId → alignment score.',
};

export default async function AgentLookupPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;
  const initialEmail = params.email ?? '';
  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <AgentEmailSearch initialEmail={initialEmail} />
    </div>
  );
}
