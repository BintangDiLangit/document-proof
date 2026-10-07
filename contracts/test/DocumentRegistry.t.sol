// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {DocumentRegistry} from "../src/DocumentRegistry.sol";

interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectRevert() external;
    function warp(uint256) external;
    function targetContract(address) external;
}

contract DocumentRegistryTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    DocumentRegistry private registry;
    address private constant ISSUER = address(0xB1);
    address private constant OTHER = address(0xB2);
    bytes32 private constant ID = keccak256("document-one");
    bytes32 private constant HASH = 0xbd89d3ac637d91a688d54bcc3b69871a266f59bde6590460540372ff0daf2cb4;

    function setUp() public {
        vm.warp(1_800_000_000);
        registry = new DocumentRegistry(address(this));
        registry.setIssuer(ISSUER, true);
    }

    function testIssueAndRead() public {
        vm.prank(ISSUER);
        registry.issue(ID, HASH, 0);
        DocumentRegistry.Document memory doc = registry.getDocument(ISSUER, ID);
        require(doc.sha256Hash == HASH && doc.issuedAt == block.timestamp && !doc.revoked);
    }

    function testRejectUnauthorizedAndAdminCannotImpersonateIssuer() public {
        vm.expectRevert(DocumentRegistry.IssuerNotEnabled.selector);
        registry.issue(ID, HASH, 0);
        vm.prank(OTHER);
        vm.expectRevert();
        registry.setIssuer(OTHER, true);
    }

    function testRejectOverwriteEvenAfterRevocation() public {
        vm.prank(ISSUER);
        registry.issue(ID, HASH, 0);
        vm.prank(ISSUER);
        registry.revoke(ID);
        vm.prank(ISSUER);
        vm.expectRevert(DocumentRegistry.AlreadyIssued.selector);
        registry.issue(ID, HASH, 0);
    }

    function testNamespacesDoNotCollide() public {
        registry.setIssuer(OTHER, true);
        vm.prank(OTHER);
        registry.issue(ID, bytes32(uint256(2)), 0);
        vm.prank(ISSUER);
        registry.issue(ID, HASH, 0);
        require(registry.getDocument(ISSUER, ID).sha256Hash == HASH);
    }

    function testDisabledIssuerCanRevokeButCannotIssue() public {
        vm.prank(ISSUER);
        registry.issue(ID, HASH, 0);
        registry.setIssuer(ISSUER, false);
        vm.prank(ISSUER);
        vm.expectRevert(DocumentRegistry.IssuerNotEnabled.selector);
        registry.issue(keccak256("new"), HASH, 0);
        vm.prank(ISSUER);
        registry.revoke(ID);
        require(registry.getDocument(ISSUER, ID).revoked);
        vm.prank(ISSUER);
        vm.expectRevert(DocumentRegistry.AlreadyRevoked.selector);
        registry.revoke(ID);
    }

    function testCannotRevokeAnotherIssuer() public {
        vm.prank(ISSUER);
        registry.issue(ID, HASH, 0);
        vm.prank(OTHER);
        vm.expectRevert(DocumentRegistry.NotIssued.selector);
        registry.revoke(ID);
        require(!registry.getDocument(ISSUER, ID).revoked);
    }

    function testRejectEmptyFieldsAndExpiryAtNow() public {
        vm.prank(ISSUER);
        vm.expectRevert(DocumentRegistry.InvalidDocument.selector);
        registry.issue(bytes32(0), HASH, 0);
        vm.prank(ISSUER);
        vm.expectRevert(DocumentRegistry.InvalidDocument.selector);
        registry.issue(ID, bytes32(0), 0);
        vm.prank(ISSUER);
        vm.expectRevert(DocumentRegistry.InvalidExpiry.selector);
        registry.issue(ID, HASH, uint64(block.timestamp));
    }

    function testTwoStepOwnership() public {
        registry.transferOwnership(OTHER);
        require(registry.owner() == address(this));
        vm.prank(OTHER);
        registry.acceptOwnership();
        require(registry.owner() == OTHER);
    }

    function testFuzzIssuedBytesNeverChange(bytes32 id, bytes32 hash, uint32 lifetime) public {
        if (id == 0 || hash == 0) return;
        uint64 expiry = lifetime == 0 ? 0 : uint64(block.timestamp + uint256(lifetime));
        vm.prank(ISSUER);
        registry.issue(id, hash, expiry);
        registry.setIssuer(ISSUER, false);
        vm.warp(block.timestamp + 1);
        vm.prank(ISSUER);
        registry.revoke(id);
        DocumentRegistry.Document memory doc = registry.getDocument(ISSUER, id);
        require(doc.sha256Hash == hash && doc.expiresAt == expiry && doc.revoked);
    }
}

contract RegistryHandler {
    DocumentRegistry public registry;
    bytes32 public constant ID = keccak256("invariant-doc");
    bytes32 public constant HASH = sha256("original bytes");
    constructor() {
        registry = new DocumentRegistry(address(this));
        registry.setIssuer(address(this), true);
        registry.issue(ID, HASH, 0);
    }
    function toggle(bool enabled) public { registry.setIssuer(address(this), enabled); }
    function revoke() public { try registry.revoke(ID) {} catch {} }
    function overwrite(bytes32 hash) public { try registry.issue(ID, hash, 0) {} catch {} }
}

contract RegistryInvariantTest {
    RegistryHandler private handler;
    function setUp() public { handler = new RegistryHandler(); }
    function targetContracts() public view returns (address[] memory result) {
        result = new address[](1);
        result[0] = address(handler);
    }
    function invariantOriginalHashIsImmutable() public view {
        DocumentRegistry.Document memory doc = handler.registry().getDocument(address(handler), handler.ID());
        require(doc.sha256Hash == handler.HASH() && doc.issuedAt != 0 && doc.expiresAt == 0);
    }
}
