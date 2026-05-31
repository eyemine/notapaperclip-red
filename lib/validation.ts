/**
 * Data validation schemas for oracle data sources
 * Ensures data integrity and prevents malformed responses
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

export function validateAgentMetadata(data: any): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Agent metadata must be an object');
    return { isValid: false, errors };
  }

  // Optional fields with type validation (relaxed to allow sparse metadata)
  if (data.name && typeof data.name !== 'string') {
    errors.push('Agent name must be a string');
  }

  if (data.description && typeof data.description !== 'string') {
    errors.push('Agent description must be a string');
  }

  if (data.image && typeof data.image !== 'string') {
    errors.push('Agent image must be a string URL');
  }

  if (data.skills && !Array.isArray(data.skills)) {
    errors.push('Agent skills must be an array');
  }

  if (data.services && !Array.isArray(data.services)) {
    errors.push('Agent services must be an array');
  }

  if (data.links && typeof data.links !== 'object') {
    errors.push('Agent links must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}

export function validateErc8004Card(data: any): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('ERC-8004 card data must be an object');
    return { isValid: false, errors };
  }

  // Required fields
  if (typeof data.agentId !== 'number') {
    errors.push('Agent ID is required and must be a number');
  }

  if (!data.chain || typeof data.chain !== 'string') {
    errors.push('Chain is required and must be a string');
  }

  if (!data.owner || typeof data.owner !== 'string') {
    errors.push('Owner address is required and must be a string');
  }

  // Validate address format
  if (data.owner && !/^0x[a-fA-F0-9]{40}$/.test(data.owner)) {
    errors.push('Owner address must be a valid Ethereum address');
  }

  // Optional fields
  if (data.name && typeof data.name !== 'string') {
    errors.push('Agent name must be a string');
  }

  if (data.description && typeof data.description !== 'string') {
    errors.push('Agent description must be a string');
  }

  if (data.image && typeof data.image !== 'string') {
    errors.push('Agent image must be a string URL');
  }

  if (data.pairedAgent && typeof data.pairedAgent !== 'object') {
    errors.push('Paired agent must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}

export function validateOnChainData(data: any): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('On-chain data must be an object');
    return { isValid: false, errors };
  }

  // Validate addresses
  if (data.safeAddress && !/^0x[a-fA-F0-9]{40}$/.test(data.safeAddress)) {
    errors.push('Safe address must be a valid Ethereum address');
  }

  if (data.tbaAddress && !/^0x[a-fA-F0-9]{40}$/.test(data.tbaAddress)) {
    errors.push('TBA address must be a valid Ethereum address');
  }

  // Validate balances
  if (data.balances && !Array.isArray(data.balances)) {
    errors.push('Balances must be an array');
  }

  if (data.transactions && typeof data.transactions !== 'number') {
    errors.push('Transaction count must be a number');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}

export function validateWorkerResponse(data: any): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Worker response must be an object');
    return { isValid: false, errors };
  }

  // Validate agent list response
  if (data.agents && !Array.isArray(data.agents)) {
    errors.push('Agents list must be an array');
  }

  if (data.agents) {
    data.agents.forEach((agent: any, index: number) => {
      if (!agent.name || typeof agent.name !== 'string') {
        errors.push(`Agent ${index}: name is required and must be a string`);
      }
      
      if (agent.erc8004 && typeof agent.erc8004 !== 'object') {
        errors.push(`Agent ${index}: erc8004 data must be an object`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}
