// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ResolutionOracle
 * @notice On-chain resolution ledger for geospatial prediction markets.
 *         The Veralith backend runs the pipeline off-chain, builds an
 *         EvidenceBundle, pins it to IPFS, and signs (EIP-712) a compact
 *         Resolution digest. This contract verifies the signature, records
 *         the resolution, and allows a dispute window before finalization.
 *
 * @dev Single-signer V1. Roadmap V2: multi-sig via Safe + threshold signatures.
 */
contract ResolutionOracle is AccessControl, EIP712 {
    // ─── Roles ────────────────────────────────────────────────────────────

    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant DISPUTER_ROLE = keccak256("DISPUTER_ROLE");

    // ─── State machine ────────────────────────────────────────────────────

    enum State { NONE, PENDING, CONFIRMED_TRUE, CONFIRMED_FALSE, UNRESOLVABLE, DISPUTED }

    struct Resolution {
        State state;
        uint8 outcome;          // 0 = NO, 1 = YES, 2 = INDETERMINATE
        uint16 confidence;      // in basis points (0..10000), 7000 = 70%
        bytes32 evidenceHash;   // sha256 of canonical bundle
        string ipfsCid;
        address resolver;
        uint64 submittedAt;
        uint64 finalizedAt;
    }

    // ─── Storage ──────────────────────────────────────────────────────────

    uint16 public constant MIN_CONFIDENCE_BP = 7000; // 70%
    uint64 public disputeWindow = 24 hours;

    mapping(bytes32 => Resolution) private _resolutions;      // marketId => Resolution

    // ─── EIP-712 typed data ───────────────────────────────────────────────

    bytes32 private constant RESOLUTION_TYPEHASH = keccak256(
        "Resolution(bytes32 marketId,uint8 outcome,uint16 confidence,bytes32 evidenceHash,string ipfsCid,uint256 submittedAt)"
    );

    // ─── Events ───────────────────────────────────────────────────────────

    event ResolutionSubmitted(
        bytes32 indexed marketId,
        uint8 outcome,
        uint16 confidence,
        bytes32 evidenceHash,
        string ipfsCid,
        address resolver
    );
    event ResolutionDisputed(bytes32 indexed marketId, address disputer, string reason);
    event ResolutionFinalized(bytes32 indexed marketId, State finalState);
    event DisputeWindowUpdated(uint64 oldValue, uint64 newValue);

    // ─── Errors ───────────────────────────────────────────────────────────

    error NotResolver();
    error AlreadyResolved(bytes32 marketId);
    error NotPending(bytes32 marketId, State currentState);
    error DisputeWindowNotElapsed(uint64 readyAt);
    error ConfidenceBelowMinimum(uint16 got, uint16 min);
    error InvalidSignature();
    error InvalidOutcome(uint8 outcome);
    error UnknownMarket(bytes32 marketId);

    // ─── Constructor ──────────────────────────────────────────────────────

    constructor(address admin, address resolver) EIP712("Veralith ResolutionOracle", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RESOLVER_ROLE, resolver);
    }

    // ─── Submit ───────────────────────────────────────────────────────────

    /**
     * @notice Submit a resolution. Caller must hold RESOLVER_ROLE OR be a valid EIP-712 signer.
     *         The EIP-712 path lets a meta-submitter relay signed resolutions without gas for the resolver.
     */
    function submitResolution(
        bytes32 marketId,
        uint8 outcome,
        uint16 confidence,
        bytes32 evidenceHash,
        string calldata ipfsCid,
        uint256 submittedAt,
        bytes calldata signature
    ) external {
        if (outcome > 2) revert InvalidOutcome(outcome);
        if (confidence < MIN_CONFIDENCE_BP) revert ConfidenceBelowMinimum(confidence, MIN_CONFIDENCE_BP);

        Resolution storage r = _resolutions[marketId];
        if (r.state != State.NONE) revert AlreadyResolved(marketId);

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                RESOLUTION_TYPEHASH,
                marketId,
                outcome,
                confidence,
                evidenceHash,
                keccak256(bytes(ipfsCid)),
                submittedAt
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (!hasRole(RESOLVER_ROLE, signer)) revert InvalidSignature();

        State state;
        if (outcome == 2) {
            state = State.UNRESOLVABLE;
        } else {
            state = State.PENDING;
        }

        _resolutions[marketId] = Resolution({
            state: state,
            outcome: outcome,
            confidence: confidence,
            evidenceHash: evidenceHash,
            ipfsCid: ipfsCid,
            resolver: signer,
            submittedAt: uint64(block.timestamp),
            finalizedAt: 0
        });

        emit ResolutionSubmitted(marketId, outcome, confidence, evidenceHash, ipfsCid, signer);

        if (state == State.UNRESOLVABLE) {
            // No dispute window for unresolvable — finalize immediately
            _resolutions[marketId].finalizedAt = uint64(block.timestamp);
            emit ResolutionFinalized(marketId, State.UNRESOLVABLE);
        }
    }

    // ─── Dispute ──────────────────────────────────────────────────────────

    function dispute(bytes32 marketId, string calldata reason) external onlyRole(DISPUTER_ROLE) {
        Resolution storage r = _resolutions[marketId];
        if (r.state != State.PENDING) revert NotPending(marketId, r.state);
        r.state = State.DISPUTED;
        emit ResolutionDisputed(marketId, msg.sender, reason);
    }

    // ─── Finalize ─────────────────────────────────────────────────────────

    function finalize(bytes32 marketId) external {
        Resolution storage r = _resolutions[marketId];
        if (r.state != State.PENDING) revert NotPending(marketId, r.state);
        uint64 readyAt = r.submittedAt + disputeWindow;
        if (block.timestamp < readyAt) revert DisputeWindowNotElapsed(readyAt);

        State finalState = r.outcome == 1 ? State.CONFIRMED_TRUE : State.CONFIRMED_FALSE;
        r.state = finalState;
        r.finalizedAt = uint64(block.timestamp);
        emit ResolutionFinalized(marketId, finalState);
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    function setDisputeWindow(uint64 newWindow) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint64 old = disputeWindow;
        disputeWindow = newWindow;
        emit DisputeWindowUpdated(old, newWindow);
    }

    // ─── Views ────────────────────────────────────────────────────────────

    function getResolution(bytes32 marketId) external view returns (Resolution memory) {
        Resolution memory r = _resolutions[marketId];
        if (r.state == State.NONE) revert UnknownMarket(marketId);
        return r;
    }

    function isFinal(bytes32 marketId) external view returns (bool) {
        State s = _resolutions[marketId].state;
        return s == State.CONFIRMED_TRUE
            || s == State.CONFIRMED_FALSE
            || s == State.UNRESOLVABLE;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
