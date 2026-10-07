// Generated from the compiled contract. Run pnpm contracts:build.
export const registryAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "initialOwner",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "acceptOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getDocument",
    inputs: [
      {
        name: "issuer",
        type: "address",
        internalType: "address",
      },
      {
        name: "documentId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct DocumentRegistry.Document",
        components: [
          {
            name: "sha256Hash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "issuedAt",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "expiresAt",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "revoked",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "issue",
    inputs: [
      {
        name: "documentId",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "sha256Hash",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "expiresAt",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "issuerEnabled",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pendingOwner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revoke",
    inputs: [
      {
        name: "documentId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setIssuer",
    inputs: [
      {
        name: "issuer",
        type: "address",
        internalType: "address",
      },
      {
        name: "enabled",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      {
        name: "newOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "DocumentIssued",
    inputs: [
      {
        name: "issuer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "documentId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "sha256Hash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "issuedAt",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
      {
        name: "expiresAt",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "DocumentRevoked",
    inputs: [
      {
        name: "issuer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "documentId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "IssuerPermissionChanged",
    inputs: [
      {
        name: "issuer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "enabled",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferStarted",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadyIssued",
    inputs: [],
  },
  {
    type: "error",
    name: "AlreadyRevoked",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidDocument",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidExpiry",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidIssuer",
    inputs: [],
  },
  {
    type: "error",
    name: "IssuerNotEnabled",
    inputs: [],
  },
  {
    type: "error",
    name: "NotIssued",
    inputs: [],
  },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
  },
] as const;
