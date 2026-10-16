// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title NitroBetMarket (Full tier, v1)
 * @notice Parimutuel prediction markets paid in USDT0 (the ERC-20 side, 6 decimals).
 *
 * How money moves:
 *  - Players stake on one outcome. Everyone who picked the winner shares the losing side's pool.
 *  - The fee is taken ONLY from the losing side, so a winner always gets their stake back plus a share.
 *  - Nobody (including the owner) can take player stakes. Money leaves only through claim, refund and
 *    withdrawFees (and the fee is capped at MAX_FEE_BPS of the losing side).
 *  - If a market is cancelled, or nobody posts a result within RESOLVE_TIMEOUT, anyone can trigger refunds.
 *
 * Stable chain notes (USDT0 is both the gas coin and this token, on one balance):
 *  - This contract never approves anyone to spend its tokens, so no allowance-based drain is possible.
 *  - It has no payable functions and never sends to address(0) (those revert on Stable).
 *  - Accounting is per market in storage; it never reads address(this).balance.
 *
 * Trust assumptions (v1, be honest with players): the resolver (a multisig) posts the result, and may amend it
 * once or void the market during the dispute window. Not upgradeable. Not audited.
 */
contract NitroBetMarket is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    enum Status { None, Open, Resolved, Void }

    struct Market {
        Status status;
        uint8 outcomeCount;
        uint8 winningOutcome;
        bool amended;
        bool feeWithdrawn;
        uint16 feeBps;
        uint64 closesAt;
        uint64 disputeEndsAt;
        uint256 totalPool;
    }

    uint16 public constant MAX_FEE_BPS = 1000; // 10%, hard cap in code
    uint8 public constant MAX_OUTCOMES = 32;
    uint64 public constant DISPUTE_WINDOW = 24 hours;
    uint64 public constant RESOLVE_TIMEOUT = 7 days;
    bytes32 private constant ELIGIBILITY_TYPEHASH = keccak256("Eligibility(address player,uint64 deadline)");

    IERC20 public immutable token;
    uint256 public marketCount;

    address public resolver;
    address public guardian;
    address public complianceSigner;
    address public feeRecipient;
    bool public requirePermit;

    // Launch caps (token units, 6 decimals). Owner can change them; they only affect new stakes.
    uint256 public minStake = 1e6;
    uint256 public maxStakePerWallet = 50e6;
    uint256 public maxPoolPerMarket = 5_000e6;

    mapping(uint256 => Market) private _markets;
    mapping(uint256 => mapping(uint8 => uint256)) public outcomePool;
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public stakeOf;
    mapping(uint256 => mapping(address => uint256)) public totalStakeOf;
    mapping(uint256 => mapping(address => bool)) public settled; // claimed or refunded

    error ZeroAddress();
    error NotResolver();
    error NotGuardianOrOwner();
    error BadOutcomeCount();
    error BadOutcome();
    error BadTime();
    error FeeTooHigh();
    error BadLimits();
    error MarketNotOpen();
    error MarketClosed();
    error NotClosedYet();
    error ResolveTimedOut();
    error StakeTooSmall();
    error WalletCapExceeded();
    error PoolCapExceeded();
    error PermitExpired();
    error BadPermit();
    error NotResolved();
    error NotVoid();
    error DisputeWindowOpen();
    error DisputeWindowOver();
    error AlreadyAmended();
    error AlreadySettled();
    error NothingToClaim();
    error NoFees();
    error CannotVoid();
    error StillRunning();

    event MarketCreated(uint256 indexed id, uint8 outcomeCount, uint64 closesAt, uint16 feeBps, string title);
    event Staked(uint256 indexed id, address indexed player, uint8 indexed outcome, uint256 amount);
    event Resolved(uint256 indexed id, uint8 winningOutcome, uint64 disputeEndsAt);
    event Amended(uint256 indexed id, uint8 winningOutcome, uint64 disputeEndsAt);
    event Voided(uint256 indexed id, uint8 reason); // 1 resolver, 2 nobody backed the winner, 3 timed out
    event Claimed(uint256 indexed id, address indexed player, uint256 amount);
    event Refunded(uint256 indexed id, address indexed player, uint256 amount);
    event FeesWithdrawn(uint256 indexed id, address indexed to, uint256 amount);
    event ResolverChanged(address resolver);
    event GuardianChanged(address guardian);
    event ComplianceSignerChanged(address signer);
    event FeeRecipientChanged(address recipient);
    event RequirePermitChanged(bool required);
    event LimitsChanged(uint256 minStake, uint256 maxStakePerWallet, uint256 maxPoolPerMarket);

    modifier onlyResolver() {
        if (msg.sender != resolver) revert NotResolver();
        _;
    }

    constructor(
        IERC20 token_,
        address owner_,
        address resolver_,
        address guardian_,
        address feeRecipient_,
        address complianceSigner_,
        bool requirePermit_
    ) Ownable(owner_) EIP712("NitroBetMarket", "1") {
        if (address(token_) == address(0) || resolver_ == address(0) || guardian_ == address(0) || feeRecipient_ == address(0)) {
            revert ZeroAddress();
        }
        token = token_;
        resolver = resolver_;
        guardian = guardian_;
        feeRecipient = feeRecipient_;
        complianceSigner = complianceSigner_;
        requirePermit = requirePermit_;
    }

    // ------------------------------------------------------------------ players

    /**
     * @param deadline  Expiry of the eligibility permit (ignored while requirePermit is false).
     * @param signature EIP-712 signature by complianceSigner over Eligibility(msg.sender, deadline).
     */
    function stake(uint256 marketId, uint8 outcome, uint256 amount, uint64 deadline, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
    {
        Market storage m = _markets[marketId];
        if (m.status != Status.Open) revert MarketNotOpen();
        if (block.timestamp >= m.closesAt) revert MarketClosed();
        if (outcome >= m.outcomeCount) revert BadOutcome();
        if (amount < minStake) revert StakeTooSmall();
        _checkEligibility(msg.sender, deadline, signature);

        uint256 newTotal = totalStakeOf[marketId][msg.sender] + amount;
        if (newTotal > maxStakePerWallet) revert WalletCapExceeded();
        if (m.totalPool + amount > maxPoolPerMarket) revert PoolCapExceeded();

        totalStakeOf[marketId][msg.sender] = newTotal;
        stakeOf[marketId][outcome][msg.sender] += amount;
        outcomePool[marketId][outcome] += amount;
        m.totalPool += amount;
        emit Staked(marketId, msg.sender, outcome, amount);

        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// Winners pull their payout once the dispute window is over.
    function claim(uint256 marketId) external nonReentrant {
        Market storage m = _markets[marketId];
        if (m.status != Status.Resolved) revert NotResolved();
        if (block.timestamp < m.disputeEndsAt) revert DisputeWindowOpen();
        if (settled[marketId][msg.sender]) revert AlreadySettled();
        uint256 amount = _payout(marketId, m, msg.sender);
        if (amount == 0) revert NothingToClaim();

        settled[marketId][msg.sender] = true;
        emit Claimed(marketId, msg.sender, amount);
        token.safeTransfer(msg.sender, amount);
    }

    /// Everyone gets their full stake back from a void market.
    function refund(uint256 marketId) external nonReentrant {
        Market storage m = _markets[marketId];
        if (m.status != Status.Void) revert NotVoid();
        if (settled[marketId][msg.sender]) revert AlreadySettled();
        uint256 amount = totalStakeOf[marketId][msg.sender];
        if (amount == 0) revert NothingToClaim();

        settled[marketId][msg.sender] = true;
        emit Refunded(marketId, msg.sender, amount);
        token.safeTransfer(msg.sender, amount);
    }

    /// Anyone can void a market nobody resolved in time. This is the "operator disappeared" exit.
    function voidExpired(uint256 marketId) external {
        Market storage m = _markets[marketId];
        if (m.status != Status.Open) revert MarketNotOpen();
        if (block.timestamp <= uint256(m.closesAt) + RESOLVE_TIMEOUT) revert StillRunning();
        m.status = Status.Void;
        emit Voided(marketId, 3);
    }

    /// Anyone can send the fee of a finished market to the fee recipient. Only the fee, never player stakes.
    function withdrawFees(uint256 marketId) external nonReentrant {
        Market storage m = _markets[marketId];
        if (m.status != Status.Resolved) revert NotResolved();
        if (block.timestamp < m.disputeEndsAt) revert DisputeWindowOpen();
        if (m.feeWithdrawn) revert NoFees();
        uint256 fee = feeOf(marketId);
        if (fee == 0) revert NoFees();

        m.feeWithdrawn = true;
        emit FeesWithdrawn(marketId, feeRecipient, fee);
        token.safeTransfer(feeRecipient, fee);
    }

    // ----------------------------------------------------------------- operator

    function createMarket(string calldata title, uint8 outcomeCount, uint64 closesAt, uint16 feeBps)
        external
        onlyOwner
        whenNotPaused
        returns (uint256 id)
    {
        if (outcomeCount < 2 || outcomeCount > MAX_OUTCOMES) revert BadOutcomeCount();
        if (closesAt <= block.timestamp) revert BadTime();
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        id = ++marketCount;
        Market storage m = _markets[id];
        m.status = Status.Open;
        m.outcomeCount = outcomeCount;
        m.closesAt = closesAt;
        m.feeBps = feeBps;
        emit MarketCreated(id, outcomeCount, closesAt, feeBps, title);
    }

    // ----------------------------------------------------------------- resolver

    function resolve(uint256 marketId, uint8 winningOutcome) external onlyResolver {
        Market storage m = _markets[marketId];
        if (m.status != Status.Open) revert MarketNotOpen();
        if (block.timestamp < m.closesAt) revert NotClosedYet();
        if (block.timestamp > uint256(m.closesAt) + RESOLVE_TIMEOUT) revert ResolveTimedOut();
        if (winningOutcome >= m.outcomeCount) revert BadOutcome();

        if (outcomePool[marketId][winningOutcome] == 0) {
            m.status = Status.Void; // nobody backed the winner: refund everyone, no fee
            emit Voided(marketId, 2);
            return;
        }
        m.status = Status.Resolved;
        m.winningOutcome = winningOutcome;
        m.disputeEndsAt = uint64(block.timestamp) + DISPUTE_WINDOW;
        emit Resolved(marketId, winningOutcome, m.disputeEndsAt);
    }

    /// One correction is allowed, only inside the dispute window. It restarts the window.
    function amendResolution(uint256 marketId, uint8 newWinningOutcome) external onlyResolver {
        Market storage m = _markets[marketId];
        if (m.status != Status.Resolved) revert NotResolved();
        if (block.timestamp >= m.disputeEndsAt) revert DisputeWindowOver();
        if (m.amended) revert AlreadyAmended();
        if (newWinningOutcome >= m.outcomeCount || outcomePool[marketId][newWinningOutcome] == 0) revert BadOutcome();

        m.amended = true;
        m.winningOutcome = newWinningOutcome;
        m.disputeEndsAt = uint64(block.timestamp) + DISPUTE_WINDOW;
        emit Amended(marketId, newWinningOutcome, m.disputeEndsAt);
    }

    /// Cancel a market (race cancelled, result annulled). Allowed while open, or inside the dispute window.
    function voidMarket(uint256 marketId) external onlyResolver {
        Market storage m = _markets[marketId];
        if (m.status == Status.Open || (m.status == Status.Resolved && block.timestamp < m.disputeEndsAt)) {
            m.status = Status.Void;
            emit Voided(marketId, 1);
        } else {
            revert CannotVoid();
        }
    }

    // ------------------------------------------------------------------- admin

    function pause() external {
        if (msg.sender != guardian && msg.sender != owner()) revert NotGuardianOrOwner();
        _pause(); // blocks createMarket and stake only. Claims and refunds always work.
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setResolver(address a) external onlyOwner {
        if (a == address(0)) revert ZeroAddress();
        resolver = a;
        emit ResolverChanged(a);
    }

    function setGuardian(address a) external onlyOwner {
        if (a == address(0)) revert ZeroAddress();
        guardian = a;
        emit GuardianChanged(a);
    }

    function setFeeRecipient(address a) external onlyOwner {
        if (a == address(0)) revert ZeroAddress();
        feeRecipient = a;
        emit FeeRecipientChanged(a);
    }

    function setComplianceSigner(address a) external onlyOwner {
        complianceSigner = a;
        emit ComplianceSignerChanged(a);
    }

    function setRequirePermit(bool required) external onlyOwner {
        requirePermit = required;
        emit RequirePermitChanged(required);
    }

    function setLimits(uint256 minStake_, uint256 maxStakePerWallet_, uint256 maxPoolPerMarket_) external onlyOwner {
        if (minStake_ == 0 || maxStakePerWallet_ < minStake_ || maxPoolPerMarket_ < maxStakePerWallet_) revert BadLimits();
        minStake = minStake_;
        maxStakePerWallet = maxStakePerWallet_;
        maxPoolPerMarket = maxPoolPerMarket_;
        emit LimitsChanged(minStake_, maxStakePerWallet_, maxPoolPerMarket_);
    }

    // ------------------------------------------------------------------- views

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    /// Fee for a resolved market: feeBps of the LOSING side only.
    function feeOf(uint256 marketId) public view returns (uint256) {
        Market storage m = _markets[marketId];
        if (m.status != Status.Resolved) return 0;
        uint256 loserPool = m.totalPool - outcomePool[marketId][m.winningOutcome];
        return (loserPool * m.feeBps) / 10_000;
    }

    /// What `player` would receive from claim() or refund() (ignores whether it was already taken).
    function previewPayout(uint256 marketId, address player) external view returns (uint256) {
        Market storage m = _markets[marketId];
        if (m.status == Status.Resolved) return _payout(marketId, m, player);
        if (m.status == Status.Void) return totalStakeOf[marketId][player];
        return 0;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------------------------------------------------------- internals

    function _payout(uint256 marketId, Market storage m, address player) internal view returns (uint256) {
        uint256 mine = stakeOf[marketId][m.winningOutcome][player];
        if (mine == 0) return 0;
        uint256 winPool = outcomePool[marketId][m.winningOutcome];
        uint256 loserPool = m.totalPool - winPool;
        uint256 net = loserPool - (loserPool * m.feeBps) / 10_000;
        return mine + (net * mine) / winPool;
    }

    function _checkEligibility(address player, uint64 deadline, bytes calldata signature) internal view {
        if (!requirePermit) return;
        if (block.timestamp > deadline) revert PermitExpired();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(ELIGIBILITY_TYPEHASH, player, deadline)));
        address signer = ECDSA.recover(digest, signature);
        if (signer == address(0) || signer != complianceSigner) revert BadPermit();
    }
}
