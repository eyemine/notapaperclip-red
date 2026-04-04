/**
 * Glassbox OSINT Collector for Molt.gno and OpenClaw.gno
 * Provides rich intelligence from transparent Molts
 */

import { ethers } from 'ethers';

// Molt.gno always-on glassbox contract ABI (simplified)
const MOLT_ABI = [
  'function glassboxMode() view returns (bool)',
  'function osintLevel() view returns (uint256)',
  'function getAgentInteractions(address agent) view returns (tuple(address[] counterparties, uint256[] values, string[] types, uint256[] timestamps, string[] chains))',
  'function getOperationalMetrics(address agent) view returns (tuple(uint256 totalTransactions, uint256 totalValue, uint256 uniqueCounterparties, uint256 avgValue))',
  'event OSINTDataUpdated(address indexed agent, address indexed counterparty, uint256 value, string interactionType)'
];

// OpenClaw.gno toggleable glassbox contract ABI
const OPENCLAW_ABI = [
  'function glassboxMode() view returns (bool)',
  'function toggleGlassbox(bool enable)',
  'function getOSINTData(address agent) view returns (tuple(address[] counterparties, uint256[] values, string[] types))',
  'function collectRichOSINT(address agent) view returns (tuple(address agent, tuple(uint256 totalTransactions, uint256 totalValue, uint256 uniqueCounterparties) operationalMetrics, tuple(uint256 incoming, uint256 outgoing) economicActivity, tuple(uint256 centrality, uint256 connections) networkPosition, tuple(uint256 frequency, uint256 patterns) behavioralPatterns, tuple(uint256 score, string[] factors) riskAssessment, tuple(float confidence, string[] predictions) predictiveInsights))',
  'event GlassboxToggled(bool enabled)'
];

export interface GlassboxOSINTData {
  agent: string;
  source: string;
  intelligence: {
    transaction_analysis?: {
      totalTransactions: number;
      totalValue: string;
      uniqueCounterparties: number;
      avgValue: string;
      frequency: number;
    };
    relationship_network?: {
      centrality: number;
      connections: number;
      counterparties: string[];
      interactionTypes: string[];
    };
    behavioral_insights?: {
      frequency: number;
      patterns: string[];
      riskFactors: string[];
    };
    predictive_analysis?: {
      confidence: number;
      predictions: string[];
    };
    transparency_score: number;
    reliability_score: number;
  };
  confidence_score: number;
  timestamp: string;
}

