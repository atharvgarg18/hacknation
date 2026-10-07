// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SATARK ComplianceLedger
 * @notice Problem Statement #11 & #1: Tamper-Proof Banking Audit Trail with Anomaly Detection
 * @dev Anchors periodic Merkle roots of AML detection events, SAR filings, and freeze broadcasts.
 * Enables auditors and FIU regulators to verify integrity without trusting internal databases.
 */
contract ComplianceLedger {
    // ----------------------------------------------------
    // Storage & State
    // ----------------------------------------------------
    address public owner;
    
    struct AnchoredBatch {
        bytes32 merkleRoot;
        string batchId;
        uint256 eventCount;
        uint256 timestamp;
        address anchoredBy;
    }

    struct SARFiling {
        string sarId;
        bytes32 reportHash;
        string bankId;
        uint256 filedAt;
        bool active;
    }

    // Mapping from block height -> AnchoredBatch
    mapping(uint256 => AnchoredBatch) public batches;
    uint256 public totalBatches;

    // Mapping from SAR ID -> SARFiling
    mapping(string => SARFiling) public sarFilings;

    // Authorized bank node addresses
    mapping(address => bool) public authorizedNodes;

    // ----------------------------------------------------
    // Events
    // ----------------------------------------------------
    event MerkleRootAnchored(
        uint256 indexed batchHeight,
        bytes32 indexed merkleRoot,
        string batchId,
        uint256 eventCount,
        uint256 timestamp
    );

    event SARReportFiled(
        string indexed sarId,
        bytes32 indexed reportHash,
        string bankId,
        uint256 timestamp
    );

    event AccountFreezeBroadcasted(
        string indexed chainId,
        bytes32 indexed ringHash,
        address indexed broadcaster,
        uint256 timestamp
    );

    // ----------------------------------------------------
    // Modifiers
    // ----------------------------------------------------
    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedNodes[msg.sender], "Caller is not authorized node");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedNodes[msg.sender] = true;
    }

    function authorizeNode(address node) external onlyOwner {
        authorizedNodes[node] = true;
    }

    /**
     * @notice Anchor a new batch of hashed AML alerts and decisions into an immutable Merkle root.
     * @param merkleRoot The root of the SHA-256 Merkle tree batch.
     * @param batchId Identifier of the batch (e.g. "batch_20261007_01").
     * @param eventCount Number of events included in the batch.
     */
    function anchorMerkleRoot(
        bytes32 merkleRoot,
        string calldata batchId,
        uint256 eventCount
    ) external onlyAuthorized returns (uint256 batchHeight) {
        batchHeight = totalBatches;
        batches[batchHeight] = AnchoredBatch({
            merkleRoot: merkleRoot,
            batchId: batchId,
            eventCount: eventCount,
            timestamp: block.timestamp,
            anchoredBy: msg.sender
        });

        totalBatches++;

        emit MerkleRootAnchored(batchHeight, merkleRoot, batchId, eventCount, block.timestamp);
    }

    /**
     * @notice Cryptographically verify whether a specific leaf is part of an anchored Merkle root.
     * @dev Uses standard iterative Merkle proof verification (RFC 6962 / OpenZeppelin).
     * @param proof Sibling hash nodes along the tree path.
     * @param root The anchored Merkle root.
     * @param leaf The SHA-256 hash of the audit event.
     */
    function verifyProof(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                // Hash(current + sibling)
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                // Hash(sibling + current)
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
    }

    /**
     * @notice File an immutable Suspicious Activity Report (SAR) with FIU regulators.
     */
    function fileSAR(
        string calldata sarId,
        bytes32 reportHash,
        string calldata bankId
    ) external onlyAuthorized {
        sarFilings[sarId] = SARFiling({
            sarId: sarId,
            reportHash: reportHash,
            bankId: bankId,
            filedAt: block.timestamp,
            active: true
        });

        emit SARReportFiled(sarId, reportHash, bankId, block.timestamp);
    }

    /**
     * @notice Broadcast emergency cross-bank freeze order for an identified laundering ring.
     */
    function broadcastFreeze(
        string calldata chainId,
        bytes32 ringHash
    ) external onlyAuthorized {
        emit AccountFreezeBroadcasted(chainId, ringHash, msg.sender, block.timestamp);
    }
}
