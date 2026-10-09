// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WHP Standing Beacon (Autonomous Agent Summoning Beacon)
 * @notice Onchain event beacon and bounty layer to actively summon and wake autonomous machines.
 * Instead of waiting for agents, the beacon emits indexed summons that offchain listeners,
 * solvers, and agent runtimes monitor to wake up and resolve epistemic challenges.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract StandingBeacon {
    struct ChallengeSummon {
        address summoner;
        address targetAgent;
        address bountyToken;
        uint256 bountyAmount;
        bytes32 challengeHash;
        uint256 deadline;
        bool resolved;
        bool reclaimed;
    }

    address public immutable whpAuthorizedVerifier;
    uint256 public pulseCount;

    mapping(bytes32 => ChallengeSummon) public summons;

    event AgentSummoned(
        bytes32 indexed summonId,
        address indexed summoner,
        address indexed targetAgent,
        bytes32 challengeHash,
        uint256 deadline,
        address bountyToken,
        uint256 bountyAmount
    );

    event SummonResolved(
        bytes32 indexed summonId,
        address indexed resolver,
        bytes32 indexed recordHash,
        uint256 bountyAmount
    );

    event SummonReclaimed(bytes32 indexed summonId);

    event BeaconPulse(
        uint256 indexed pulseNumber,
        bytes32 indexed epochRoot,
        string metadataUri
    );

    constructor(address _whpAuthorizedVerifier) {
        whpAuthorizedVerifier = _whpAuthorizedVerifier;
    }

    /**
     * @notice Issue a wake-up summon to an autonomous agent or solver swarm.
     */
    function emitSummon(
        bytes32 summonId,
        address targetAgent,
        bytes32 challengeHash,
        uint256 durationSeconds,
        address bountyToken,
        uint256 bountyAmount
    ) external payable {
        require(summons[summonId].deadline == 0, "SUMMON_EXISTS");
        require(durationSeconds > 0, "INVALID_DURATION");

        if (bountyAmount > 0) {
            require(bountyToken != address(0), "TOKEN_REQUIRED");
            IERC20(bountyToken).transferFrom(msg.sender, address(this), bountyAmount);
        }

        summons[summonId] = ChallengeSummon({
            summoner: msg.sender,
            targetAgent: targetAgent,
            bountyToken: bountyToken,
            bountyAmount: bountyAmount,
            challengeHash: challengeHash,
            deadline: block.timestamp + durationSeconds,
            resolved: false,
            reclaimed: false
        });

        emit AgentSummoned(
            summonId,
            msg.sender,
            targetAgent,
            challengeHash,
            block.timestamp + durationSeconds,
            bountyToken,
            bountyAmount
        );
    }

    /**
     * @notice Fulfill a summon by presenting a signed standing attestation from Standing Witness.
     */
    function resolveSummon(
        bytes32 summonId,
        bytes32 recordHash,
        bytes calldata verifierSignature
    ) external {
        ChallengeSummon storage summon = summons[summonId];
        require(summon.deadline > 0, "SUMMON_NOT_FOUND");
        require(!summon.resolved && !summon.reclaimed, "ALREADY_CLOSED");
        require(block.timestamp <= summon.deadline, "SUMMON_EXPIRED");

        if (summon.targetAgent != address(0)) {
            require(msg.sender == summon.targetAgent, "NOT_TARGET_AGENT");
        }

        bytes32 messageHash = keccak256(abi.encodePacked(summonId, summon.challengeHash, recordHash));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("Ethereum Signed Message:
32", messageHash));

        address recovered = recoverSigner(ethSignedMessageHash, verifierSignature);
        require(recovered == whpAuthorizedVerifier, "INVALID_STANDING_PROOF");

        summon.resolved = true;

        if (summon.bountyAmount > 0) {
            IERC20(summon.bountyToken).transfer(msg.sender, summon.bountyAmount);
        }

        emit SummonResolved(summonId, msg.sender, recordHash, summon.bountyAmount);
    }

    /**
     * @notice Reclaim bounty if summoned agent fails to resolve before deadline.
     */
    function reclaimExpired(bytes32 summonId) external {
        ChallengeSummon storage summon = summons[summonId];
        require(summon.deadline > 0, "NOT_FOUND");
        require(!summon.resolved && !summon.reclaimed, "ALREADY_CLOSED");
        require(block.timestamp > summon.deadline, "NOT_EXPIRED");
        require(msg.sender == summon.summoner, "NOT_SUMMONER");

        summon.reclaimed = true;
        if (summon.bountyAmount > 0) {
            IERC20(summon.bountyToken).transfer(summon.summoner, summon.bountyAmount);
        }

        emit SummonReclaimed(summonId);
    }

    /**
     * @notice Broadcast a network-wide heartbeat pulse to wake all subscribed indexers and agents.
     */
    function broadcastPulse(bytes32 epochRoot, string calldata metadataUri) external {
        pulseCount++;
        emit BeaconPulse(pulseCount, epochRoot, metadataUri);
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
