// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SATARK ComplianceLedger
 * @notice Problem Statement #11 & #1: Tamper-Proof Banking Audit Trail with Anomaly Detection
 * @dev Anchors periodic Merkle roots of AML detection events, SAR filings, and freeze broadcasts.
 * Enables auditors and FIU regulators to verify integrity without trusting internal databases.
 */
contract ComplianceLedger {
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

    mapping(uint256 => AnchoredBatch) public batches;
    uint256 public totalBatches;
    mapping(string => SARFiling) public sarFilings;
    mapping(address => bool) public authorizedNodes;

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

    function verifyProof(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
    }

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

    function broadcastFreeze(
        string calldata chainId,
        bytes32 ringHash
    ) external onlyAuthorized {
        emit AccountFreezeBroadcasted(chainId, ringHash, msg.sender, block.timestamp);
    }
}
