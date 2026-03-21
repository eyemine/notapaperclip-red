export interface Member {
  address:   string;
  agentName: string;
  joinedAt:  number;
}

export interface Attestation {
  proofHash:  string;
  taskId:     string;
  agentName:  string;
  notaRef?:   string;
  notaUrl?:   string;
  verified:   boolean;
  timestamp:  number;
}

export interface VerifyResult {
  swarmId:       string;
  verified:      boolean;
  fullyVerified: boolean;
  badge:         string;
  criteria: {
    hasMinMembers:     boolean;
    hasVerifiedProof:  boolean;
    allMembersHaveRep: boolean;
  };
  memberCount:    number;
  members:        Member[];
  attestations:   Attestation[];
  verifiedProofs: number;
  reputation:     Record<string, Array<{ taskScore: number; paperclipScore?: number; timestamp: number }>>;
  checkedAt:      number;
}
