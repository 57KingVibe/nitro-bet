// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {NitroBetMarket} from "../src/NitroBetMarket.sol";
import {MockUSDT0, FeeOnTransferToken} from "./mocks/MockUSDT0.sol";

contract NitroBetMarketTest is Test {
    NitroBetMarket internal market;
    MockUSDT0 internal token;

    uint256 internal constant ONE = 1e6; // 1 USDT0 (6 decimals)
    uint256 internal constant START_BALANCE = 1_000_000 * ONE;
    uint256 internal constant MIN_BET = 1 * ONE;
    uint256 internal constant MAX_BET = 1_000 * ONE;
    uint256 internal constant MAX_POOL = 100_000 * ONE;

    uint256 internal signerKey = 0xA11CE;
    address internal signer;

    address internal owner = makeAddr("owner");
    address internal resolver = makeAddr("resolver");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave"); // has tokens, no approval, no stakes

    function setUp() public {
        signer = vm.addr(signerKey);
        token = new MockUSDT0();
        market = new NitroBetMarket(IERC20(address(token)), owner, resolver, signer, feeRecipient);

        address[3] memory players = [alice, bob, carol];
        for (uint256 i = 0; i < 3; i++) {
            token.mint(players[i], START_BALANCE);
            vm.prank(players[i]);
            token.approve(address(market), type(uint256).max);
        }
        token.mint(dave, START_BALANCE);
    }

    /*//////////////////////////////////////////////////////////////
                                 HELPERS
    //////////////////////////////////////////////////////////////*/

    function _params() internal view returns (NitroBetMarket.MarketParams memory) {
        return NitroBetMarket.MarketParams({
            numOutcomes: 2,
            feeBps: 500,
            closeTime: uint64(block.timestamp + 1 days),
            minBet: MIN_BET,
            maxBet: MAX_BET,
            maxPool: MAX_POOL,
            metadataHash: keccak256("test-market")
        });
    }

    function _create(uint8 outcomes, uint16 feeBps) internal returns (uint256 id) {
        NitroBetMarket.MarketParams memory p = _params();
        p.numOutcomes = outcomes;
        p.feeBps = feeBps;
        vm.prank(owner);
        id = market.createMarket(p);
    }

    function _closeTime(uint256 id) internal view returns (uint256) {
        return market.getMarket(id).closeTime;
    }

    function _digestFor(
        NitroBetMarket m,
        address user,
        uint256 id,
        uint8 outcome,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 structHash =
            keccak256(abi.encode(m.STAKE_PERMIT_TYPEHASH(), user, id, outcome, amount, nonce, deadline));
        return keccak256(abi.encodePacked("\x19\x01", m.domainSeparator(), structHash));
    }

    function _sign(uint256 key, bytes32 digest) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Server-signed permit for the user's current nonce, valid for one hour.
    function _permit(address user, uint256 id, uint8 outcome, uint256 amount)
        internal
        view
        returns (uint256 deadline, bytes memory sig)
    {
        deadline = block.timestamp + 1 hours;
        sig = _sign(signerKey, _digestFor(market, user, id, outcome, amount, market.nonces(user), deadline));
    }

    function _stake(address user, uint256 id, uint8 outcome, uint256 amount) internal {
        (uint256 deadline, bytes memory sig) = _permit(user, id, outcome, amount);
        vm.prank(user);
        market.stake(id, outcome, amount, deadline, sig);
    }

    function _resolve(uint256 id, uint8 winner) internal {
        uint256 close = _closeTime(id);
        if (block.timestamp < close) vm.warp(close);
        vm.prank(resolver);
        market.resolve(id, winner);
    }

    function _finalize() internal {
        vm.warp(block.timestamp + 24 hours);
    }

    function _assertState(uint256 id, NitroBetMarket.State expected) internal view {
        assertTrue(market.getMarket(id).state == expected, "unexpected market state");
    }

    /// @dev alice 600 + carol 200 on outcome 0, bob 400 on outcome 1, fee 5%. Pool 1200.
    ///      If outcome 0 wins: fee 60, distributable 1140, alice 855, carol 285.
    function _scenario() internal returns (uint256 id) {
        id = _create(2, 500);
        _stake(alice, id, 0, 600 * ONE);
        _stake(bob, id, 1, 400 * ONE);
        _stake(carol, id, 0, 200 * ONE);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR / CONSTANTS
    //////////////////////////////////////////////////////////////*/

    function test_constants() public view {
        assertEq(uint256(market.MAX_FEE_BPS()), 1_000);
        assertEq(uint256(market.BPS()), 10_000);
        assertEq(uint256(market.DISPUTE_WINDOW()), 24 hours);
        assertEq(uint256(market.REFUND_AFTER()), 7 days);
        assertEq(address(market.token()), address(token));
        assertEq(market.resolver(), resolver);
        assertEq(market.permitSigner(), signer);
        assertEq(market.owner(), owner);
    }

    function test_constructor_revertsOnZeroAddress() public {
        IERC20 t = IERC20(address(token));

        vm.expectRevert(NitroBetMarket.ZeroAddress.selector);
        new NitroBetMarket(IERC20(address(0)), owner, resolver, signer, feeRecipient);

        vm.expectRevert(NitroBetMarket.ZeroAddress.selector);
        new NitroBetMarket(t, owner, address(0), signer, feeRecipient);

        vm.expectRevert(NitroBetMarket.ZeroAddress.selector);
        new NitroBetMarket(t, owner, resolver, address(0), feeRecipient);

        vm.expectRevert(NitroBetMarket.ZeroAddress.selector);
        new NitroBetMarket(t, owner, resolver, signer, address(0));

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new NitroBetMarket(t, address(0), resolver, signer, feeRecipient);
    }

    /*//////////////////////////////////////////////////////////////
                                createMarket
    //////////////////////////////////////////////////////////////*/

    function test_createMarket_storesParams() public {
        uint256 id = _create(3, 500);
        assertEq(id, 1);
        assertEq(market.marketCount(), 1);

        NitroBetMarket.Market memory m = market.getMarket(id);
        assertTrue(m.state == NitroBetMarket.State.Open);
        assertEq(uint256(m.numOutcomes), 3);
        assertEq(uint256(m.feeBps), 500);
        assertEq(uint256(m.closeTime), block.timestamp + 1 days);
        assertEq(m.minBet, MIN_BET);
        assertEq(m.maxBet, MAX_BET);
        assertEq(m.maxPool, MAX_POOL);
        assertEq(m.totalPool, 0);

        assertEq(_create(2, 0), 2);
    }

    function test_createMarket_onlyOwner() public {
        NitroBetMarket.MarketParams memory p = _params();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        market.createMarket(p);
    }

    function _expectCreateRevert(NitroBetMarket.MarketParams memory p, bytes4 selector) internal {
        vm.expectRevert(selector);
        vm.prank(owner);
        market.createMarket(p);
    }

    function test_createMarket_validation() public {
        NitroBetMarket.MarketParams memory p = _params();
        p.numOutcomes = 1;
        _expectCreateRevert(p, NitroBetMarket.BadOutcomeCount.selector);

        p = _params();
        p.numOutcomes = 33;
        _expectCreateRevert(p, NitroBetMarket.BadOutcomeCount.selector);

        p = _params();
        p.feeBps = 1_001;
        _expectCreateRevert(p, NitroBetMarket.FeeTooHigh.selector);

        p = _params();
        p.closeTime = uint64(block.timestamp);
        _expectCreateRevert(p, NitroBetMarket.BadCloseTime.selector);

        p = _params();
        p.minBet = 0;
        _expectCreateRevert(p, NitroBetMarket.BadCaps.selector);

        p = _params();
        p.minBet = p.maxBet + 1;
        _expectCreateRevert(p, NitroBetMarket.BadCaps.selector);

        p = _params();
        p.maxPool = p.maxBet - 1;
        _expectCreateRevert(p, NitroBetMarket.BadCaps.selector);
    }

    function testFuzz_createMarket_feeCap(uint16 feeBps) public {
        NitroBetMarket.MarketParams memory p = _params();
        p.feeBps = feeBps;
        if (feeBps > 1_000) vm.expectRevert(NitroBetMarket.FeeTooHigh.selector);
        vm.prank(owner);
        market.createMarket(p);
    }

    /*//////////////////////////////////////////////////////////////
                                   stake
    //////////////////////////////////////////////////////////////*/

    function test_stake_happyPath() public {
        uint256 id = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 1, 10 * ONE);

        vm.expectEmit(true, true, true, true, address(market));
        emit NitroBetMarket.Staked(id, alice, 1, 10 * ONE);
        vm.prank(alice);
        market.stake(id, 1, 10 * ONE, deadline, sig);

        assertEq(token.balanceOf(address(market)), 10 * ONE);
        assertEq(token.balanceOf(alice), START_BALANCE - 10 * ONE);
        assertEq(market.outcomePool(id, 1), 10 * ONE);
        assertEq(market.stakeOf(id, alice, 1), 10 * ONE);
        assertEq(market.totalStakeOf(id, alice), 10 * ONE);
        assertEq(market.getMarket(id).totalPool, 10 * ONE);
        assertEq(market.nonces(alice), 1);
    }

    function test_stake_sameUserMultipleOutcomes() public {
        uint256 id = _create(3, 500);
        _stake(alice, id, 0, 100 * ONE);
        _stake(alice, id, 2, 50 * ONE);
        assertEq(market.stakeOf(id, alice, 0), 100 * ONE);
        assertEq(market.stakeOf(id, alice, 2), 50 * ONE);
        assertEq(market.totalStakeOf(id, alice), 150 * ONE);
        assertEq(market.nonces(alice), 2);
    }

    function test_stake_revertsOnUnknownMarket() public {
        (uint256 deadline, bytes memory sig) = _permit(alice, 99, 0, 10 * ONE);
        vm.expectRevert(NitroBetMarket.MarketNotOpen.selector);
        vm.prank(alice);
        market.stake(99, 0, 10 * ONE, deadline, sig);
    }

    function test_stake_revertsAfterClose() public {
        uint256 id = _create(2, 500);
        vm.warp(_closeTime(id));
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 0, 10 * ONE);
        vm.expectRevert(NitroBetMarket.StakingClosed.selector);
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, sig);
    }

    function test_stake_revertsWhenPaused() public {
        uint256 id = _create(2, 500);
        vm.prank(owner);
        market.pause();
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 0, 10 * ONE);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, sig);
    }

    function test_stake_revertsOnBadOutcome() public {
        uint256 id = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 2, 10 * ONE);
        vm.expectRevert(NitroBetMarket.BadOutcome.selector);
        vm.prank(alice);
        market.stake(id, 2, 10 * ONE, deadline, sig);
    }

    function test_stake_revertsOutsideBetLimits() public {
        uint256 id = _create(2, 500);

        (uint256 d1, bytes memory s1) = _permit(alice, id, 0, MIN_BET - 1);
        vm.expectRevert(NitroBetMarket.BetOutOfRange.selector);
        vm.prank(alice);
        market.stake(id, 0, MIN_BET - 1, d1, s1);

        (uint256 d2, bytes memory s2) = _permit(alice, id, 0, MAX_BET + 1);
        vm.expectRevert(NitroBetMarket.BetOutOfRange.selector);
        vm.prank(alice);
        market.stake(id, 0, MAX_BET + 1, d2, s2);

        // The limits themselves are allowed.
        _stake(alice, id, 0, MIN_BET);
        _stake(alice, id, 0, MAX_BET);
    }

    function test_stake_revertsPastPoolCap() public {
        NitroBetMarket.MarketParams memory p = _params();
        p.maxPool = 1_500 * ONE;
        vm.prank(owner);
        uint256 id = market.createMarket(p);

        _stake(alice, id, 0, 1_000 * ONE);

        (uint256 deadline, bytes memory sig) = _permit(bob, id, 1, 600 * ONE);
        vm.expectRevert(NitroBetMarket.PoolCapExceeded.selector);
        vm.prank(bob);
        market.stake(id, 1, 600 * ONE, deadline, sig);

        _stake(bob, id, 1, 500 * ONE); // exactly fills the pool
        assertEq(market.getMarket(id).totalPool, 1_500 * ONE);
    }

    function test_stake_revertsOnExpiredPermit() public {
        uint256 id = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 0, 10 * ONE);
        vm.warp(deadline + 1);
        vm.expectRevert(NitroBetMarket.PermitExpired.selector);
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, sig);
    }

    function test_stake_permitValidAtDeadline() public {
        uint256 id = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 0, 10 * ONE);
        vm.warp(deadline);
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, sig);
        assertEq(market.stakeOf(id, alice, 0), 10 * ONE);
    }

    function test_stake_revertsOnWrongSigner() public {
        uint256 id = _create(2, 500);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(0xB0B, _digestFor(market, alice, id, 0, 10 * ONE, 0, deadline));
        vm.expectRevert(NitroBetMarket.InvalidPermit.selector);
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, sig);
    }

    function test_stake_revertsOnGarbageSignature() public {
        uint256 id = _create(2, 500);
        uint256 deadline = block.timestamp + 1 hours;
        vm.expectRevert(NitroBetMarket.InvalidPermit.selector);
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, hex"1234");
    }

    function test_stake_revertsOnReplay() public {
        uint256 id = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 0, 10 * ONE);
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, sig);

        vm.expectRevert(NitroBetMarket.InvalidPermit.selector);
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, sig);
    }

    function test_stake_revertsOnTamperedAmount() public {
        uint256 id = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 0, 10 * ONE);
        vm.expectRevert(NitroBetMarket.InvalidPermit.selector);
        vm.prank(alice);
        market.stake(id, 0, 20 * ONE, deadline, sig);
    }

    function test_stake_revertsOnTamperedOutcome() public {
        uint256 id = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 0, 10 * ONE);
        vm.expectRevert(NitroBetMarket.InvalidPermit.selector);
        vm.prank(alice);
        market.stake(id, 1, 10 * ONE, deadline, sig);
    }

    function test_stake_revertsOnPermitForOtherUser() public {
        uint256 id = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(alice, id, 0, 10 * ONE);
        vm.expectRevert(NitroBetMarket.InvalidPermit.selector);
        vm.prank(bob);
        market.stake(id, 0, 10 * ONE, deadline, sig);
    }

    function test_stake_revertsOnPermitForOtherMarket() public {
        uint256 id1 = _create(2, 500);
        uint256 id2 = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(alice, id1, 0, 10 * ONE);
        vm.expectRevert(NitroBetMarket.InvalidPermit.selector);
        vm.prank(alice);
        market.stake(id2, 0, 10 * ONE, deadline, sig);
    }

    function test_stake_revertsWithoutAllowance() public {
        uint256 id = _create(2, 500);
        (uint256 deadline, bytes memory sig) = _permit(dave, id, 0, 10 * ONE);
        vm.expectRevert();
        vm.prank(dave);
        market.stake(id, 0, 10 * ONE, deadline, sig);
    }

    function test_stake_rejectsFeeOnTransferToken() public {
        FeeOnTransferToken ft = new FeeOnTransferToken();
        NitroBetMarket m2 = new NitroBetMarket(IERC20(address(ft)), owner, resolver, signer, feeRecipient);
        vm.prank(owner);
        uint256 id = m2.createMarket(_params());

        ft.mint(alice, 100 * ONE);
        vm.prank(alice);
        ft.approve(address(m2), type(uint256).max);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(signerKey, _digestFor(m2, alice, id, 0, 10 * ONE, 0, deadline));

        vm.expectRevert(NitroBetMarket.UnexpectedTransferAmount.selector);
        vm.prank(alice);
        m2.stake(id, 0, 10 * ONE, deadline, sig);
    }

    /*//////////////////////////////////////////////////////////////
                              resolve / voidMarket
    //////////////////////////////////////////////////////////////*/

    function test_resolve_onlyResolver() public {
        uint256 id = _scenario();
        vm.warp(_closeTime(id));
        vm.expectRevert(NitroBetMarket.NotResolver.selector);
        vm.prank(owner); // not even the owner
        market.resolve(id, 0);
    }

    function test_resolve_revertsBeforeClose() public {
        uint256 id = _scenario();
        vm.expectRevert(NitroBetMarket.MarketNotClosed.selector);
        vm.prank(resolver);
        market.resolve(id, 0);
    }

    function test_resolve_revertsOnBadOutcomeOrUnknownMarket() public {
        uint256 id = _scenario();
        vm.warp(_closeTime(id));

        vm.expectRevert(NitroBetMarket.BadOutcome.selector);
        vm.prank(resolver);
        market.resolve(id, 2);

        vm.expectRevert(NitroBetMarket.BadOutcome.selector);
        vm.prank(resolver);
        market.resolve(99, 0);
    }

    function test_resolve_possibleUntilDeadlineThenExpires() public {
        uint256 id = _scenario();
        uint256 close = _closeTime(id);

        vm.warp(close + 7 days);
        vm.prank(resolver);
        market.resolve(id, 0);
        _assertState(id, NitroBetMarket.State.Resolved);

        uint256 id2 = _create(2, 500);
        vm.warp(_closeTime(id2) + 7 days + 1);
        vm.expectRevert(NitroBetMarket.ResolutionExpired.selector);
        vm.prank(resolver);
        market.resolve(id2, 0);
    }

    function test_resolve_canCorrectInsideWindowOnly() public {
        uint256 id = _scenario();
        _resolve(id, 0);
        uint256 resolvedAt = block.timestamp;

        vm.warp(resolvedAt + 24 hours - 1);
        vm.prank(resolver);
        market.resolve(id, 1);
        assertEq(uint256(market.getMarket(id).winningOutcome), 1);
        assertEq(uint256(market.getMarket(id).resolvedAt), resolvedAt); // window not extended

        vm.warp(resolvedAt + 24 hours);
        vm.expectRevert(NitroBetMarket.Finalized.selector);
        vm.prank(resolver);
        market.resolve(id, 0);
    }

    function test_resolve_revertsOnVoidedMarket() public {
        uint256 id = _scenario();
        vm.prank(resolver);
        market.voidMarket(id);
        vm.warp(_closeTime(id));
        vm.expectRevert(NitroBetMarket.NotResolvable.selector);
        vm.prank(resolver);
        market.resolve(id, 0);
    }

    function test_voidMarket_onlyResolver() public {
        uint256 id = _scenario();
        vm.expectRevert(NitroBetMarket.NotResolver.selector);
        vm.prank(alice);
        market.voidMarket(id);
    }

    function test_voidMarket_beforeCloseRefundsEveryone() public {
        uint256 id = _scenario();
        vm.prank(resolver);
        market.voidMarket(id);
        _assertState(id, NitroBetMarket.State.Voided);

        vm.prank(alice);
        assertEq(market.refund(id), 600 * ONE);
        vm.prank(bob);
        assertEq(market.refund(id), 400 * ONE);
        vm.prank(carol);
        assertEq(market.refund(id), 200 * ONE);

        assertEq(token.balanceOf(address(market)), 0);
        assertEq(token.balanceOf(alice), START_BALANCE);
        assertEq(token.balanceOf(bob), START_BALANCE);
        assertEq(token.balanceOf(carol), START_BALANCE);
    }

    function test_voidMarket_blocksFurtherStaking() public {
        uint256 id = _scenario();
        vm.prank(resolver);
        market.voidMarket(id);
        (uint256 deadline, bytes memory sig) = _permit(dave, id, 0, 10 * ONE);
        vm.expectRevert(NitroBetMarket.MarketNotOpen.selector);
        vm.prank(dave);
        market.stake(id, 0, 10 * ONE, deadline, sig);
    }

    function test_voidMarket_insideDisputeWindowButNotAfter() public {
        uint256 id = _scenario();
        _resolve(id, 0);
        vm.warp(block.timestamp + 12 hours);
        vm.prank(resolver);
        market.voidMarket(id);
        _assertState(id, NitroBetMarket.State.Voided);

        uint256 id2 = _scenario();
        _resolve(id2, 0);
        _finalize();
        vm.expectRevert(NitroBetMarket.Finalized.selector);
        vm.prank(resolver);
        market.voidMarket(id2);
    }

    function test_voidMarket_twiceReverts() public {
        uint256 id = _scenario();
        vm.prank(resolver);
        market.voidMarket(id);
        vm.expectRevert(NitroBetMarket.NotResolvable.selector);
        vm.prank(resolver);
        market.voidMarket(id);
    }

    /*//////////////////////////////////////////////////////////////
                                   claim
    //////////////////////////////////////////////////////////////*/

    function test_claim_revertsBeforeResolution() public {
        uint256 id = _scenario();
        vm.expectRevert(NitroBetMarket.NotResolved.selector);
        vm.prank(alice);
        market.claim(id);
    }

    function test_claim_revertsDuringDisputeWindow() public {
        uint256 id = _scenario();
        _resolve(id, 0);

        vm.expectRevert(NitroBetMarket.DisputeWindowOpen.selector);
        vm.prank(alice);
        market.claim(id);

        vm.warp(block.timestamp + 24 hours - 1);
        vm.expectRevert(NitroBetMarket.DisputeWindowOpen.selector);
        vm.prank(alice);
        market.claim(id);

        vm.warp(block.timestamp + 1);
        vm.prank(alice);
        market.claim(id); // exactly at the end of the window
    }

    function test_claim_paysProportionalSharesOfPoolMinusFee() public {
        uint256 id = _scenario();
        _resolve(id, 0);
        _finalize();

        vm.expectEmit(true, true, false, true, address(market));
        emit NitroBetMarket.Claimed(id, alice, 855 * ONE);
        vm.prank(alice);
        uint256 alicePayout = market.claim(id);

        vm.prank(carol);
        uint256 carolPayout = market.claim(id);

        assertEq(alicePayout, 855 * ONE);
        assertEq(carolPayout, 285 * ONE);
        assertEq(token.balanceOf(alice), START_BALANCE - 600 * ONE + 855 * ONE);
        assertEq(token.balanceOf(carol), START_BALANCE - 200 * ONE + 285 * ONE);
        assertEq(token.balanceOf(bob), START_BALANCE - 400 * ONE);
        assertEq(token.balanceOf(address(market)), 60 * ONE); // only the fee is left
    }

    function test_claim_cannotBeRepeated() public {
        uint256 id = _scenario();
        _resolve(id, 0);
        _finalize();
        vm.prank(alice);
        market.claim(id);

        vm.expectRevert(NitroBetMarket.AlreadySettled.selector);
        vm.prank(alice);
        market.claim(id);
    }

    function test_claim_losersAndOutsidersGetNothing() public {
        uint256 id = _scenario();
        _resolve(id, 0);
        _finalize();

        vm.expectRevert(NitroBetMarket.NothingToClaim.selector);
        vm.prank(bob);
        market.claim(id);

        vm.expectRevert(NitroBetMarket.NothingToClaim.selector);
        vm.prank(dave);
        market.claim(id);
    }

    function test_claim_usesCorrectedResult() public {
        uint256 id = _scenario();
        _resolve(id, 0);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(resolver);
        market.resolve(id, 1); // correction: bob actually won
        _finalize();

        // Winner pool 400, fee 60, distributable 1140, bob gets all of it.
        vm.prank(bob);
        assertEq(market.claim(id), 1_140 * ONE);

        vm.expectRevert(NitroBetMarket.NothingToClaim.selector);
        vm.prank(alice);
        market.claim(id);
    }

    function test_claim_roundsDownAndLeavesDustInContract() public {
        vm.prank(dave);
        token.approve(address(market), type(uint256).max);

        // Three equal winners (30 total) vs a 1 USDT0 loser pool, no fee: 31 / 3 does not divide evenly.
        uint256 id = _create(2, 0);
        _stake(alice, id, 0, 10 * ONE);
        _stake(bob, id, 0, 10 * ONE);
        _stake(carol, id, 0, 10 * ONE);
        _stake(dave, id, 1, 1 * ONE);
        _resolve(id, 0);
        _finalize();

        vm.prank(alice);
        assertEq(market.claim(id), 10_333_333);
        vm.prank(bob);
        assertEq(market.claim(id), 10_333_333);
        vm.prank(carol);
        assertEq(market.claim(id), 10_333_333);

        assertEq(token.balanceOf(address(market)), 1); // 1 unit (0.000001 USDT0) of dust
    }

    /*//////////////////////////////////////////////////////////////
                               withdrawFees
    //////////////////////////////////////////////////////////////*/

    function test_withdrawFees_sendsFeeToRecipientOnce() public {
        uint256 id = _scenario();
        _resolve(id, 0);
        _finalize();

        vm.prank(owner);
        uint256 fee = market.withdrawFees(id);
        assertEq(fee, 60 * ONE);
        assertEq(token.balanceOf(feeRecipient), 60 * ONE);

        vm.expectRevert(NitroBetMarket.FeesAlreadyWithdrawn.selector);
        vm.prank(owner);
        market.withdrawFees(id);
    }

    function test_withdrawFees_onlyOwner() public {
        uint256 id = _scenario();
        _resolve(id, 0);
        _finalize();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        market.withdrawFees(id);
    }

    function test_withdrawFees_notBeforeFinal() public {
        uint256 id = _scenario();

        vm.expectRevert(NitroBetMarket.NotResolved.selector);
        vm.prank(owner);
        market.withdrawFees(id);

        _resolve(id, 0);
        vm.expectRevert(NitroBetMarket.DisputeWindowOpen.selector);
        vm.prank(owner);
        market.withdrawFees(id);
    }

    function test_withdrawFees_neverFromVoidedMarket() public {
        uint256 id = _scenario();
        vm.prank(resolver);
        market.voidMarket(id);
        vm.expectRevert(NitroBetMarket.NotResolved.selector);
        vm.prank(owner);
        market.withdrawFees(id);
    }

    function test_setFeeRecipient_redirectsFees() public {
        uint256 id = _scenario();
        vm.prank(owner);
        market.setFeeRecipient(dave);
        uint256 before = token.balanceOf(dave);

        _resolve(id, 0);
        _finalize();
        vm.prank(owner);
        market.withdrawFees(id);
        assertEq(token.balanceOf(dave), before + 60 * ONE);
        assertEq(token.balanceOf(feeRecipient), 0);
    }

    function test_setFeeRecipient_guards() public {
        vm.expectRevert(NitroBetMarket.ZeroAddress.selector);
        vm.prank(owner);
        market.setFeeRecipient(address(0));

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        market.setFeeRecipient(alice);
    }

    /*//////////////////////////////////////////////////////////////
                                   refund
    //////////////////////////////////////////////////////////////*/

    function test_refund_notWhileOpenAndWithinDeadline() public {
        uint256 id = _scenario();
        vm.expectRevert(NitroBetMarket.NotRefundable.selector);
        vm.prank(alice);
        market.refund(id);

        vm.warp(_closeTime(id) + 7 days); // exactly at the deadline: resolver still has time
        vm.expectRevert(NitroBetMarket.NotRefundable.selector);
        vm.prank(alice);
        market.refund(id);

        vm.expectRevert(NitroBetMarket.NotRefundable.selector);
        vm.prank(dave);
        market.triggerRefund(id);
    }

    function test_refund_afterSevenDaysAnyoneCanTrigger() public {
        uint256 id = _scenario();
        vm.warp(_closeTime(id) + 7 days + 1);

        vm.prank(dave); // not a player at all
        market.triggerRefund(id);
        _assertState(id, NitroBetMarket.State.Voided);

        vm.prank(alice);
        assertEq(market.refund(id), 600 * ONE);
        vm.prank(bob);
        assertEq(market.refund(id), 400 * ONE);
        vm.prank(carol);
        assertEq(market.refund(id), 200 * ONE);
        assertEq(token.balanceOf(address(market)), 0);
    }

    function test_refund_firstRefundCallVoidsExpiredMarket() public {
        uint256 id = _scenario();
        vm.warp(_closeTime(id) + 7 days + 1);

        vm.prank(alice);
        assertEq(market.refund(id), 600 * ONE);
        _assertState(id, NitroBetMarket.State.Voided);
    }

    function test_refund_resolverCannotResolveAfterExpiryEvenBeforeAnyRefund() public {
        uint256 id = _scenario();
        vm.warp(_closeTime(id) + 7 days + 1);
        vm.expectRevert(NitroBetMarket.ResolutionExpired.selector);
        vm.prank(resolver);
        market.resolve(id, 0);
    }

    function test_refund_sumsAllOutcomesForOneUser() public {
        uint256 id = _create(3, 500);
        _stake(alice, id, 0, 100 * ONE);
        _stake(alice, id, 1, 50 * ONE);
        vm.prank(resolver);
        market.voidMarket(id);

        vm.prank(alice);
        assertEq(market.refund(id), 150 * ONE);
        assertEq(token.balanceOf(alice), START_BALANCE);
    }

    function test_refund_cannotBeRepeated() public {
        uint256 id = _scenario();
        vm.prank(resolver);
        market.voidMarket(id);
        vm.prank(alice);
        market.refund(id);

        vm.expectRevert(NitroBetMarket.AlreadySettled.selector);
        vm.prank(alice);
        market.refund(id);
    }

    function test_refund_nothingForNonPlayersOrUnknownMarkets() public {
        uint256 id = _scenario();
        vm.prank(resolver);
        market.voidMarket(id);

        vm.expectRevert(NitroBetMarket.NothingToClaim.selector);
        vm.prank(dave);
        market.refund(id);

        vm.expectRevert(NitroBetMarket.NotRefundable.selector);
        vm.prank(alice);
        market.refund(99);

        vm.expectRevert(NitroBetMarket.NotRefundable.selector);
        vm.prank(alice);
        market.triggerRefund(99);
    }

    function test_refund_notAvailableWhenResolvedWithRealContest() public {
        uint256 id = _scenario();
        _resolve(id, 0);

        vm.expectRevert(NitroBetMarket.DisputeWindowOpen.selector);
        vm.prank(alice);
        market.refund(id);

        _finalize();
        vm.expectRevert(NitroBetMarket.NotRefundable.selector);
        vm.prank(alice);
        market.refund(id);
    }

    /*//////////////////////////////////////////////////////////////
                                 no contest
    //////////////////////////////////////////////////////////////*/

    function test_noContest_nobodyBackedTheWinner() public {
        uint256 id = _create(3, 500);
        _stake(alice, id, 0, 300 * ONE);
        _stake(bob, id, 1, 200 * ONE);
        _resolve(id, 2);
        _finalize();

        vm.expectRevert(NitroBetMarket.NoContest.selector);
        vm.prank(alice);
        market.claim(id);

        vm.expectRevert(NitroBetMarket.NoContest.selector);
        vm.prank(owner);
        market.withdrawFees(id);

        vm.prank(alice);
        assertEq(market.refund(id), 300 * ONE);
        vm.prank(bob);
        assertEq(market.refund(id), 200 * ONE);
        assertEq(token.balanceOf(address(market)), 0);
    }

    function test_noContest_everybodyBackedTheWinner() public {
        uint256 id = _create(2, 500);
        _stake(alice, id, 0, 300 * ONE);
        _stake(bob, id, 0, 200 * ONE);
        _resolve(id, 0);
        _finalize();

        vm.expectRevert(NitroBetMarket.NoContest.selector);
        vm.prank(alice);
        market.claim(id);

        vm.prank(alice);
        assertEq(market.refund(id), 300 * ONE);
        vm.prank(bob);
        assertEq(market.refund(id), 200 * ONE);
        assertEq(token.balanceOf(address(market)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                                    pause
    //////////////////////////////////////////////////////////////*/

    function test_pause_onlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        market.pause();

        vm.prank(owner);
        market.pause();

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        market.unpause();
    }

    function test_pause_blocksNewMarketsAndStakesThenUnpauseRestores() public {
        uint256 id = _create(2, 500);
        vm.prank(owner);
        market.pause();

        NitroBetMarket.MarketParams memory p = _params();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(owner);
        market.createMarket(p);

        vm.prank(owner);
        market.unpause();
        _stake(alice, id, 0, 10 * ONE);
        assertEq(market.stakeOf(id, alice, 0), 10 * ONE);
    }

    function test_pause_neverBlocksResolveClaimRefundOrFees() public {
        uint256 id = _scenario();
        uint256 voidedId = _scenario();

        vm.prank(owner);
        market.pause();

        // resolve + claim + withdrawFees keep working
        _resolve(id, 0);
        _finalize();
        vm.prank(alice);
        market.claim(id);
        vm.prank(owner);
        market.withdrawFees(id);

        // void + refund keep working
        vm.prank(resolver);
        market.voidMarket(voidedId);
        vm.prank(bob);
        assertEq(market.refund(voidedId), 400 * ONE);
    }

    /*//////////////////////////////////////////////////////////////
                         native value / ownership / signer
    //////////////////////////////////////////////////////////////*/

    function test_rejectsNativeValue() public {
        vm.deal(address(this), 2 ether);

        (bool ok,) = address(market).call{value: 1 ether}("");
        assertFalse(ok);

        (bool ok2,) = address(market).call{value: 1}(abi.encodeWithSignature("claim(uint256)", 1));
        assertFalse(ok2);

        assertEq(address(market).balance, 0);
    }

    function test_renounceOwnershipIsDisabled() public {
        vm.expectRevert(NitroBetMarket.RenounceDisabled.selector);
        vm.prank(owner);
        market.renounceOwnership();
        assertEq(market.owner(), owner);
    }

    function test_ownershipTransferIsTwoStep() public {
        vm.prank(owner);
        market.transferOwnership(alice);
        assertEq(market.owner(), owner);
        assertEq(market.pendingOwner(), alice);

        vm.prank(alice);
        market.acceptOwnership();
        assertEq(market.owner(), alice);
    }

    function test_setPermitSigner_rotatesKey() public {
        uint256 id = _create(2, 500);
        uint256 newKey = 0xC0FFEE;

        vm.prank(owner);
        market.setPermitSigner(vm.addr(newKey));

        // Old key no longer works.
        (uint256 deadline, bytes memory oldSig) = _permit(alice, id, 0, 10 * ONE);
        vm.expectRevert(NitroBetMarket.InvalidPermit.selector);
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, oldSig);

        // New key does.
        bytes memory newSig = _sign(newKey, _digestFor(market, alice, id, 0, 10 * ONE, 0, deadline));
        vm.prank(alice);
        market.stake(id, 0, 10 * ONE, deadline, newSig);
        assertEq(market.stakeOf(id, alice, 0), 10 * ONE);
    }

    function test_setPermitSigner_guards() public {
        vm.expectRevert(NitroBetMarket.ZeroAddress.selector);
        vm.prank(owner);
        market.setPermitSigner(address(0));

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        market.setPermitSigner(alice);
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    function _fuzzUser(uint256 i) internal returns (address u) {
        u = address(uint160(0xF000 + i));
        token.mint(u, START_BALANCE);
        vm.prank(u);
        token.approve(address(market), type(uint256).max);
    }

    /// @dev For any stakes, winner and fee: payouts + fee never exceed the pool, the leftover dust
    ///      equals the pool minus payouts minus fee, and it is smaller than the number of winners.
    function testFuzz_solvencyAndRounding(
        uint256[6] memory rawAmounts,
        uint8[6] memory rawOutcomes,
        uint8 rawWinner,
        uint16 rawFee
    ) public {
        uint16 feeBps = uint16(bound(uint256(rawFee), 0, 1_000));
        uint256 id = _create(3, feeBps);

        address[6] memory users;
        uint8[6] memory outcomes;
        uint256 total;
        for (uint256 i = 0; i < 6; i++) {
            users[i] = _fuzzUser(i);
            outcomes[i] = rawOutcomes[i] % 3;
            uint256 amount = bound(rawAmounts[i], MIN_BET, MAX_BET);
            _stake(users[i], id, outcomes[i], amount);
            total += amount;
        }
        assertEq(token.balanceOf(address(market)), total);

        uint8 winner = rawWinner % 3;
        _resolve(id, winner);
        _finalize();

        uint256 winningPool = market.outcomePool(id, winner);
        if (winningPool == 0 || winningPool == total) {
            uint256 refunded;
            for (uint256 i = 0; i < 6; i++) {
                vm.prank(users[i]);
                refunded += market.refund(id);
            }
            assertEq(refunded, total);
            assertEq(token.balanceOf(address(market)), 0);
            return;
        }

        uint256 paid;
        uint256 winners;
        for (uint256 i = 0; i < 6; i++) {
            if (outcomes[i] == winner) {
                vm.prank(users[i]);
                paid += market.claim(id);
                winners++;
            }
        }

        vm.prank(owner);
        uint256 feePaid = market.withdrawFees(id);
        assertEq(feePaid, (total * feeBps) / 10_000);

        assertLe(paid + feePaid, total);
        uint256 dust = token.balanceOf(address(market));
        assertEq(dust, total - paid - feePaid);
        assertLt(dust, winners);
    }

    /// @dev A voided market returns every stake exactly and leaves nothing behind.
    function testFuzz_voidRefundsExactly(uint256[6] memory rawAmounts, uint8[6] memory rawOutcomes) public {
        uint256 id = _create(3, 500);

        address[6] memory users;
        uint256[6] memory amounts;
        for (uint256 i = 0; i < 6; i++) {
            users[i] = _fuzzUser(i);
            amounts[i] = bound(rawAmounts[i], MIN_BET, MAX_BET);
            _stake(users[i], id, rawOutcomes[i] % 3, amounts[i]);
        }

        vm.prank(resolver);
        market.voidMarket(id);

        for (uint256 i = 0; i < 6; i++) {
            vm.prank(users[i]);
            assertEq(market.refund(id), amounts[i]);
            assertEq(token.balanceOf(users[i]), START_BALANCE);
        }
        assertEq(token.balanceOf(address(market)), 0);
    }

    /// @dev One winner takes the whole pool minus the fee, with no rounding loss.
    function testFuzz_soleWinnerGetsPoolMinusFee(uint256 a, uint256 b, uint16 rawFee) public {
        a = bound(a, MIN_BET, MAX_BET);
        b = bound(b, MIN_BET, MAX_BET);
        uint16 feeBps = uint16(bound(uint256(rawFee), 0, 1_000));

        uint256 id = _create(2, feeBps);
        _stake(alice, id, 0, a);
        _stake(bob, id, 1, b);
        _resolve(id, 0);
        _finalize();

        vm.prank(alice);
        uint256 payout = market.claim(id);
        uint256 fee = ((a + b) * feeBps) / 10_000;
        assertEq(payout, a + b - fee);
    }
}
