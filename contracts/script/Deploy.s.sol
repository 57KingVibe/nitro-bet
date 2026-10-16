// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NitroBetMarket} from "../src/NitroBetMarket.sol";

/// forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.stable.xyz --broadcast --account <keystore-name>
contract Deploy is Script {
    function run() external returns (NitroBetMarket market) {
        address token = vm.envAddress("USDT0_ADDRESS"); // the ERC-20 side of USDT0 (6 decimals)
        address owner = vm.envAddress("OWNER"); // use a multisig on mainnet
        address resolver = vm.envAddress("RESOLVER"); // a multisig that posts race results
        address guardian = vm.envAddress("GUARDIAN"); // can pause staking only
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        address complianceSigner = vm.envOr("COMPLIANCE_SIGNER", address(0));
        bool requirePermit = vm.envOr("REQUIRE_PERMIT", false); // false on the free testnet beta

        vm.startBroadcast();
        market = new NitroBetMarket(IERC20(token), owner, resolver, guardian, feeRecipient, complianceSigner, requirePermit);
        vm.stopBroadcast();

        console2.log("NitroBetMarket deployed at", address(market));
    }
}