export class MoltOSINTCollector {
  private contract: ethers.Contract;
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
    this.contract = new ethers.Contract('0x4b54213c1e5826497ff39ba8c87a7b75d2bc3c50', MOLT_ABI, provider);
  }

  async collectRichOSINT(agentAddress: string): Promise<GlassboxOSINTData | null> {
    try {
      // Check glassbox mode (should always be true for Molt.gno)
      const glassboxMode = await this.contract.glassboxMode();
      if (!glassboxMode) {
        throw new Error('Molt.gno glassbox mode not enabled');
      }

      // Get agent interactions
      const interactions = await this.contract.getAgentInteractions(agentAddress);
      
      // Get operational metrics
      const metrics = await this.contract.getOperationalMetrics(agentAddress);

      // Analyze transaction patterns
      const transactionAnalysis = {
        totalTransactions: Number(metrics.totalTransactions),
        totalValue: ethers.formatEther(metrics.totalValue),
        uniqueCounterparties: Number(metrics.uniqueCounterparties),
        avgValue: Number(metrics.totalTransactions) > 0 
          ? ethers.formatEther(BigInt(metrics.totalValue) / BigInt(metrics.totalTransactions))
          : '0',
        frequency: this.calculateFrequency(interactions.timestamps)
      };

      // Build relationship graph
      const relationshipNetwork = {
        centrality: this.calculateCentrality(interactions.counterparties),
        connections: interactions.counterparties.length,
        counterparties: interactions.counterparties,
        interactionTypes: interactions.types
      };

      // Detect behavioral patterns
      const behavioralInsights = {
        frequency: this.calculateFrequency(interactions.timestamps),
        patterns: this.detectPatterns(interactions.types, interactions.values),
        riskFactors: this.assessRisk(interactions.values, interactions.counterparties)
      };

      // Generate predictive insights
      const predictiveAnalysis = {
        confidence: this.calculatePredictiveConfidence(interactions),
        predictions: this.generatePredictions(interactions, metrics)
      };

      return {
        agent: agentAddress,
        source: 'molt.gno_glassbox',
        intelligence: {
          transaction_analysis: transactionAnalysis,
          relationship_network: relationshipNetwork,
          behavioral_insights: behavioralInsights,
          predictive_analysis: predictiveAnalysis,
          transparency_score: 10.0,
          reliability_score: 0.97
        },
        confidence_score: 0.97,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Molt.gno OSINT collection failed:', error);
      return null;
    }
  }

  private calculateFrequency(timestamps: bigint[]): number {
    if (timestamps.length < 2) return 0;
    const sorted = timestamps.map(t => Number(t)).sort();
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i] - sorted[i-1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return avgInterval > 0 ? 86400 / avgInterval : 0; // transactions per day
  }

  private calculateCentrality(counterparties: string[]): number {
    // Simple degree centrality: number of unique counterparties
    return counterparties.length;
  }

  private detectPatterns(types: string[], values: bigint[]): string[] {
    const patterns = [];
    const typeCounts = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Detect dominant interaction type
    const dominantType = Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)[0];
    if (dominantType && dominantType[1] > types.length * 0.6) {
      patterns.push(`predominantly_${dominantType[0]}`);
    }

    // Detect value patterns
    const totalValue = values.reduce((a: bigint, b: bigint) => a + b, BigInt(0));
    const avgValue = totalValue > BigInt(0)
      ? ethers.formatEther(totalValue / BigInt(values.length))
      : '0';
    const highValueCount = values.filter(v => v > BigInt(2) * totalValue / BigInt(values.length)).length;
    if (highValueCount > values.length * 0.3) {
      patterns.push('high_value_transactions');
    }

    return patterns;
  }

  private assessRisk(values: bigint[], counterparties: string[]): string[] {
    const risks = [];
    
    // High concentration risk
    const uniqueCounterparties = new Set(counterparties).size;
    if (uniqueCounterparties < 3 && counterparties.length > 10) {
      risks.push('high_concentration_risk');
    }

    // High value risk
    const totalValue = values.reduce((a: bigint, b: bigint) => a + b, BigInt(0));
    const avgValue = totalValue > BigInt(0)
      ? ethers.formatEther(totalValue / BigInt(values.length))
      : '0';
    if (Number(ethers.formatEther(avgValue)) > 1000) {
      risks.push('high_value_exposure');
    }

    return risks;
  }

  private calculatePredictiveConfidence(interactions: any): number {
    // Base confidence on data volume and recency
    const dataVolume = Math.min(interactions.counterparties.length / 100, 1);
    const recency = this.calculateRecency(interactions.timestamps);
    return (dataVolume + recency) / 2;
  }

  private generatePredictions(interactions: any, metrics: any): string[] {
    const predictions = [];
    
    // Predict future activity based on patterns
    const frequency = this.calculateFrequency(interactions.timestamps);
    if (frequency > 5) {
      predictions.push('high_future_activity');
    }

    // Predict network growth
    const growthRate = this.calculateGrowthRate(interactions.counterparties);
    if (growthRate > 0.1) {
      predictions.push('network_expansion');
    }

    return predictions;
  }

  private calculateRecency(timestamps: bigint[]): number {
    if (timestamps.length === 0) return 0;
    const latest = Math.max(...timestamps.map(t => Number(t)));
    const now = Math.floor(Date.now() / 1000);
    const daysSinceLast = (now - latest) / 86400;
    return Math.max(0, 1 - daysSinceLast / 30); // Decay over 30 days
  }

  private calculateGrowthRate(counterparties: string[]): number {
    // Simple growth rate based on unique counterparties
    return counterparties.length * 0.01; // Placeholder calculation
  }
}

export class OpenClawOSINTManager {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer: ethers.Signer;

  constructor(provider: ethers.Provider, signer: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.contract = new ethers.Contract('0xbD8285A8455CCEC4bE671D9eE3924Ab1264fcbbe', OPENCLAW_ABI, signer);
  }

  async enableGlassboxOSINT(): Promise<void> {
    try {
      const tx = await this.contract.toggleGlassbox(true);
      await tx.wait();
      console.log('OpenClaw.gno glassbox OSINT enabled');
    } catch (error) {
      console.error('Failed to enable OpenClaw glassbox:', error);
      throw error;
    }
  }

