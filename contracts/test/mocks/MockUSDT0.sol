// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Test-only stand-in for the ERC-20 side of USDT0 (6 decimals, anyone can mint).
contract MockUSDT0 is ERC20 {
    constructor() ERC20("Mock USDT0", "USDT0") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
