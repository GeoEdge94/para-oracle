// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IParaOracle} from "./interfaces/IParaOracle.sol";

/// @title ParaOracle — ancrage on-chain de resolutions environnementales verifiables.
/// @notice Flow: submitResolution (lock bond) -> dispute window 48h ->
///         finalize (refund) OU dispute (lock challenger bond) -> admin resolve.
/// @dev State machine (PENDING -> FINALIZED) ou (PENDING -> DISPUTED -> FINALIZED via resolveDispute).
contract ParaOracle is IParaOracle {
    // ─── Storage ────────────────────────────────────────────────────────────
    IERC20  public immutable bondToken;      // USDC
    uint256 public immutable bondAmount;     // ex: 500 * 10**6 (500 USDC)
    uint64  public immutable disputeWindowSeconds; // ex: 172800 (48h)
    address public owner;                    // admin pour resolveDispute (MVP)

    mapping(bytes32 => Resolution) private _resolutions;

    // ─── Errors ─────────────────────────────────────────────────────────────
    error NotOwner();
    error ZeroAddress();
    error ResolutionExists();
    error ResolutionNotFound();
    error WrongStatus();
    error DisputeWindowActive();
    error DisputeWindowOver();
    error BondTransferFailed();
    error EmptyCID();
    error ZeroFingerprint();

    // ─── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────
    constructor(IERC20 _bondToken, uint256 _bondAmount, uint64 _disputeWindowSeconds, address _owner) {
        if (address(_bondToken) == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();
        bondToken = _bondToken;
        bondAmount = _bondAmount;
        disputeWindowSeconds = _disputeWindowSeconds;
        owner = _owner;
    }

    // ─── Owner ──────────────────────────────────────────────────────────────
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ─── Core ───────────────────────────────────────────────────────────────
    function computeResolutionId(bytes32 betSlugHash, uint64 periodEnd) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(betSlugHash, periodEnd));
    }

    function submitResolution(
        bytes32 fingerprint,
        string calldata dataCID,
        string calldata scriptCID,
        bytes32 betSlugHash,
        uint256 threshold,
        uint256 observed,
        bool outcome,
        uint64 periodEnd
    ) external returns (bytes32 resolutionId) {
        if (fingerprint == bytes32(0)) revert ZeroFingerprint();
        if (bytes(dataCID).length == 0 || bytes(scriptCID).length == 0) revert EmptyCID();

        resolutionId = computeResolutionId(betSlugHash, periodEnd);
        Resolution storage r = _resolutions[resolutionId];
        if (r.status != Status.NONE) revert ResolutionExists();

        // Lock bond
        if (!bondToken.transferFrom(msg.sender, address(this), bondAmount)) revert BondTransferFailed();

        uint64 nowTs = uint64(block.timestamp);
        uint64 windowEnd = nowTs + disputeWindowSeconds;

        r.fingerprint       = fingerprint;
        r.dataCID           = dataCID;
        r.scriptCID         = scriptCID;
        r.betSlugHash       = betSlugHash;
        r.threshold         = threshold;
        r.observed          = observed;
        r.outcome           = outcome;
        r.periodEnd         = periodEnd;
        r.submittedAt       = nowTs;
        r.disputeWindowEnd  = windowEnd;
        r.oracle            = msg.sender;
        r.bond              = bondAmount;
        r.status            = Status.PENDING;

        emit ResolutionSubmitted(
            resolutionId, betSlugHash, fingerprint, dataCID, scriptCID,
            msg.sender, outcome, observed, threshold, periodEnd, windowEnd, bondAmount
        );
    }

    function dispute(bytes32 resolutionId) external {
        Resolution storage r = _resolutions[resolutionId];
        if (r.status == Status.NONE) revert ResolutionNotFound();
        if (r.status != Status.PENDING) revert WrongStatus();
        if (block.timestamp >= r.disputeWindowEnd) revert DisputeWindowOver();

        if (!bondToken.transferFrom(msg.sender, address(this), bondAmount)) revert BondTransferFailed();

        r.status          = Status.DISPUTED;
        r.challenger      = msg.sender;
        r.challengerBond  = bondAmount;

        emit ResolutionDisputed(resolutionId, msg.sender, bondAmount);
    }

    /// @notice Finalise une resolution PENDING apres la fenetre, refund oracle.
    function finalize(bytes32 resolutionId) external {
        Resolution storage r = _resolutions[resolutionId];
        if (r.status == Status.NONE) revert ResolutionNotFound();
        if (r.status != Status.PENDING) revert WrongStatus();
        if (block.timestamp < r.disputeWindowEnd) revert DisputeWindowActive();

        r.status = Status.FINALIZED;
        // Refund oracle
        if (!bondToken.transfer(r.oracle, r.bond)) revert BondTransferFailed();

        emit ResolutionFinalized(resolutionId, r.outcome, Status.FINALIZED);
    }

    /// @notice Resout un dispute. owner-only pour MVP ; UMA integration en M4+.
    /// @param oracleWins true = oracle refund + challenger slash ; false = challenger recoit les 2 bonds.
    function resolveDispute(bytes32 resolutionId, bool oracleWins) external onlyOwner {
        Resolution storage r = _resolutions[resolutionId];
        if (r.status == Status.NONE) revert ResolutionNotFound();
        if (r.status != Status.DISPUTED) revert WrongStatus();

        r.status = Status.FINALIZED;

        if (oracleWins) {
            // oracle recupere son bond, challenger perd le sien (vers oracle aussi).
            uint256 payout = r.bond + r.challengerBond;
            if (!bondToken.transfer(r.oracle, payout)) revert BondTransferFailed();
        } else {
            // challenger recoit les 2 bonds + l'outcome on-chain est inverse.
            r.outcome = !r.outcome;
            uint256 payout = r.bond + r.challengerBond;
            if (!bondToken.transfer(r.challenger, payout)) revert BondTransferFailed();
        }

        emit DisputeResolved(resolutionId, oracleWins);
        emit ResolutionFinalized(resolutionId, r.outcome, Status.FINALIZED);
    }

    // ─── View ───────────────────────────────────────────────────────────────
    function getResolution(bytes32 resolutionId) external view returns (Resolution memory) {
        return _resolutions[resolutionId];
    }
}
