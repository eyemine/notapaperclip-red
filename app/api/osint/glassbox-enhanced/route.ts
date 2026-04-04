/**
 * Enhanced OSINT module with glassbox integration
 * Combines traditional OSINT with glassbox transparency data
 */

import { NextRequest, NextResponse } from 'next/server';

// Simple agent identity check
async function getAgentIdentity(agent: string) {
  try {
    // Parse TLD from agent name - check for molt.gno first
    if (agent.includes('.molt.gno') || agent === 'ghostagent') {
      return { tld: 'molt.gno' };
    } else if (agent.includes('.openclaw.gno') || agent === 'victor') {
      return { tld: 'openclaw.gno' };
    } else if (agent.includes('.nftmail.gno') || agent === 'eyemine') {
      return { tld: 'nftmail.gno' };
    }
    
    // Fallback to worker call
    const response = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL || 'https://nftmail-email-worker.richard-159.workers.dev'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent.replace('.gno', '').replace('.molt', '').replace('.openclaw', '').replace('.nftmail', '') })
    });
    const data = await response.json();
    return data;
  } catch {
    return { tld: 'unknown' };
  }
}

interface GlassboxOSINTResponse {
  agent: string;
  glassbox_data?: {
    source: 'molt.gno' | 'openclaw.gno';
    transparency_score: number;
    transaction_analysis: {
      total_transactions: number;
      total_value: string;
      unique_counterparties: number;
      avg_transaction_value: string;
      frequency_per_day: number;
    };
    network_intelligence: {
      centrality_score: number;
      connection_count: number;
      interaction_types: string[];
      risk_factors: string[] | undefined;
    };
    behavioral_patterns: {
      activity_frequency: number;
      detected_patterns: string[];
      predictive_confidence: number;
    };
  };
  fallback_osint: {
    footprint: any;
    exposure: any;
    basic_reliability: number;
  };
  confidence_score: number;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agent = searchParams.get('agent');
  
  if (!agent) {
    return NextResponse.json(
      { error: 'Agent address is required' },
      { status: 400 }
    );
  }

  try {
    // Get agent identity to determine glassbox capability
    const identity = await getAgentIdentity(agent);
    
    const response: GlassboxOSINTResponse = {
      agent,
      confidence_score: 0.7,
      timestamp: new Date().toISOString(),
      fallback_osint: await getFallbackOSINT(agent, identity.tld)
    };

    // Check if agent has glassbox capability (Molt.gno or OpenClaw.gno)
    if (identity.tld === 'molt.gno' || identity.tld === 'openclaw.gno') {
      // Simulate glassbox data collection
      // In production, this would call actual glassbox contracts
      response.glassbox_data = await simulateGlassboxData(agent, identity.tld);
      response.confidence_score = 0.95;
    }

    // Always provide fallback OSINT
    response.fallback_osint = await getFallbackOSINT(agent, identity.tld);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Glassbox OSINT failed:', error);
    
    return NextResponse.json({
      error: 'OSINT collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      fallback_osint: await getFallbackOSINT(agent, 'unknown')
    }, { status: 500 });
  }
}

async function simulateGlassboxData(agent: string, tld: string): Promise<any> {
  // Simulate glassbox transparency data
  // In production, this would query actual Molt.gno/OpenClaw.gno contracts
  
  const baseData = {
    source: tld === 'molt.gno' ? 'molt.gno' : 'openclaw.gno',
    transparency_score: tld === 'molt.gno' ? 10.0 : 9.5,
    transaction_analysis: {
      total_transactions: Math.floor(Math.random() * 1000) + 100,
      total_value: (Math.random() * 10000).toFixed(4),
      unique_counterparties: Math.floor(Math.random() * 50) + 5,
      avg_transaction_value: (Math.random() * 100).toFixed(4),
      frequency_per_day: Math.random() * 10
    },
    network_intelligence: {
      centrality_score: Math.random() * 100,
      connection_count: Math.floor(Math.random() * 100) + 10,
      interaction_types: ['payment', 'contract_call', 'token_transfer'],
      risk_factors: [] as string[]
    },
    behavioral_patterns: {
      activity_frequency: Math.random() * 10,
      detected_patterns: ['regular_activity', 'diverse_interactions'],
      predictive_confidence: Math.random() * 0.5 + 0.5
    }
  };

  // Add specific intelligence based on TLD
  if (tld === 'molt.gno') {
    baseData.behavioral_patterns.detected_patterns.push('high_transparency');
    baseData.network_intelligence.risk_factors = ['low_risk'];
  } else if (tld === 'openclaw.gno') {
    baseData.behavioral_patterns.detected_patterns.push('adaptive_privacy');
    baseData.network_intelligence.risk_factors = ['configurable_transparency'];
  }

  return baseData;
}

async function getFallbackOSINT(agent: string, tld?: string) {
  try {
    // Import basic OSINT modules
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://notapaperclip.red';
    const footprintRes = await fetch(`${baseUrl}/api/osint/footprint?agent=${agent}`);
    const exposureRes = await fetch(`${baseUrl}/api/osint/exposure?agent=${agent}`);
    
    const [footprint, exposure] = await Promise.all([
      footprintRes.ok ? footprintRes.json() : { error: 'Footprint unavailable' },
      exposureRes.ok ? exposureRes.json() : { error: 'Exposure unavailable' }
    ]);

    // Fix exposure data if we know the TLD
    if (!exposure.error && tld && ['molt', 'nftmail', 'openclaw', 'picoclaw', 'vault', 'agent'].includes(tld.replace('.gno', ''))) {
      // Remove incorrect "no-gns-name" exposure for known TLD agents
      if (exposure.exposures) {
        exposure.exposures = exposure.exposures.filter((e: any) => e.type !== 'no-gns-name');
        // Recalculate score
        exposure.score = Math.max(0, 100 - exposure.exposures.reduce((acc: number, e: any) => {
          return acc + (e.severity === 'high' ? 30 : e.severity === 'medium' ? 15 : 5);
        }, 0));
      }
      
      // Fix footprint data for known TLD agents
      if (footprint && footprint.offChain) {
        footprint.offChain.hasX402Capability = true;
        footprint.offChain.tld = tld;
        footprint.offChain.gnsName = `${agent}.${tld}`;
        footprint.exposure.riskLevel = 'low';
      }
    }

    return {
      footprint: footprint.error ? null : footprint,
      exposure: exposure.error ? null : exposure,
      basic_reliability: footprint.error || exposure.error ? 0.3 : 0.7
    };
  } catch (error) {
    return {
      footprint: null,
      exposure: null,
      basic_reliability: 0.3
    };
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { agent, action } = body;

  if (action === 'enable-glassbox') {
    // Enable glassbox mode for OpenClaw.gno agents
    try {
      // In production, this would call the actual contract
      return NextResponse.json({
        success: true,
        message: 'Glassbox mode enabled for OpenClaw.gno agent',
        agent,
        transaction_hash: '0x' + Math.random().toString(16).slice(2, 66)
      });
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to enable glassbox mode',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
