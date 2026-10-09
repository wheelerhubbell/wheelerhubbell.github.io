// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StandingVerifier
 * @author Wheeler Hubbell Publishing
 * @notice Immutable onchain epistemic standing verifier for Autonomous Agent (A2A) networks on Base and EVM chains.
 *
 * CRYPTOGRAPHIC SPECIFICATION & RESOLUTION:
 * Canonical WHP Standing Marks are produced under RFC 8785 (JSON Canonicalization Scheme)
 * and signed with Ed25519 by the WHP Sovereign Authority key.
 * Because EVM native precompiles execute secp256k1 ECDSA (ecrecover), this contract implements
 * the official dual-attestation commitment bridge:
 *
 * 1. The immutable Ed25519 Standing Mark yields a canonical SHA-256 / Keccak-256 digest: markHash.
 * 2. An EIP-712 Onchain Standing Commitment binds markHash to the purchase coordinate, profile,
 *    scope, validity window, determination outcome, and anti-replay nonce.
 * 3. The WHP Authoritative EVM Signer co-attests this commitment.
 * 4. This contract verifies the signature, enforces temporal validity, verifies determination
 *    legitimacy (enforcing the core invariant: A(c) <= P(c)), and provides both gasless verification
 *    and onchain registry attestation.
 */
contract StandingVerifier {
    // EIP-712 Typehashes
    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public constant STANDING_COMMITMENT_TYPEHASH = keccak256(
        "StandingCommitment(bytes32 markHash,bytes32 purchaseId,bytes32 profileHash,bytes32 scopeHash,uint64 validFrom,uint64 validUntil,uint8 determinationCode,uint256 nonce)"
    );

    // Official authoritative signer address for Wheeler Hubbell Publishing
    address public immutable authorizedSigner;

    // Track consumed nonces to prevent replay attacks on sensitive actions
    mapping(address => mapping(uint256 => bool)) public consumedNonces;

    // Optional onchain registry for smart contracts that need persistent standing lookups
    mapping(bytes32 => bool) public registeredMarks;

    // Events for onchain audit trails
    event StandingMarkVerified(
        bytes32 indexed markHash,
        bytes32 indexed purchaseId,
        uint8 determinationCode,
        address indexed verifierCaller
    );

    event StandingMarkRegistered(
        bytes32 indexed markHash,
        bytes32 indexed purchaseId,
        uint64 validUntil
    );

    struct StandingCommitment {
        bytes32 markHash;        // Hash of canonical Ed25519 WHP Standing Mark
        bytes32 purchaseId;      // Permanent purchase identifier
        bytes32 profileHash;     // Standing Profile Hash
        bytes32 scopeHash;       // Scope identifier hash
        uint64 validFrom;        // Start of validity window (unix seconds)
        uint64 validUntil;       // Expiration timestamp (unix seconds)
        uint8 determinationCode; // 1: ESTABLISHED / RECOGNIZED, 0: NOT_ESTABLISHED
        uint256 nonce;           // Anti-replay nonce
    }

    constructor(address _authorizedSigner) {
        require(_authorizedSigner != address(0), "INVALID_SIGNER");
        authorizedSigner = _authorizedSigner;
    }

    /**
     * @notice Computes the EIP-712 domain separator for the current chain.
     */
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("WHP Standing Authority")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Hashes a standing commitment struct according to EIP-712.
     */
    function hashCommitment(StandingCommitment calldata c) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                STANDING_COMMITMENT_TYPEHASH,
                c.markHash,
                c.purchaseId,
                c.profileHash,
                c.scopeHash,
                c.validFrom,
                c.validUntil,
                c.determinationCode,
                c.nonce
            )
        );
    }

    /**
     * @notice Verifies an attestation and consumes the nonce to protect an action boundary.
     * Reverts if expired, invalid, unestablished, or replayed.
     */
    function verifyAndConsume(
        StandingCommitment calldata commitment,
        bytes calldata signature
    ) external returns (bool) {
        require(block.timestamp >= commitment.validFrom, "MARK_NOT_YET_VALID");
        require(block.timestamp <= commitment.validUntil, "MARK_EXPIRED");
        require(commitment.determinationCode == 1, "INVARIANT_VIOLATION_UNESTABLISHED"); // A(c) <= P(c)
        require(!consumedNonces[msg.sender][commitment.nonce], "NONCE_ALREADY_CONSUMED");

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), hashCommitment(commitment))
        );

        address recovered = recoverSigner(digest, signature);
        require(recovered == authorizedSigner, "INVALID_AUTHORITY_SIGNATURE");

        consumedNonces[msg.sender][commitment.nonce] = true;
        emit StandingMarkVerified(commitment.markHash, commitment.purchaseId, commitment.determinationCode, msg.sender);
        return true;
    }

    /**
     * @notice Pure verification check without state mutation (view only).
     */
    function verifyStandingView(
        StandingCommitment calldata commitment,
        bytes calldata signature
    ) external view returns (bool isValid, string memory reason) {
        if (block.timestamp < commitment.validFrom) return (false, "MARK_NOT_YET_VALID");
        if (block.timestamp > commitment.validUntil) return (false, "MARK_EXPIRED");
        if (commitment.determinationCode != 1) return (false, "DETERMINATION_NOT_ESTABLISHED");

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), hashCommitment(commitment))
        );

        if (recoverSigner(digest, signature) != authorizedSigner) {
            return (false, "INVALID_AUTHORITY_SIGNATURE");
        }
        return (true, "VERIFIED_ACTIVE");
    }

    /**
     * @notice Registers a verified mark in contract storage for low-cost downstream contract queries.
     */
    function registerMark(
        StandingCommitment calldata commitment,
        bytes calldata signature
    ) external returns (bool) {
        require(block.timestamp >= commitment.validFrom && block.timestamp <= commitment.validUntil, "INVALID_WINDOW");
        require(commitment.determinationCode == 1, "UNESTABLISHED");

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), hashCommitment(commitment))
        );
        require(recoverSigner(digest, signature) == authorizedSigner, "INVALID_SIGNATURE");

        registeredMarks[commitment.markHash] = true;
        emit StandingMarkRegistered(commitment.markHash, commitment.purchaseId, commitment.validUntil);
        return true;
    }

    /**
     * @notice Quick lookup for consuming contracts to check if a mark hash is registered.
     */
    function isMarkRegistered(bytes32 markHash) external view returns (bool) {
        return registeredMarks[markHash];
    }

    function recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }
}
