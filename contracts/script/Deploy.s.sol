// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {ParaOracle} from "../src/ParaOracle.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice Deploie ParaOracle sur Amoy testnet.
/// Env vars attendues :
///   PRIVATE_KEY            : clef privee du deployer (hex sans 0x)
///   USDC_ADDRESS           : 0x... (si vide, on deploie un MockERC20 "USDC" testnet)
///   BOND_AMOUNT_USDC       : ex: 500000000 (500 USDC avec 6 decimales)
///   DISPUTE_WINDOW_SECONDS : ex: 172800 (48h)
///
/// Usage :
///   forge script contracts/script/Deploy.s.sol --rpc-url amoy --broadcast --verify
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        uint256 bondAmount = vm.envOr("BOND_AMOUNT_USDC", uint256(500_000_000));
        uint64  window     = uint64(vm.envOr("DISPUTE_WINDOW_SECONDS", uint256(172800)));
        address usdcAddr   = vm.envOr("USDC_ADDRESS", address(0));

        vm.startBroadcast(pk);

        IERC20 usdc;
        if (usdcAddr == address(0)) {
            MockERC20 mock = new MockERC20("Test USDC", "tUSDC", 6);
            // Pre-mint for the deployer to test submit flows
            mock.mint(deployer, bondAmount * 100);
            usdc = IERC20(address(mock));
            console2.log("Deployed Mock USDC at", address(mock));
        } else {
            usdc = IERC20(usdcAddr);
            console2.log("Using existing USDC at", usdcAddr);
        }

        ParaOracle oracleContract = new ParaOracle(usdc, bondAmount, window, deployer);
        console2.log("Deployed ParaOracle at", address(oracleContract));
        console2.log("Bond amount (USDC units)", bondAmount);
        console2.log("Dispute window (seconds)", uint256(window));

        vm.stopBroadcast();
    }
}
