/**
 * x402 Probe API
 * 
 * HTTP 402 Payment Required protocol probing for agent economic intelligence.
 * Part of notapaperclip.red OSINT suite.
 */

import { NextRequest, NextResponse } from 'next/server';
import { probeX402Endpoint, probeAgentX402, checkAgentSolvency, analyzeX402Footprint } from '@/lib/x402/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Support multiple query patterns
  const agent = searchParams.get('agent');
  const target = searchParams.get('target');
  
  try {
    // URL-based probe (direct endpoint testing)
    const targetUrl = searchParams.get('url');
    if (targetUrl) {
      const result = await probeX402Endpoint(targetUrl);
      return NextResponse.json({
        type: 'endpoint_probe',
        url: targetUrl,
        x402Enabled: result.x402Enabled,
        paymentRequired: result.paymentRequired,
        paymentMethods: result.paymentMethods,
        minAmount: result.minAmount,
        destinationAddress: result.destinationAddress,
        supportedTokens: result.supportedTokens,
        probeStatus: result.probeStatus,
        error: result.error,
        responseTime: result.responseTime,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Agent-based probe (comprehensive x402 profile)
    const agentName = agent || target;
    if (!agentName) {
      return NextResponse.json(
        { error: 'Missing required parameter: use agent, target, or url' },
        { status: 400 }
      );
    }
    
    // Run comprehensive x402 analysis
    const [x402Profile, solvency, footprint] = await Promise.all([
      probeAgentX402(agentName),
      checkAgentSolvency(agentName),
      analyzeX402Footprint(agentName),
    ]);
    
    return NextResponse.json({
      type: 'agent_probe',
      agent: agentName,
      x402: {
        enabled: x402Profile.x402Support,
        micropaymentReady: x402Profile.micropaymentReady,
        supportedChains: x402Profile.supportedChains,
        paymentEndpoints: x402Profile.paymentEndpoints,
      },
      solvency: {
        solvent: solvency.solvent,
        balance: solvency.balance,
        currency: solvency.currency,
        minimumRequired: solvency.minimumRequired,
      },
      economicActivity: x402Profile.economicActivity,
      footprint: {
        score: footprint.footprintScore,
        readiness: footprint.overallReadiness,
        endpoints: footprint.paymentEndpoints,
        chains: footprint.supportedChains,
      },
      timestamp: x402Profile.timestamp,
    });
    
  } catch (error: any) {
    console.error('x402 probe error:', error);
    return NextResponse.json(
      { error: error.message || 'x402 probe failed' },
      { status: 500 }
    );
  }
}
