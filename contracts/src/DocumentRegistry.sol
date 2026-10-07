// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Records exact-file integrity, not the truth of a document or an issuer's identity.
contract DocumentRegistry is Ownable2Step {
    struct Document {
        bytes32 sha256Hash;
        uint64 issuedAt;
        uint64 expiresAt;
        bool revoked;
    }

    mapping(address => bool) public issuerEnabled;
    mapping(address => mapping(bytes32 => Document)) private documents;

    error InvalidIssuer();
    error IssuerNotEnabled();
    error InvalidDocument();
    error AlreadyIssued();
    error InvalidExpiry();
    error NotIssued();
    error AlreadyRevoked();

    event IssuerPermissionChanged(address indexed issuer, bool enabled);
    event DocumentIssued(address indexed issuer, bytes32 indexed documentId, bytes32 sha256Hash, uint64 issuedAt, uint64 expiresAt);
    event DocumentRevoked(address indexed issuer, bytes32 indexed documentId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setIssuer(address issuer, bool enabled) external onlyOwner {
        if (issuer == address(0)) revert InvalidIssuer();
        issuerEnabled[issuer] = enabled;
        emit IssuerPermissionChanged(issuer, enabled);
    }

    function issue(bytes32 documentId, bytes32 sha256Hash, uint64 expiresAt) external {
        if (!issuerEnabled[msg.sender]) revert IssuerNotEnabled();
        if (documentId == bytes32(0) || sha256Hash == bytes32(0)) revert InvalidDocument();
        if (documents[msg.sender][documentId].issuedAt != 0) revert AlreadyIssued();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();
        uint64 issuedAt = uint64(block.timestamp);
        documents[msg.sender][documentId] = Document(sha256Hash, issuedAt, expiresAt, false);
        emit DocumentIssued(msg.sender, documentId, sha256Hash, issuedAt, expiresAt);
    }

    // A disabled issuer must still be able to revoke its own existing records.
    function revoke(bytes32 documentId) external {
        Document storage document = documents[msg.sender][documentId];
        if (document.issuedAt == 0) revert NotIssued();
        if (document.revoked) revert AlreadyRevoked();
        document.revoked = true;
        emit DocumentRevoked(msg.sender, documentId);
    }

    function getDocument(address issuer, bytes32 documentId) external view returns (Document memory) {
        return documents[issuer][documentId];
    }
}
