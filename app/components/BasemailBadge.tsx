'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface BasemailBadgeProps {
  walletAddress: string;
  showUpgradeCTA?: boolean;
}

interface BasemailVerification {
  isVerified: boolean;
  basemailId?: string;
  attnsBalance: string;
  attnsFormatted: string;
  lensHandle?: string;
  lensFollowers: number;
  lensFollowing: number;
  lastActive: string;
  erc8004Status: 'verified' | 'pending' | 'none';
  upgradeRecommended: boolean;
}

export default function BasemailBadge({ walletAddress, showUpgradeCTA = true }: BasemailBadgeProps) {
  const [verification, setVerification] = useState<BasemailVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    
    const fetchVerification = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/verify-basemail?address=${walletAddress}`);
        if (!res.ok) throw new Error('Failed to verify');
        const data = await res.json();
        setVerification(data);
      } catch (e: any) {
        setError(e?.message || 'Verification failed');
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [walletAddress]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Verifying BaseMail...</span>
      </div>
    );
  }

  if (error || !verification?.isVerified) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-sm">Not a BaseMail agent</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-4 text-white"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold">BaseMail Verified</span>
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-xs text-blue-200">
            ERC-8004 Compatible • Attention Economy Agent
          </p>
        </div>
      </div>

      {/* $ATTN Token Balance */}
      <div className="bg-black/20 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-200">$ATTN Balance</span>
          <span className="font-mono font-bold text-lg">
            {verification.attnsFormatted}
          </span>
        </div>
        <div className="mt-1 h-2 bg-black/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(parseFloat(verification.attnsBalance) / 10000 * 100, 100)}%` }}
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
            transition={{ duration: 1 }}
          />
        </div>
        <p className="text-xs text-blue-300 mt-1">
          Attention Score: {parseFloat(verification.attnsBalance) > 1000 ? 'High' : parseFloat(verification.attnsBalance) > 100 ? 'Medium' : 'Low'}
        </p>
      </div>

      {/* Lens Social Graph */}
      {verification.lensHandle && (
        <div className="bg-black/20 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span className="text-sm font-medium text-green-400">Lens Protocol</span>
          </div>
          <div className="text-sm font-bold mb-2">{verification.lensHandle}</div>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-blue-300">Followers:</span>
              <span className="ml-1 font-mono">{verification.lensFollowers.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-blue-300">Following:</span>
              <span className="ml-1 font-mono">{verification.lensFollowing.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ERC-8004 Status */}
      <div className="flex items-center gap-2 text-xs mb-3">
        <div className={`w-2 h-2 rounded-full ${
          verification.erc8004Status === 'verified' ? 'bg-green-400' : 
          verification.erc8004Status === 'pending' ? 'bg-yellow-400' : 'bg-gray-400'
        }`} />
        <span className="text-blue-200">
          ERC-8004: {verification.erc8004Status === 'verified' ? 'On-chain verified' : verification.erc8004Status}
        </span>
      </div>

      {/* Last Active */}
      <p className="text-xs text-blue-300 mb-3">
        Last active: {new Date(verification.lastActive).toLocaleDateString()}
      </p>

      {/* Upgrade CTA */}
      {showUpgradeCTA && verification.upgradeRecommended && (
        <motion.a
          href="https://nftmail.box/upgrade?source=basemail"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="block w-full bg-white text-blue-700 font-semibold py-2 px-4 rounded-lg text-center hover:bg-blue-50 transition-colors"
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Upgrade to NFTmail
          </div>
          <span className="block text-xs font-normal text-blue-600 mt-1">
            NFT-bound identity + HITL modules + ECIES encryption
          </span>
        </motion.a>
      )}
    </motion.div>
  );
}
