/**
 * Centralized chain configuration for ERC-8004 oracle
 * Single source of truth for all chain-related data
 */

export interface ChainConfig {
  key: string;
  label: string;
  chainId: number;
  registry: string;
  rpc: string[];
  explorer: string;
  explorerTx: string;
  color: string;
}

export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    key: 'ethereum',
    label: 'Ethereum',
    chainId: 1,
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    rpc: [
      'https://ethereum-rpc.publicnode.com',
      'https://rpc.ankr.com/eth',
      'https://1rpc.io/eth',
      'https://eth.llamarpc.com' // fallback, may be blocked
    ],
    explorer: 'https://etherscan.io',
    explorerTx: 'https://etherscan.io/tx/',
    color: '#627eea'
  },
  gnosis: {
    key: 'gnosis',
    label: 'Gnosis',
    chainId: 100,
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    rpc: [
      'https://rpc.gnosischain.com',
      'https://gnosis.publicnode.com',
      'https://1rpc.io/gnosis'
    ],
    explorer: 'https://gnosisscan.io',
    explorerTx: 'https://gnosisscan.io/tx/',
    color: '#1a7a4a'
  },
  base: {
    key: 'base',
    label: 'Base',
    chainId: 8453,
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    rpc: [
      'https://mainnet.base.org',
      'https://base.publicnode.com',
      'https://1rpc.io/base'
    ],
    explorer: 'https://basescan.org',
    explorerTx: 'https://basescan.org/tx/',
    color: '#0052ff'
  },
  baseSepolia: {
    key: 'baseSepolia',
    label: 'Base Sepolia',
    chainId: 84532,
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    rpc: [
      'https://sepolia.base.org',
      'https://base-sepolia.publicnode.com',
      'https://1rpc.io/base-sepolia'
    ],
    explorer: 'https://sepolia.basescan.org',
    explorerTx: 'https://sepolia.basescan.org/tx/',
    color: '#6b8cff'
  }
};

// Ordered arrays for UI components
export const CHAIN_ORDER = ['base', 'baseSepolia', 'ethereum', 'gnosis'];
export const CHAIN_ORDER_WITH_ALL = ['all', 'base', 'baseSepolia', 'ethereum', 'gnosis'];

// Helper functions
export function getChainByKey(key: string): ChainConfig | null {
  return CHAINS[key] || null;
}

export function getChainById(chainId: number): ChainConfig | null {
  return Object.values(CHAINS).find(chain => chain.chainId === chainId) || null;
}

export function getChainColor(chainKey: string): string {
  return CHAINS[chainKey]?.color || '#666';
}

export function getExplorerUrl(chainKey: string, type: 'address' | 'tx', value: string): string {
  const chain = CHAINS[chainKey];
  if (!chain) return '';
  
  const baseUrl = type === 'tx' ? chain.explorerTx : chain.explorer;
  return `${baseUrl}/${value}`;
}
