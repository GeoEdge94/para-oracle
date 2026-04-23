// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ParaOracle} from "../src/ParaOracle.sol";
import {IParaOracle} from "../src/interfaces/IParaOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract ParaOracleTest is Test {
    ParaOracle   public oracleContract;
    MockERC20    public usdc;

    address public owner      = address(0xABCD);
    address public oracleOp   = address(0x1111);
    address public challenger = address(0x2222);
    address public randomUser = address(0x3333);

    uint256 public constant BOND = 500 * 10**6; // 500 USDC (6 decimals)
    uint64  public constant WINDOW = 172800;    // 48h

    // Sample bet payload
    bytes32 constant FINGERPRINT = keccak256("sha256:ab728589bf550bcabdb991a6e29be58a0236b9fd7b219244ebfb4fc57b181de5");
    string  constant DATA_CID    = "bafybeiab728589bf550bcabdb991a6e29be58a0236b9fd7b219244ebfb";
    string  constant SCRIPT_CID  = "bafybeif91dd1b3281eceacf5a168f99b6829bc2ef3e629daa6b1cc9f18";
    bytes32 constant BET_SLUG    = keccak256("precip-amoy-testnet-01");
    uint256 constant THRESHOLD   = 30_000; // 30 mm * 1000 (fixed-point)
    uint256 constant OBSERVED    = 84_404; // 84.404 mm * 1000
    uint64  constant PERIOD_END  = 1738368000; // 2025-02-01

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        oracleContract = new ParaOracle(usdc, BOND, WINDOW, owner);

        // Fund oracle + challenger, grant allowance
        usdc.mint(oracleOp, BOND * 10);
        usdc.mint(challenger, BOND * 10);
        vm.prank(oracleOp);     usdc.approve(address(oracleContract), type(uint256).max);
        vm.prank(challenger);   usdc.approve(address(oracleContract), type(uint256).max);
    }

    // ─── Happy path ─────────────────────────────────────────────────────────
    function test_submitAndFinalize() public {
        vm.prank(oracleOp);
        bytes32 rid = oracleContract.submitResolution(
            FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END
        );
        assertEq(rid, oracleContract.computeResolutionId(BET_SLUG, PERIOD_END));

        IParaOracle.Resolution memory r = oracleContract.getResolution(rid);
        assertEq(r.fingerprint, FINGERPRINT);
        assertEq(r.dataCID, DATA_CID);
        assertEq(r.bond, BOND);
        assertTrue(r.outcome);
        assertEq(uint8(r.status), uint8(IParaOracle.Status.PENDING));
        assertEq(usdc.balanceOf(address(oracleContract)), BOND);

        // Fast-forward past the window
        vm.warp(block.timestamp + WINDOW + 1);

        // Anyone can finalize
        vm.prank(randomUser);
        oracleContract.finalize(rid);

        r = oracleContract.getResolution(rid);
        assertEq(uint8(r.status), uint8(IParaOracle.Status.FINALIZED));
        // Oracle got its bond back
        assertEq(usdc.balanceOf(oracleOp), BOND * 10);
        assertEq(usdc.balanceOf(address(oracleContract)), 0);
    }

    // ─── Double-submit protection ───────────────────────────────────────────
    function test_doubleSubmitReverts() public {
        vm.prank(oracleOp);
        oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);

        vm.prank(oracleOp);
        vm.expectRevert(ParaOracle.ResolutionExists.selector);
        oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);
    }

    // ─── Empty CID / zero fingerprint guards ────────────────────────────────
    function test_zeroFingerprintReverts() public {
        vm.prank(oracleOp);
        vm.expectRevert(ParaOracle.ZeroFingerprint.selector);
        oracleContract.submitResolution(bytes32(0), DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);
    }

    function test_emptyCIDReverts() public {
        vm.prank(oracleOp);
        vm.expectRevert(ParaOracle.EmptyCID.selector);
        oracleContract.submitResolution(FINGERPRINT, "", SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);
    }

    // ─── Finalize cannot run during window ──────────────────────────────────
    function test_finalizeBeforeWindowReverts() public {
        vm.prank(oracleOp);
        bytes32 rid = oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);

        vm.warp(block.timestamp + WINDOW - 1);
        vm.expectRevert(ParaOracle.DisputeWindowActive.selector);
        oracleContract.finalize(rid);
    }

    // ─── Dispute flow ───────────────────────────────────────────────────────
    function test_disputeLocksChallengerBond() public {
        vm.prank(oracleOp);
        bytes32 rid = oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);

        vm.prank(challenger);
        oracleContract.dispute(rid);

        IParaOracle.Resolution memory r = oracleContract.getResolution(rid);
        assertEq(uint8(r.status), uint8(IParaOracle.Status.DISPUTED));
        assertEq(r.challenger, challenger);
        assertEq(r.challengerBond, BOND);
        // Contract holds both bonds
        assertEq(usdc.balanceOf(address(oracleContract)), BOND * 2);
    }

    function test_disputeAfterWindowReverts() public {
        vm.prank(oracleOp);
        bytes32 rid = oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);

        vm.warp(block.timestamp + WINDOW + 1);
        vm.prank(challenger);
        vm.expectRevert(ParaOracle.DisputeWindowOver.selector);
        oracleContract.dispute(rid);
    }

    function test_finalizeOnDisputedReverts() public {
        vm.prank(oracleOp);
        bytes32 rid = oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);

        vm.prank(challenger);
        oracleContract.dispute(rid);

        vm.warp(block.timestamp + WINDOW + 1);
        vm.expectRevert(ParaOracle.WrongStatus.selector);
        oracleContract.finalize(rid);
    }

    // ─── Dispute resolution (admin) ─────────────────────────────────────────
    function test_resolveDispute_oracleWins() public {
        vm.prank(oracleOp);
        bytes32 rid = oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);
        vm.prank(challenger);
        oracleContract.dispute(rid);

        uint256 oracleBalBefore = usdc.balanceOf(oracleOp);
        uint256 chalBalBefore   = usdc.balanceOf(challenger);

        vm.prank(owner);
        oracleContract.resolveDispute(rid, true);

        IParaOracle.Resolution memory r = oracleContract.getResolution(rid);
        assertEq(uint8(r.status), uint8(IParaOracle.Status.FINALIZED));
        assertTrue(r.outcome); // unchanged
        assertEq(usdc.balanceOf(oracleOp), oracleBalBefore + BOND * 2);
        assertEq(usdc.balanceOf(challenger), chalBalBefore); // no refund
        assertEq(usdc.balanceOf(address(oracleContract)), 0);
    }

    function test_resolveDispute_challengerWins() public {
        vm.prank(oracleOp);
        bytes32 rid = oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);
        vm.prank(challenger);
        oracleContract.dispute(rid);

        uint256 chalBalBefore = usdc.balanceOf(challenger);

        vm.prank(owner);
        oracleContract.resolveDispute(rid, false);

        IParaOracle.Resolution memory r = oracleContract.getResolution(rid);
        assertFalse(r.outcome); // inverted
        assertEq(usdc.balanceOf(challenger), chalBalBefore + BOND * 2);
    }

    function test_resolveDispute_onlyOwner() public {
        vm.prank(oracleOp);
        bytes32 rid = oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);
        vm.prank(challenger);
        oracleContract.dispute(rid);

        vm.prank(randomUser);
        vm.expectRevert(ParaOracle.NotOwner.selector);
        oracleContract.resolveDispute(rid, true);
    }

    function test_resolveDispute_onlyWhenDisputed() public {
        vm.prank(oracleOp);
        bytes32 rid = oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);

        vm.prank(owner);
        vm.expectRevert(ParaOracle.WrongStatus.selector);
        oracleContract.resolveDispute(rid, true);
    }

    // ─── Non-existent resolution ────────────────────────────────────────────
    function test_operationsOnUnknownResolutionRevert() public {
        bytes32 bogus = keccak256("nope");
        vm.expectRevert(ParaOracle.ResolutionNotFound.selector);
        oracleContract.finalize(bogus);
        vm.expectRevert(ParaOracle.ResolutionNotFound.selector);
        oracleContract.dispute(bogus);
    }

    // ─── Events (sanity check) ──────────────────────────────────────────────
    function test_emitsResolutionSubmitted() public {
        vm.expectEmit(true, true, true, false, address(oracleContract));
        emit IParaOracle.ResolutionSubmitted(
            oracleContract.computeResolutionId(BET_SLUG, PERIOD_END),
            BET_SLUG,
            FINGERPRINT,
            DATA_CID,
            SCRIPT_CID,
            oracleOp,
            true,
            OBSERVED,
            THRESHOLD,
            PERIOD_END,
            uint64(block.timestamp) + WINDOW,
            BOND
        );
        vm.prank(oracleOp);
        oracleContract.submitResolution(FINGERPRINT, DATA_CID, SCRIPT_CID, BET_SLUG, THRESHOLD, OBSERVED, true, PERIOD_END);
    }
}
