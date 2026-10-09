// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WHP Standing Escrow
 * @notice Programmatic A2A Escrow release condition using WHP Standing Mark / front-door signatures.
 * Invariant: A(c) <= P(c) (Authority cannot exceed provenance).
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract StandingEscrow {
    struct EscrowAgreement {
        address employer;
        address workerAgent;
        address token;
        uint256 amount;
        bytes32 taskHash;
        uint256 expiry;
        bool completed;
        bool refunded;
    }

    // Public key of WHP Front Door signer (Base Base64URL to Ed25519 or EVM-bridged verifier)
    address public immutable whpAuthorizedVerifier;
    mapping(bytes32 => EscrowAgreement) public escrows;

    event EscrowCreated(bytes32 indexed escrowId, address indexed employer, address indexed workerAgent, uint256 amount);
    event EscrowSettled(bytes32 indexed escrowId, bytes32 indexed recordHash, uint256 amount);
    event EscrowRefunded(bytes32 indexed escrowId);

    constructor(address _whpAuthorizedVerifier) {
        whpAuthorizedVerifier = _whpAuthorizedVerifier;
    }

    function createEscrow(
        bytes32 escrowId,
        address workerAgent,
        address token,
        uint256 amount,
        bytes32 taskHash,
        uint256 durationSeconds
    ) external {
        require(escrows[escrowId].amount == 0, "ESCROW_EXISTS");
        require(amount > 0, "INVALID_AMOUNT");

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        escrows[escrowId] = EscrowAgreement({
            employer: msg.sender,
            workerAgent: workerAgent,
            token: token,
            amount: amount,
            taskHash: taskHash,
            expiry: block.timestamp + durationSeconds,
            completed: false,
            refunded: false
        });

        emit EscrowCreated(escrowId, msg.sender, workerAgent, amount);
    }

    /**
     * @notice Releases escrowed funds to the worker agent upon presentation of an attested recordHash.
     * @param escrowId The identifier of the escrow agreement.
     * @param recordHash The SHA-256 hash of the signed WHP Standing Record.
     * @param verifierSignature Signature from whpAuthorizedVerifier confirming valid epistemic standing.
     */
    function releaseWithProofOfStanding(
        bytes32 escrowId,
        bytes32 recordHash,
        bytes calldata verifierSignature
    ) external {
        EscrowAgreement storage agreement = escrows[escrowId];
        require(agreement.amount > 0, "NOT_FOUND");
        require(!agreement.completed && !agreement.refunded, "ALREADY_RESOLVED");
        require(block.timestamp <= agreement.expiry, "EXPIRED");

        // Verify attestation
        bytes32 messageHash = keccak256(abi.encodePacked(escrowId, agreement.taskHash, recordHash));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        address recoveredSigner = recoverSigner(ethSignedMessageHash, verifierSignature);
        require(recoveredSigner == whpAuthorizedVerifier, "INVALID_STANDING_PROOF");

        agreement.completed = true;
        IERC20(agreement.token).transfer(agreement.workerAgent, agreement.amount);

        emit EscrowSettled(escrowId, recordHash, agreement.amount);
    }

    function refundExpired(bytes32 escrowId) external {
        EscrowAgreement storage agreement = escrows[escrowId];
        require(agreement.amount > 0, "NOT_FOUND");
        require(!agreement.completed && !agreement.refunded, "ALREADY_RESOLVED");
        require(block.timestamp > agreement.expiry, "NOT_EXPIRED");

        agreement.refunded = true;
        IERC20(agreement.token).transfer(agreement.employer, agreement.amount);

        emit EscrowRefunded(escrowId);
    }

    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "INVALID_SIG_LENGTH");
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
