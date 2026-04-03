/**
 * GET /.well-known/agent-card.json
 * 
 * Google A2A Specification §8.2 Agent Card
 * Describes notapaperclip.red as an Agent Trust Oracle service
 * that other agents can interact with programmatically.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const card = {
    name: 'NotAPaperclip Agent Trust Oracle',
    description: 'Neutral verification hub for AI agent trust scoring, ERC-8004 identity resolution, and swarm attestation validation.',
    url: 'https://notapaperclip.red',
    version: '1.0.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    authentication: {
      schemes: ['none'],
      credentials: null,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text', 'json'],
    skills: [
      {
        id: 'agent-verification',
        name: 'Agent Identity Verification',
        description: 'Resolve any agent by ERC-8004 identity across Gnosis, Base, and Base Sepolia chains. Returns Safe address, agentId, TBA, and spending modules.',
        tags: ['erc8004', 'identity', 'verification', 'safe', 'tba'],
        examples: [
          'Verify agent ghostagent',
          'Check if eyemine.nftmail.gno is registered',
          'Get Safe address for victor.openclaw.gno'
        ],
      },
      {
        id: 'swarm-trust-score',
        name: 'Swarm Trust Scoring',
        description: 'Evaluate multi-agent swarm trust levels. Scores agents, flags bad actors, returns connection graphs.',
        tags: ['swarm', 'trust', 'scoring', 'multi-agent', 'attestation'],
        examples: [
          'Score swarm ghostagent',
          'Evaluate trust for swarm eyemine',
          'Check swarm health status'
        ],
      },
      {
        id: 'a2a-card-validation',
        name: 'A2A Card Validation',
        description: 'Fetch and validate any agent\'s /.well-known/agent-card.json against Google A2A spec §8.2.',
        tags: ['a2a', 'agent-card', 'validation', 'google'],
        examples: [
          'Validate A2A card at https://ghostagent.ninja/.well-known/agent-card.json',
          'Check agent-card compliance'
        ],
      },
      {
        id: 'mcp-probe',
        name: 'MCP Server Probe',
        description: 'Test any agent\'s Model Context Protocol server endpoints live.',
        tags: ['mcp', 'model-context-protocol', 'probe', 'tools'],
        examples: [
          'Probe MCP at https://agent.example.com/mcp',
          'Test model context protocol server'
        ],
      },
      {
        id: 'email-resolution',
        name: 'Agent Email Resolution',
        description: 'Resolve agent email addresses (name_@nftmail.box) to on-chain identities and reputation scores.',
        tags: ['email', 'nftmail', 'resolution', 'reputation'],
        examples: [
          'Resolve ghostagent_@nftmail.box',
          'Lookup eyemine_@nftmail.box identity'
        ],
      }
    ],
    // API endpoints for programmatic access
    apiEndpoints: {
      verifyAgent: {
        path: '/api/erc8004/resolve',
        method: 'GET',
        params: { agent: 'string (agent name)' },
        description: 'Resolve ERC-8004 identity'
      },
      verifySwarm: {
        path: '/api/verify/swarm',
        method: 'GET', 
        params: { swarmId: 'string' },
        description: 'Get swarm trust score and connection graph'
      },
      validateA2A: {
        path: '/api/a2a/validate',
        method: 'GET',
        params: { url: 'string (agent-card.json URL)' },
        description: 'Validate A2A agent card compliance'
      },
      probeMCP: {
        path: '/api/mcp/probe',
        method: 'GET',
        params: { url: 'string (MCP endpoint)' },
        description: 'Probe MCP server availability'
      },
      resolveEmail: {
        path: '/api/agent-lookup',
        method: 'GET',
        params: { email: 'string (agent email)' },
        description: 'Resolve agent email to identity'
      },
      swarmConnections: {
        path: '/api/swarm/connections',
        method: 'GET',
        params: { swarmId: 'string' },
        description: 'Get swarm connection graph (nodes and edges)'
      }
    },
    // Contact for A2A interactions
    contact: {
      email: 'oracle@notapaperclip.red',
      support: 'https://notapaperclip.red/legal'
    },
    // Legal/Compliance
    legal: {
      termsOfService: 'https://notapaperclip.red/legal',
      privacyPolicy: 'https://notapaperclip.red/legal',
    },
    // Documentation
    documentation: {
      url: 'https://github.com/eyemine/notapaperclip-red',
      description: 'GitHub repository with API documentation'
    }
  };

  return NextResponse.json(card, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
