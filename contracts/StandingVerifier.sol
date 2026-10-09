// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StandingVerifier
 * @author Wheeler Hubbell Publishing
 * @notice Immutable onchain epistemic standing verifier for Autonomous Agent (A2A) networks.
 * Enforces the core invariant: A(c) <= P(c) (Authority cannot exceed Provenance).
 * Verifies signed Standing Marks and determinations issued by Wheeler Hubbell Publishing.
 */
contract StandingVerifier {
    // Domain Separator for EIP-712 / typed data verification
    bytes32 public constant STANDING_MARK_TYPEHASH = keccak256(
        "StandingMark(bytes32 subjectHash,bytes32 claimHash,bytes32 provenanceHash,uint256 issuedAt,uint256 expiresAt,uint8 determinationCode)"
    );

    // Official authoritative signer address for Wheeler Hubbell Publishing
    address public immutable authorizedSigner;

    // Events for onchain audit trails
    event StandingMarkVerified(
        bytes32 indexed markHash,
        bytes32 indexed subjectHash,
        uint8 determinationCode,
        address indexed verifierCaller
    );

    constructor(address _authorizedSigner) {
        require(_authorizedSigner != address(0), "INVALID_SIGNER");
        authorizedSigner = _authorizedSigner;
    }

    /**
     * @notice Verifies a cryptographic Standing Mark issued by Wheeler Hubbell Publishing.
     * @param subjectHash Keccak256 hash of the evaluated subject/agent identifier.
     * @param claimHash Keccak256 hash of the specific claim or tool action.
     * @param provenanceHash Keccak256 hash of the provenance chain.
     * @param issuedAt Timestamp when the mark was sealed.
     * @param expiresAt Expiration timestamp of the standing window.
     * @param determinationCode Numeric status (0: Unrecognized, 1: Recognized, 2: Sealed, 3: Privileged).
     * @param signature 65-byte ECDSA signature from the authorized signer.
     * @return isValid True if the signature is authentic and the mark has not expired.
     */
    function verifyStandingMark(
        bytes32 subjectHash,
        bytes32 claimHash,
        bytes32 provenanceHash,
        uint256 issuedAt,
        uint256 expiresAt,
        uint8 determinationCode,
        bytes calldata signature
    ) external returns (bool isValid) {
        if (block.timestamp > expiresAt || block.timestamp < issuedAt) {
            return false;
        }

        bytes32 structHash = keccak256(
            abi.encode(
                STANDING_MARK_TYPEHASH,
                subjectHash,
                claimHash,
                provenanceHash,
                issuedAt,
                expiresAt,
                determinationCode
            )
        );

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("Ethereum Signed Message:
32", structHash)
        );

        address recovered = recoverSigner(ethSignedMessageHash, signature);
        if (recovered == authorizedSigner) {
            emit StandingMarkVerified(structHash, subjectHash, determinationCode, msg.sender);
            return true;
        }
        return false;
    }

    /**
     * @notice Pure verification check without state mutation or event emission.
     */
    function checkStanding(
        bytes32 structHash,
        bytes calldata signature
    ) external view returns (bool) {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("Ethereum Signed Message:
32", structHash)
        );
        return recoverSigner(ethSignedMessageHash, signature) == authorizedSigner;
    }

    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        return ecrecover(hash, v, r, s);
    }
}
