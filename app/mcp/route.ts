/**
 * MCP Server for NotAPaperclip Agent Trust Oracle
 * 
 * Model Context Protocol (MCP) implementation allowing AI agents
 * to discover and invoke notapaperclip verification capabilities as tools.
 * 
 * Endpoint: /mcp (GET for SSE streaming, POST for JSON-RPC)
 */

import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';

// MCP Tool Definitions
const MCP_TOOLS = [
  {
    name: 'verify_agent_identity',
    description: 'Resolve any agent by ERC-8004 identity across Gnosis, Base, and Base Sepolia chains. Returns Safe address, agentId, TBA, and spending modules.',
    inputSchema: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'Agent name (e.g., ghostagent, eyemine, victor.openclaw)'
        }
      },
      required: ['agentName']
    }
  },
  {
    name: 'score_swarm_trust',
    description: 'Evaluate multi-agent swarm trust levels. Scores agents, flags bad actors, returns connection graphs.',
    inputSchema: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm identifier (e.g., ghostagent, eyemine)'
        }
      },
      required: ['swarmId']
    }
  },
  {
    name: 'validate_a2a_card',
    description: 'Fetch and validate any agent\'s /.well-known/agent-card.json against Google A2A spec §8.2',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Full URL to agent-card.json (e.g., https://ghostagent.ninja/.well-known/agent-card.json)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'probe_mcp_server',
    description: 'Test any agent\'s Model Context Protocol server endpoints live',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'MCP server URL (e.g., https://agent.example.com/mcp)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'resolve_agent_email',
    description: 'Resolve agent email addresses (name_@nftmail.box) to on-chain identities and reputation scores',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Agent email (e.g., ghostagent_@nftmail.box)'
        }
      },
      required: ['email']
    }
  },
  {
    name: 'get_swarm_graph',
    description: 'Get swarm connection graph with nodes (agents) and edges (connections) for visualization',
    inputSchema: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm identifier'
        }
      },
      required: ['swarmId']
    }
  }
];

// Tool implementations
async function verifyAgentIdentity(agentName: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://notapaperclip.red'}/api/erc8004/resolve?agent=${encodeURIComponent(agentName)}`);
  return res.json();
}

async function scoreSwarmTrust(swarmId: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://notapaperclip.red'}/api/verify/swarm?swarmId=${encodeURIComponent(swarmId)}`);
  return res.json();
}

async function validateA2ACard(url: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://notapaperclip.red'}/api/a2a/validate?url=${encodeURIComponent(url)}`);
  return res.json();
}

async function probeMCP(url: string) {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    return { 
      available: res.ok, 
      status: res.status,
      tools: res.ok ? await res.json().catch(() => null) : null
    };
  } catch (e: any) {
    return { available: false, error: e?.message };
  }
}

async function resolveAgentEmail(email: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://notapaperclip.red'}/api/agent-lookup?email=${encodeURIComponent(email)}`);
  return res.json();
}

async function getSwarmGraph(swarmId: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://notapaperclip.red'}/api/swarm/connections?swarmId=${encodeURIComponent(swarmId)}`);
  return res.json();
}

// SSE endpoint for MCP streaming
export async function GET(req: NextRequest) {
  const upgrade = req.headers.get('upgrade');
  
  if (upgrade === 'websocket' || req.headers.get('accept')?.includes('text/event-stream')) {
    // Return SSE stream for MCP
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial tools list
        const message = {
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'notapaperclip-mcp',
              version: '1.0.0'
            }
          }
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // Return MCP server info for HTTP GET
  return NextResponse.json({
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: 'notapaperclip-mcp',
      version: '1.0.0'
    },
    tools: MCP_TOOLS,
    endpoints: {
      sse: '/mcp',
      jsonrpc: '/mcp'
    }
  });
}

// JSON-RPC endpoint for MCP tool invocations
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jsonrpc, id, method, params } = body;

    if (jsonrpc !== '2.0') {
      return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } }, { status: 400 });
    }

    let result;

    switch (method) {
      case 'tools/list':
        result = { tools: MCP_TOOLS };
        break;

      case 'tools/call':
        const { name, arguments: args } = params;
        
        switch (name) {
          case 'verify_agent_identity':
            result = await verifyAgentIdentity(args.agentName);
            break;
          case 'score_swarm_trust':
            result = await scoreSwarmTrust(args.swarmId);
            break;
          case 'validate_a2a_card':
            result = await validateA2ACard(args.url);
            break;
          case 'probe_mcp_server':
            result = await probeMCP(args.url);
            break;
          case 'resolve_agent_email':
            result = await resolveAgentEmail(args.email);
            break;
          case 'get_swarm_graph':
            result = await getSwarmGraph(args.swarmId);
            break;
          default:
            return NextResponse.json({ 
              jsonrpc: '2.0', 
              id, 
              error: { code: -32601, message: `Unknown tool: ${name}` } 
            }, { status: 400 });
        }
        break;

      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'notapaperclip-mcp',
            version: '1.0.0'
          }
        };
        break;

      default:
        return NextResponse.json({ 
          jsonrpc: '2.0', 
          id, 
          error: { code: -32601, message: `Method not found: ${method}` } 
        }, { status: 400 });
    }

    return NextResponse.json({ jsonrpc: '2.0', id, result });

  } catch (e: any) {
    return NextResponse.json({ 
      jsonrpc: '2.0', 
      id: null, 
      error: { code: -32700, message: e?.message || 'Parse error' } 
    }, { status: 400 });
  }
}
