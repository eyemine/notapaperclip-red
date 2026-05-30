/**
 * ERC-8048: Agent NFT Identity Bindings
 * Decodes and verifies agent-binding metadata entries on ERC-8004 agent cards.
 *
 * Byte format (per draft spec):
 *   [bindingContract 20B][tokenStandard 1B][tokenContract 20B][tokenIdLen 1B][tokenId NB]
 *
 * Token standard enum: 1 = ERC-721, 2 = ERC-1155, 3 = ERC-6909
 *
 * Verification: call bindingOf(uint256 agentId) on bindingContract,
 * decode returned bytes, compare against metadata binding.
 */

import { keccak256, toBytes, toHex } from 'viem';
import { rpcClient } from './rpc';

export type TokenStandard = 'ERC-721' | 'ERC-1155' | 'ERC-6909';

export interface Erc8048Binding {
  bindingContract: string;
  tokenStandard: TokenStandard;
  tokenContract: string;
  tokenId: string;
  verified: boolean;
}

const TOKEN_STANDARD: Record<number, TokenStandard> = {
  1: 'ERC-721',
  2: 'ERC-1155',
  3: 'ERC-6909',
};

/**
 * Decode agent-binding hex bytes into structured binding data.
 * Accepts raw hex (with or without 0x prefix) or a base64 string.
 */
export function decodeBinding(raw: string): Omit<Erc8048Binding, 'verified'> | null {
  try {
    let hex = raw.trim();
    // If it looks like base64 rather than hex, decode it first
    if (!hex.startsWith('0x') && /^[A-Za-z0-9+/=]+$/.test(hex) && hex.length % 4 === 0) {
      hex = Buffer.from(hex, 'base64').toString('hex');
    }
    const bytes = hex.startsWith('0x') ? hex.slice(2) : hex;

    // Minimum: 20 (bindingContract) + 1 (std) + 20 (tokenContract) + 1 (len) + 1 (tokenId) = 43 bytes = 86 hex chars
    if (bytes.length < 86) return null;

    let o = 0;
    const bindingContract = '0x' + bytes.slice(o, o + 40); o += 40;
    const stdByte = parseInt(bytes.slice(o, o + 2), 16); o += 2;
    const tokenContract = '0x' + bytes.slice(o, o + 40); o += 40;
    const tokenIdLen = parseInt(bytes.slice(o, o + 2), 16); o += 2;
    const tokenIdHex = bytes.slice(o, o + tokenIdLen * 2);

    const tokenStandard = TOKEN_STANDARD[stdByte];
    if (!tokenStandard) return null;
    if (tokenIdHex.length < tokenIdLen * 2) return null;

    const tokenId = BigInt('0x' + (tokenIdHex || '0')).toString();
    return { bindingContract, tokenStandard, tokenContract, tokenId };
  } catch {
    return null;
  }
}

/**
 * ABI-encode a uint256 call: selector + padded agentId
 */
function encodeUint256Call(selector: string, value: number): string {
  const padded = value.toString(16).padStart(64, '0');
  return `${selector}${padded}`;
}

/**
 * Decode ABI-encoded bytes return: [32B offset][32B length][NB content]
 */
function decodeAbiBytes(result: string): string | null {
  const hex = result.startsWith('0x') ? result.slice(2) : result;
  if (hex.length < 128) return null;
  const length = parseInt(hex.slice(64, 128), 16);
  if (length === 0) return null;
  return hex.slice(128, 128 + length * 2);
}

/**
 * Verify binding on-chain by calling bindingOf(agentId) on bindingContract.
 * Returns true if the returned on-chain binding matches the decoded metadata binding.
 * Non-fatal: returns false on any RPC error.
 */
export async function verifyBinding(
  chainKey: string,
  agentId: number,
  binding: Omit<Erc8048Binding, 'verified'>
): Promise<boolean> {
  try {
    const selector = keccak256(toBytes('bindingOf(uint256)')).slice(0, 10); // 0x + 8 hex chars
    const callData = encodeUint256Call(selector, agentId);

    const result = await rpcClient.call(
      chainKey,
      binding.bindingContract,
      callData,
      { timeout: 5000, retries: 1, useCache: false }
    );

    if (!result || result === '0x') return false;

    const returnedHex = decodeAbiBytes(result);
    if (!returnedHex) return false;

    const onChain = decodeBinding(returnedHex);
    if (!onChain) return false;

    return (
      onChain.bindingContract.toLowerCase() === binding.bindingContract.toLowerCase() &&
      onChain.tokenContract.toLowerCase() === binding.tokenContract.toLowerCase() &&
      onChain.tokenId === binding.tokenId &&
      onChain.tokenStandard === binding.tokenStandard
    );
  } catch {
    return false;
  }
}

/**
 * Full decode + verify pipeline.
 * Pass the raw `agent-binding` value from ERC-8004 metadata.
 * Returns null if value is absent or malformed.
 */
export async function resolveBinding(
  chainKey: string,
  agentId: number,
  rawBinding: string | undefined
): Promise<Erc8048Binding | null> {
  if (!rawBinding) return null;
  const decoded = decodeBinding(rawBinding);
  if (!decoded) return null;
  const verified = await verifyBinding(chainKey, agentId, decoded);
  return { ...decoded, verified };
}
