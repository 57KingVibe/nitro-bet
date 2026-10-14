// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {NitroBetMarket} from "../src/NitroBetMarket.sol";

/// @notice Deploys NitroBetMarket to the chain behind --rpc-url.
///
/// Required env vars:
///   DEPLOYER_PRIVATE_KEY  key that pays gas (testnet key only, funded from the faucet)
///   EXPECTED_CHAIN_ID     must match the RPC's chain id (verify it at docs.stable.xyz first)
///   TOKEN_ADDRESS         the USDT0 ERC-20 address on this chain (6 decimals)
/// Optional env vars (each defaults to the deployer, fine for a testnet beta only):
///   OWNER, RESOLVER, PERMIT_SIGNER, FEE_RECIPIENT
///
/// Run:  forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast -vvv
contract Deploy is Script {
    function run() external returns (NitroBetMarket market) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        require(block.chainid == expectedChainId, "Deploy: RPC chain id does not match EXPECTED_CHAIN_ID");

        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        require(tokenAddress.code.length > 0, "Deploy: no contract at TOKEN_ADDRESS");
        // The native gas token has 18 decimals, the ERC-20 view has 6. Refuse anything else.
        require(IERC20Metadata(tokenAddress).decimals() == 6, "Deploy: token must have 6 decimals");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address owner = vm.envOr("OWNER", deployer);
        address resolver = vm.envOr("RESOLVER", deployer);
        address permitSigner = vm.envOr("PERMIT_SIGNER", deployer);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        vm.startBroadcast(deployerKey);
        market = new NitroBetMarket(IERC20(tokenAddress), owner, resolver, permitSigner, feeRecipient);
        vm.stopBroadcast();

        console2.log("NitroBetMarket deployed at:", address(market));
        console2.log("chain id:", block.chainid);
        console2.log("token:", tokenAddress);
        console2.log("owner:", owner);
        console2.log("resolver:", resolver);
        console2.log("permitSigner:", permitSigner);
        console2.log("feeRecipient:", feeRecipient);
    }
}