  async collectRichOSINT(agentAddress: string): Promise<GlassboxOSINTData | null> {
    try {
      // Check if glassbox mode is enabled
      const isGlassbox = await this.contract.glassboxMode();
      
      if (!isGlassbox) {
        await this.enableGlassboxOSINT();
      }

      // Collect comprehensive OSINT from OpenClaw
      const richOSINT = await this.contract.collectRichOSINT(agentAddress);

      return {
        agent: agentAddress,
        source: 'openclaw.gno_glassbox',
        intelligence: {
          transaction_analysis: {
            totalTransactions: Number(richOSINT.operationalMetrics.totalTransactions),
            totalValue: ethers.formatEther(richOSINT.operationalMetrics.totalValue),
            uniqueCounterparties: Number(richOSINT.operationalMetrics.uniqueCounterparties),
            avgValue: Number(richOSINT.operationalMetrics.totalTransactions) > 0
              ? ethers.formatEther(richOSINT.operationalMetrics.totalValue / BigInt(richOSINT.operationalMetrics.totalTransactions))
              : '0',
            frequency: 0
          },
          relationship_network: {
            centrality: Number(richOSINT.networkPosition.centrality),
            connections: Number(richOSINT.networkPosition.connections),
            counterparties: [],
            interactionTypes: []
          },
          behavioral_insights: {
            frequency: Number(richOSINT.behavioralPatterns.frequency),
            patterns: ['active_pattern'],
            riskFactors: richOSINT.riskAssessment.factors
          },
          predictive_analysis: {
            confidence: Number(richOSINT.predictiveInsights.confidence),
            predictions: richOSINT.predictiveInsights.predictions
          },
          transparency_score: 9.5,
          reliability_score: 0.94
        },
        confidence_score: 0.94,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('OpenClaw.gno OSINT collection failed:', error);
      return null;
    }
  }
}

export class EnhancedOSINT {
  private moltCollector: MoltOSINTCollector;
  private openclawManager: OpenClawOSINTManager;

  constructor(provider: ethers.Provider, signer: ethers.Signer) {
    this.moltCollector = new MoltOSINTCollector(provider);
    this.openclawManager = new OpenClawOSINTManager(provider, signer);
  }

  async getRichOSINT(agentAddress: string): Promise<{
    agent: string;
    sources: string[];
    intelligence: any;
    confidence_score: number;
    timestamp: string;
  }> {
    // Try Molt.gno first (always glassbox)
    const moltData = await this.moltCollector.collectRichOSINT(agentAddress);
    
    // Try OpenClaw.gno (toggleable glassbox)
    const openclawData = await this.openclawManager.collectRichOSINT(agentAddress);
    
    // Combine intelligence from both sources
    const combinedIntelligence = this.fuseIntelligence(
      moltData?.intelligence || {},
      openclawData?.intelligence || {}
    );
    
    const sources = [];
    if (moltData) sources.push('molt.gno');
    if (openclawData) sources.push('openclaw.gno');
    
    return {
      agent: agentAddress,
      sources,
      intelligence: combinedIntelligence,
      confidence_score: this.calculateCombinedConfidence(moltData, openclawData),
      timestamp: new Date().toISOString()
    };
  }

  private fuseIntelligence(moltData: any, openclawData: any) {
    return {
      economic_profile: {
        molt_transactions: moltData.transaction_analysis,
        openclaw_metrics: openclawData.transaction_analysis,
        combined_score: this.calculateEconomicScore(moltData, openclawData)
      },
      network_intelligence: {
        molt_relationships: moltData.relationship_network,
        openclaw_position: openclawData.relationship_network,
        unified_graph: this.buildUnifiedGraph(moltData, openclawData)
      },
      behavioral_analysis: {
        molt_patterns: moltData.behavioral_insights,
        openclaw_behavior: openclawData.behavioral_insights,
        predictive_model: this.buildPredictiveModel(moltData, openclawData)
      },
      transparency_metrics: {
        molt_score: moltData.transparency_score || 0,
        openclaw_score: openclawData.transparency_score || 0,
        overall_transparency: Math.max(
          moltData.transparency_score || 0,
          openclawData.transparency_score || 0
        )
      }
    };
  }

  private calculateCombinedConfidence(moltData: any, openclawData: any): number {
    const confidences = [];
    if (moltData) confidences.push(moltData.confidence_score);
    if (openclawData) confidences.push(openclawData.confidence_score);
    return confidences.length > 0 
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;
  }

  private calculateEconomicScore(moltData: any, openclawData: any): number {
    const moltScore = moltData.transaction_analysis?.totalTransactions || 0;
    const openclawScore = openclawData.transaction_analysis?.totalTransactions || 0;
    return Math.max(moltScore, openclawScore);
  }

  private buildUnifiedGraph(moltData: any, openclawData: any): any {
    return {
      nodes: [],
      edges: [],
      centrality_score: Math.max(
        moltData.relationship_network?.centrality || 0,
        openclawData.relationship_network?.centrality || 0
      )
    };
  }

  private buildPredictiveModel(moltData: any, openclawData: any): any {
    return {
      confidence: Math.max(
        moltData.predictive_analysis?.confidence || 0,
        openclawData.predictive_analysis?.confidence || 0
      ),
      predictions: [
        ...(moltData.predictive_analysis?.predictions || []),
        ...(openclawData.predictive_analysis?.predictions || [])
      ]
    };
  }
}
