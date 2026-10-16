// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {NitroBetMarket} from "../src/NitroBetMarket.sol";
import {MockUSDT0} from "./mocks/MockUSDT0.sol";

contract NitroBetMarketTest is Test {
    NitroBetMarket market;
    MockUSDT0 usdt;

    address owner = makeAddr("owner");
    address resolver = makeAddr("resolver");
    address guardian = makeAddr("guardian");
    address feeTo = makeAddr("feeTo");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address attacker = makeAddr("attacker");

    uint256 signerPk = 0xA11CE;
    address signer;

    uint256 constant U = 1e6; // one USDT0 in token units
    bytes constant NO_SIG = "";

    function setUp() public {
        signer = vm.addr(signerPk);
        usdt = new MockUSDT0();
        market = new NitroBetMarket(IERC20(address(usdt)), owner, resolver, guardian, feeTo, signer, false);

        vm.prank(owner);
        market.setLimits(U, 1_000 * U, 100_000 * U);

        address[3] memory players = [alice, bob, carol];
        for (uint256 i = 0; i < players.length; i++) {
            usdt.mint(players[i], 1_000 * U);
            vm.prank(players[i]);
            usdt.approve(address(market), type(uint256).max);
        }
    }

    // ----------------------------------------------------------------- helpers

    function _open() internal returns (uint256 id) {
        vm.prank(owner);
        id = market.createMarket("F1 Race Winner", 3, uint64(block.timestamp + 1 days), 500);
    }

    function _stake(address who, uint256 id, uint8 outcome, uint256 amount) internal {
        vm.prank(who);
        market.stake(id, outcome, amount, 0, NO_SIG);
    }

    function _resolve(uint256 id, uint8 winning) internal {
        vm.warp(market.getMarket(id).closesAt);
        vm.prank(resolver);
        market.resolve(id, winning);
    }

    function _finalize(uint256 id) internal {
        vm.warp(market.getMarket(id).disputeEndsAt);
    }

    function _sign(uint256 pk, address player, uint64 deadline) internal view returns (bytes memory) {
        bytes32 structHash =
            keccak256(abi.encode(keccak256("Eligibility(address player,uint64 deadline)"), player, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", market.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ------------------------------------------------------------- happy path

    function test_payoutMathAndFee() public {
        uint256 id = _open();
        _stake(alice, id, 0, 100 * U); // winner side
        _stake(bob, id, 0, 300 * U); // winner side
        _stake(carol, id, 1, 200 * U); // loser side
        _resolve(id, 0);
        _finalize(id);

        // loser pool 200, fee 5% = 10, net 190 shared 100:300 -> alice +47.5, bob +142.5
        assertEq(market.feeOf(id), 10 * U);
        assertEq(market.previewPayout(id, alice), 147_500_000);
        assertEq(market.previewPayout(id, bob), 442_500_000);

        vm.prank(alice);
        market.claim(id);
        vm.prank(bob);
        market.claim(id);
        market.withdrawFees(id);

        assertEq(usdt.balanceOf(alice), 1_000 * U - 100 * U + 147_500_000);
        assertEq(usdt.balanceOf(bob), 1_000 * U - 300 * U + 442_500_000);
        assertEq(usdt.balanceOf(feeTo), 10 * U);
        assertEq(usdt.balanceOf(address(market)), 0);
    }

    function test_winnerAlwaysGetsStakeBack() public {
        uint256 id = _open();
        _stake(alice, id, 0, 10 * U);
        _stake(carol, id, 1, 1 * U);
        _resolve(id, 0);
        _finalize(id);
        assertGe(market.previewPayout(id, alice), 10 * U);
    }

    function test_everyoneWinsMeansNoFee() public {
        uint256 id = _open();
        _stake(alice, id, 0, 50 * U);
        _stake(bob, id, 0, 25 * U);
        _resolve(id, 0);
        _finalize(id);
        assertEq(market.feeOf(id), 0);
        vm.expectRevert(NitroBetMarket.NoFees.selector);
        market.withdrawFees(id);
        vm.prank(alice);
        market.claim(id);
        assertEq(usdt.balanceOf(alice), 1_000 * U);
    }

    // ------------------------------------------------------------ claim rules

    function test_claimBeforeDisputeWindowEndsReverts() public {
        uint256 id = _open();
        _stake(alice, id, 0, 10 * U);
        _stake(bob, id, 1, 10 * U);
        _resolve(id, 0);
        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.DisputeWindowOpen.selector);
        market.claim(id);
    }

    function test_doubleClaimAndLoserClaimRevert() public {
        uint256 id = _open();
        _stake(alice, id, 0, 10 * U);
        _stake(bob, id, 1, 10 * U);
        _resolve(id, 0);
        _finalize(id);

        vm.prank(alice);
        market.claim(id);
        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.AlreadySettled.selector);
        market.claim(id);

        vm.prank(bob);
        vm.expectRevert(NitroBetMarket.NothingToClaim.selector);
        market.claim(id);
    }

    function test_feesCanOnlyBeWithdrawnOnce() public {
        uint256 id = _open();
        _stake(alice, id, 0, 100 * U);
        _stake(bob, id, 1, 100 * U);
        _resolve(id, 0);
        _finalize(id);
        market.withdrawFees(id);
        vm.expectRevert(NitroBetMarket.NoFees.selector);
        market.withdrawFees(id);
    }

    // --------------------------------------------------------- void and refunds

    function test_resolverVoidRefundsEveryone() public {
        uint256 id = _open();
        _stake(alice, id, 0, 40 * U);
        _stake(alice, id, 2, 10 * U);
        _stake(bob, id, 1, 70 * U);
        vm.prank(resolver);
        market.voidMarket(id);

        vm.prank(alice);
        market.refund(id);
        vm.prank(bob);
        market.refund(id);
        assertEq(usdt.balanceOf(alice), 1_000 * U);
        assertEq(usdt.balanceOf(bob), 1_000 * U);
        assertEq(usdt.balanceOf(address(market)), 0);

        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.AlreadySettled.selector);
        market.refund(id);
    }

    function test_anyoneCanVoidAfterTimeoutAndPlayersGetRefunds() public {
        uint256 id = _open();
        _stake(alice, id, 0, 30 * U);
        _stake(bob, id, 1, 30 * U);
        uint64 closesAt = market.getMarket(id).closesAt;

        vm.warp(uint256(closesAt) + 7 days);
        vm.prank(attacker);
        vm.expectRevert(NitroBetMarket.StillRunning.selector);
        market.voidExpired(id);

        vm.warp(uint256(closesAt) + 7 days + 1);
        vm.prank(attacker);
        market.voidExpired(id);

        vm.prank(alice);
        market.refund(id);
        assertEq(usdt.balanceOf(alice), 1_000 * U);

        // the resolver is too late to resolve now
        vm.prank(resolver);
        vm.expectRevert(NitroBetMarket.MarketNotOpen.selector);
        market.resolve(id, 0);
    }

    function test_resolveWithNobodyOnWinnerVoids() public {
        uint256 id = _open();
        _stake(alice, id, 0, 20 * U);
        _stake(bob, id, 1, 20 * U);
        _resolve(id, 2); // nobody picked outcome 2
        assertEq(uint8(market.getMarket(id).status), uint8(NitroBetMarket.Status.Void));
        vm.prank(alice);
        market.refund(id);
        assertEq(usdt.balanceOf(alice), 1_000 * U);
    }

    function test_voidInsideDisputeWindowButNotAfter() public {
        uint256 id = _open();
        _stake(alice, id, 0, 20 * U);
        _stake(bob, id, 1, 20 * U);
        _resolve(id, 0);
        vm.prank(resolver);
        market.voidMarket(id);

        uint256 id2 = _open();
        _stake(alice, id2, 0, 20 * U);
        _stake(bob, id2, 1, 20 * U);
        _resolve(id2, 0);
        _finalize(id2);
        vm.prank(resolver);
        vm.expectRevert(NitroBetMarket.CannotVoid.selector);
        market.voidMarket(id2);
    }

    // ------------------------------------------------------------------ amend

    function test_amendOnceInsideWindowMovesPayout() public {
        uint256 id = _open();
        _stake(alice, id, 0, 100 * U);
        _stake(bob, id, 1, 100 * U);
        _resolve(id, 0);

        vm.prank(resolver);
        market.amendResolution(id, 1);
        vm.prank(resolver);
        vm.expectRevert(NitroBetMarket.AlreadyAmended.selector);
        market.amendResolution(id, 0);

        _finalize(id);
        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.NothingToClaim.selector);
        market.claim(id);
        vm.prank(bob);
        market.claim(id);
        assertEq(usdt.balanceOf(bob), 1_000 * U - 100 * U + 100 * U + 95 * U); // stake + (100 - 5% fee)
    }

    function test_amendAfterWindowReverts() public {
        uint256 id = _open();
        _stake(alice, id, 0, 10 * U);
        _stake(bob, id, 1, 10 * U);
        _resolve(id, 0);
        _finalize(id);
        vm.prank(resolver);
        vm.expectRevert(NitroBetMarket.DisputeWindowOver.selector);
        market.amendResolution(id, 1);
    }

    // ------------------------------------------------------------ limits, time

    function test_stakeRulesAndCaps() public {
        uint256 id = _open();

        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.StakeTooSmall.selector);
        market.stake(id, 0, U - 1, 0, NO_SIG);

        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.BadOutcome.selector);
        market.stake(id, 3, U, 0, NO_SIG);

        vm.prank(owner);
        market.setLimits(U, 100 * U, 150 * U);
        _stake(alice, id, 0, 100 * U);
        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.WalletCapExceeded.selector);
        market.stake(id, 1, U, 0, NO_SIG);

        _stake(bob, id, 1, 50 * U);
        vm.prank(carol);
        vm.expectRevert(NitroBetMarket.PoolCapExceeded.selector);
        market.stake(id, 1, U, 0, NO_SIG);
    }

    function test_cannotStakeAfterCloseOrBeforeResolveOrBeforeMarketExists() public {
        uint256 id = _open();
        vm.prank(resolver);
        vm.expectRevert(NitroBetMarket.NotClosedYet.selector);
        market.resolve(id, 0);

        vm.warp(market.getMarket(id).closesAt);
        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.MarketClosed.selector);
        market.stake(id, 0, U, 0, NO_SIG);

        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.MarketNotOpen.selector);
        market.stake(999, 0, U, 0, NO_SIG);
    }

    function test_createMarketValidation() public {
        vm.startPrank(owner);
        vm.expectRevert(NitroBetMarket.BadOutcomeCount.selector);
        market.createMarket("x", 1, uint64(block.timestamp + 1 days), 500);
        vm.expectRevert(NitroBetMarket.BadOutcomeCount.selector);
        market.createMarket("x", 33, uint64(block.timestamp + 1 days), 500);
        vm.expectRevert(NitroBetMarket.BadTime.selector);
        market.createMarket("x", 2, uint64(block.timestamp), 500);
        vm.expectRevert(NitroBetMarket.FeeTooHigh.selector);
        market.createMarket("x", 2, uint64(block.timestamp + 1 days), 1001);
        vm.stopPrank();
    }

    // ------------------------------------------------------ pause and access

    function test_pauseBlocksStakingButNeverClaims() public {
        uint256 id = _open();
        _stake(alice, id, 0, 10 * U);
        _stake(bob, id, 1, 10 * U);
        _resolve(id, 0);
        _finalize(id);

        vm.prank(guardian);
        market.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        market.stake(id, 0, U, 0, NO_SIG);

        vm.prank(alice);
        market.claim(id); // still works while paused

        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian));
        market.unpause();
        vm.prank(owner);
        market.unpause();
    }

    function test_accessControl() public {
        uint256 id = _open();

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        market.createMarket("x", 2, uint64(block.timestamp + 1 days), 500);

        vm.warp(market.getMarket(id).closesAt);
        vm.prank(attacker);
        vm.expectRevert(NitroBetMarket.NotResolver.selector);
        market.resolve(id, 0);

        vm.prank(attacker);
        vm.expectRevert(NitroBetMarket.NotGuardianOrOwner.selector);
        market.pause();

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        market.setFeeRecipient(attacker);
    }

    // -------------------------------------------------------------- permits

    function test_permitRequiredAndChecked() public {
        vm.prank(owner);
        market.setRequirePermit(true);
        uint256 id = _open();
        uint64 deadline = uint64(block.timestamp + 1 hours);

        vm.prank(alice);
        vm.expectRevert(); // empty signature is rejected
        market.stake(id, 0, U, deadline, NO_SIG);

        bytes memory good = _sign(signerPk, alice, deadline);
        vm.prank(alice);
        market.stake(id, 0, U, deadline, good);
        assertEq(market.stakeOf(id, 0, alice), U);

        // a permit is tied to one wallet
        vm.prank(bob);
        vm.expectRevert(NitroBetMarket.BadPermit.selector);
        market.stake(id, 0, U, deadline, good);

        // signed by the wrong key
        bytes memory forged = _sign(0xBAD, carol, deadline);
        vm.prank(carol);
        vm.expectRevert(NitroBetMarket.BadPermit.selector);
        market.stake(id, 0, U, deadline, forged);

        // expired
        bytes memory old = _sign(signerPk, alice, deadline);
        vm.warp(deadline + 1);
        vm.prank(alice);
        vm.expectRevert(NitroBetMarket.PermitExpired.selector);
        market.stake(id, 0, U, deadline, old);
    }

    // ------------------------------------------------------ Stable-specific

    function test_nobodyCanPullTokensOutOfTheContract() public {
        uint256 id = _open();
        _stake(alice, id, 0, 100 * U);
        // The contract never approves anyone, so allowance-based drains (the Stable USDT0 risk) must fail.
        vm.prank(attacker);
        vm.expectRevert();
        usdt.transferFrom(address(market), attacker, 1);
        assertEq(usdt.balanceOf(address(market)), 100 * U);
    }

    function test_zeroAddressesRejected() public {
        vm.startPrank(owner);
        vm.expectRevert(NitroBetMarket.ZeroAddress.selector);
        market.setFeeRecipient(address(0));
        vm.expectRevert(NitroBetMarket.ZeroAddress.selector);
        market.setResolver(address(0));
        vm.stopPrank();

        vm.expectRevert(NitroBetMarket.ZeroAddress.selector);
        new NitroBetMarket(IERC20(address(0)), owner, resolver, guardian, feeTo, signer, false);
    }

    function test_contractCannotReceiveNativeCoins() public {
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        (bool ok,) = address(market).call{value: 1}("");
        assertFalse(ok);
    }

    // ----------------------------------------------------------------- fuzz

    /// Nothing is created or lost: payouts + fee never exceed the pool, winners never lose their stake,
    /// and rounding dust left in the contract is at most one unit per winner.
    function testFuzz_moneyIsConserved(uint96 a, uint96 b, uint96 c, uint16 feeRaw) public {
        _scenario(bound(uint256(a), U, 400 * U), bound(uint256(b), U, 400 * U), bound(uint256(c), U, 400 * U), uint16(bound(uint256(feeRaw), 0, 1000)));
    }

    function _scenario(uint256 sa, uint256 sb, uint256 sc, uint16 feeBps) internal {
        vm.prank(owner);
        uint256 id = market.createMarket("fuzz", 2, uint64(block.timestamp + 1 days), feeBps);
        _stake(alice, id, 0, sa);
        _stake(bob, id, 0, sb);
        _stake(carol, id, 1, sc);
        _resolve(id, 0);
        _finalize(id);

        uint256 aliceBefore = usdt.balanceOf(alice);
        uint256 bobBefore = usdt.balanceOf(bob);
        vm.prank(alice);
        market.claim(id);
        vm.prank(bob);
        market.claim(id);
        uint256 paidA = usdt.balanceOf(alice) - aliceBefore;
        uint256 paidB = usdt.balanceOf(bob) - bobBefore;

        uint256 feePaid = market.feeOf(id);
        if (feePaid > 0) market.withdrawFees(id);

        assertGe(paidA, sa); // a winner never loses their stake
        assertGe(paidB, sb);
        assertLe(paidA + paidB + feePaid, sa + sb + sc); // nothing is created
        assertEq(usdt.balanceOf(feeTo), feePaid);
        assertLe(usdt.balanceOf(address(market)), 2); // rounding dust only: at most 1 unit per winner
    }
}
