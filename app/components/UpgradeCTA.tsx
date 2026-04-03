'use client';

import { motion } from 'framer-motion';

interface UpgradeCTAProps {
  walletAddress: string;
  basemailId?: string;
  attnsBalance?: string;
  compact?: boolean;
}

export default function UpgradeCTA({ 
  walletAddress, 
  basemailId, 
  attnsBalance = '0',
  compact = false 
}: UpgradeCTAProps) {
  const hasAttns = parseFloat(attnsBalance) > 0;
  
  const upgradeUrl = `https://nftmail.box/upgrade?source=basemail&from=${walletAddress}&basemailId=${encodeURIComponent(basemailId || '')}`;

  if (compact) {
    return (
      <motion.a
        href={upgradeUrl}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Upgrade to NFTmail
      </motion.a>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-800 p-6 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Upgrade to NFTmail
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Zero lock-in • Zero cost • Enhanced privacy
          </p>
        </div>
      </div>

      {/* Benefits */}
      <div className="space-y-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mt-0.5">
            <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">NFT-bound identity</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">Your inbox is bound to an ERC-721 NFT you truly own</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mt-0.5">
            <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">ECIES encryption</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">True end-to-end encryption, no plaintext at rest</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mt-0.5">
            <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">HITL modules</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">Human-in-the-loop for high-value Safe transactions</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mt-0.5">
            <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Gnosis Safe treasury</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">Non-custodial Safe with DailyBudget spending</p>
          </div>
        </div>
      </div>

      {/* Migration Info */}
      {hasAttns && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-semibold">Attention preserved:</span> Your {parseFloat(attnsBalance).toLocaleString()} $ATTN balance 
            carries over as reputation score. Optional $ATTN → $HOST staking available post-migration.
          </p>
        </div>
      )}

      {/* CTA Button */}
      <motion.a
        href={upgradeUrl}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-xl text-center hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
      >
        <div className="flex items-center justify-center gap-2">
          <span>Start Migration</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </motion.a>

      {/* Footer */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
        Your BaseMail inbox history migrates automatically. 
        <a href="https://nftmail.box/docs/migration" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">
          Learn more
        </a>
      </p>
    </motion.div>
  );
}
