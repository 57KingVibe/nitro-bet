// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title NitroBetMarket
/// @notice Parimutuel prediction markets settled in one ERC-20 (USDT0, 6 decimals).
///         Winners split the whole pool minus a fee fixed at market creation. No house risk.
/// @dev    Uses the ERC-20 interface only. Native value is never accepted or sent
///         (no payable functions, no receive/fallback). Not upgradeable.
///
///         Lifecycle of a market:
///           Open     -> players stake until closeTime
///           Resolved -> resolver (Safe 2-of-3) posts the winner after closeTime and within
///                       REFUND_AFTER; for DISPUTE_WINDOW the resolver may correct or void it
///           Final    -> after the dispute window: winners claim, owner withdraws the fee
///           Voided   -> everyone gets their stake back (resolver void, or anyone after
///                       closeTime + REFUND_AFTER if nobody resolved)
///         Pause stops new markets and new stakes only. resolve/claim/refund always work.
contract NitroBetMarket is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    enum State {
        None,
        Open,
        Resolved,
        Voided
    }

    struct Market {
        State state;
        uint8 numOutcomes;
        uint8 winningOutcome;
        bool feesWithdrawn;
        uint16 feeBps;
        uint64 closeTime;
        uint64 resolvedAt;
        uint256 minBet;
        uint256 maxBet;
        uint256 maxPool;
        uint256 totalPool;
    }

    struct MarketParams {
        uint8 numOutcomes;
        uint16 feeBps;
        uint64 closeTime;
        uint256 minBet;
        uint256 maxBet;
        uint256 maxPool;
        bytes32 metadataHash; // hash of off-chain market description (event, outcome names)
    }

    // Signed by `permitSigner` (the NitroBet server) after KYC / country checks.
    // All fields are static, so abi.encode(typehash, permit) equals the flat EIP-712 encoding.
    struct StakePermit {
        address user;
        uint256 marketId;
        uint8 outcome;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint16 public constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 1_000; // hard cap 10%
    uint8 public constant MAX_OUTCOMES = 32;
    uint64 public constant DISPUTE_WINDOW = 24 hours;
    uint64 public constant REFUND_AFTER = 7 days;

    bytes32 public constant STAKE_PERMIT_TYPEHASH = keccak256(
        "StakePermit(address user,uint256 marketId,uint8 outcome,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The ERC-20 used for stakes (USDT0 ERC-20 view, 6 decimals). Never native value.
    IERC20 public immutable token;
    /// @notice Address allowed to post / correct / void results (the Safe). Fixed in v1.
    address public immutable resolver;
    /// @notice Server key whose EIP-712 permits authorise stakes. Rotatable by the owner.
    address public permitSigner;
    /// @notice Where withdrawFees sends the fee.
    address public feeRecipient;

    uint256 public marketCount;

    mapping(uint256 marketId => Market) private _markets;
    mapping(uint256 marketId => mapping(uint8 outcome => uint256)) public outcomePool;
    mapping(uint256 marketId => mapping(address user => mapping(uint8 outcome => uint256))) public stakeOf;
    mapping(uint256 marketId => mapping(address user => uint256)) public totalStakeOf;
    /// @notice True once a user has claimed or been refunded for a market.
    mapping(uint256 marketId => mapping(address user => bool)) public settled;
    mapping(address user => uint256) public nonces;

    /*//////////////////////////////////////////////////////////////
                             EVENTS / ERRORS
    //////////////////////////////////////////////////////////////*/

    event MarketCreated(
        uint256 indexed marketId,
        uint8 numOutcomes,
        uint16 feeBps,
        uint64 closeTime,
        uint256 minBet,
        uint256 maxBet,
        uint256 maxPool,
        bytes32 metadataHash
    );
    event Staked(uint256 indexed marketId, address indexed user, uint8 indexed outcome, uint256 amount);
    event MarketResolved(uint256 indexed marketId, uint8 winningOutcome, uint64 resolvedAt);
    event MarketVoided(uint256 indexed marketId, address indexed by);
    event Claimed(uint256 indexed marketId, address indexed user, uint256 payout);
    event Refunded(uint256 indexed marketId, address indexed user, uint256 amount);
    event FeesWithdrawn(uint256 indexed marketId, address indexed to, uint256 amount);
    event PermitSignerUpdated(address indexed newSigner);
    event FeeRecipientUpdated(address indexed newRecipient);

    error ZeroAddress();
    error NotResolver();
    error BadOutcomeCount();
    error FeeTooHigh();
    error BadCloseTime();
    error BadCaps();
    error MarketNotOpen();
    error StakingClosed();
    error BadOutcome();
    error BetOutOfRange();
    error PoolCapExceeded();
    error PermitExpired();
    error InvalidPermit();
    error UnexpectedTransferAmount();
    error MarketNotClosed();
    error ResolutionExpired();
    error NotResolvable();
    error NotResolved();
    error DisputeWindowOpen();
    error Finalized();
    error NoContest();
    error NotRefundable();
    error AlreadySettled();
    error NothingToClaim();
    error FeesAlreadyWithdrawn();
    error RenounceDisabled();

    modifier onlyResolver() {
        if (msg.sender != resolver) revert NotResolver();
        _;
    }

    constructor(IERC20 token_, address owner_, address resolver_, address permitSigner_, address feeRecipient_)
        Ownable(owner_)
        EIP712("NitroBet", "1")
    {
        if (
            address(token_) == address(0) || resolver_ == address(0) || permitSigner_ == address(0)
                || feeRecipient_ == address(0)
        ) revert ZeroAddress();
        token = token_;
        resolver = resolver_;
        permitSigner = permitSigner_;
        feeRecipient = feeRecipient_;
    }

    /*//////////////////////////////////////////////////////////////
                               OWNER ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a market. The fee is fixed here so players see it before staking.
    function createMarket(MarketParams calldata p) external onlyOwner whenNotPaused returns (uint256 marketId) {
        if (p.numOutcomes < 2 || p.numOutcomes > MAX_OUTCOMES) revert BadOutcomeCount();
        if (p.feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (p.closeTime <= block.timestamp) revert BadCloseTime();
        if (p.minBet == 0 || p.minBet > p.maxBet || p.maxBet > p.maxPool) revert BadCaps();

        marketId = ++marketCount;
        Market storage m = _markets[marketId];
        m.state = State.Open;
        m.numOutcomes = p.numOutcomes;
        m.feeBps = p.feeBps;
        m.closeTime = p.closeTime;
        m.minBet = p.minBet;
        m.maxBet = p.maxBet;
        m.maxPool = p.maxPool;

        emit MarketCreated(
            marketId, p.numOutcomes, p.feeBps, p.closeTime, p.minBet, p.maxBet, p.maxPool, p.metadataHash
        );
    }

    /// @notice Send a finalised market's fee to feeRecipient. Never available for voided or no-contest markets.
    function withdrawFees(uint256 marketId) external onlyOwner nonReentrant returns (uint256 fee) {
        Market storage m = _markets[marketId];
        if (m.state != State.Resolved) revert NotResolved();
        if (block.timestamp < uint256(m.resolvedAt) + DISPUTE_WINDOW) revert DisputeWindowOpen();
        if (_isNoContest(marketId, m)) revert NoContest();
        if (m.feesWithdrawn) revert FeesAlreadyWithdrawn();

        m.feesWithdrawn = true;
        fee = _fee(m);
        address to = feeRecipient;
        token.safeTransfer(to, fee);
        emit FeesWithdrawn(marketId, to, fee);
    }

    /// @notice Stops createMarket and stake. Never blocks resolve, claim, refund or withdrawFees.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setPermitSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        permitSigner = newSigner;
        emit PermitSignerUpdated(newSigner);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    /// @dev Renouncing would brick market creation, pause and fee withdrawal.
    function renounceOwnership() public pure override {
        revert RenounceDisabled();
    }

    /*//////////////////////////////////////////////////////////////
                              RESOLVER ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Post the winner (after closeTime, at most REFUND_AFTER later), or correct it
    ///         while the dispute window is still open. The window is not extended by a correction.
    function resolve(uint256 marketId, uint8 winningOutcome) external onlyResolver {
        Market storage m = _markets[marketId];
        if (winningOutcome >= m.numOutcomes) revert BadOutcome();

        State s = m.state;
        if (s == State.Open) {
            if (block.timestamp < m.closeTime) revert MarketNotClosed();
            if (block.timestamp > uint256(m.closeTime) + REFUND_AFTER) revert ResolutionExpired();
            m.state = State.Resolved;
            m.resolvedAt = uint64(block.timestamp);
        } else if (s == State.Resolved) {
            if (block.timestamp >= uint256(m.resolvedAt) + DISPUTE_WINDOW) revert Finalized();
        } else {
            revert NotResolvable();
        }

        m.winningOutcome = winningOutcome;
        emit MarketResolved(marketId, winningOutcome, m.resolvedAt);
    }

    /// @notice Cancel a market (event cancelled, wrong result found). Everyone is refunded.
    ///         Possible while Open, or while Resolved and the dispute window is open.
    function voidMarket(uint256 marketId) external onlyResolver {
        Market storage m = _markets[marketId];
        State s = m.state;
        if (s == State.Resolved) {
            if (block.timestamp >= uint256(m.resolvedAt) + DISPUTE_WINDOW) revert Finalized();
        } else if (s != State.Open) {
            revert NotResolvable();
        }
        m.state = State.Voided;
        emit MarketVoided(marketId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                               PLAYER ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Stake `amount` on `outcome`. Needs a server-signed permit and a prior token approval.
    function stake(uint256 marketId, uint8 outcome, uint256 amount, uint256 deadline, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
    {
        Market storage m = _markets[marketId];
        if (m.state != State.Open) revert MarketNotOpen();
        if (block.timestamp >= m.closeTime) revert StakingClosed();
        if (outcome >= m.numOutcomes) revert BadOutcome();
        if (amount < m.minBet || amount > m.maxBet) revert BetOutOfRange();
        uint256 newPool = m.totalPool + amount;
        if (newPool > m.maxPool) revert PoolCapExceeded();

        _consumePermit(marketId, outcome, amount, deadline, signature);

        m.totalPool = newPool;
        outcomePool[marketId][outcome] += amount;
        stakeOf[marketId][msg.sender][outcome] += amount;
        totalStakeOf[marketId][msg.sender] += amount;

        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - balanceBefore != amount) revert UnexpectedTransferAmount();

        emit Staked(marketId, msg.sender, outcome, amount);
    }

    /// @notice Claim winnings once the market is final. Payout = stake * (pool - fee) / winningPool, rounded down.
    function claim(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage m = _markets[marketId];
        if (m.state != State.Resolved) revert NotResolved();
        if (block.timestamp < uint256(m.resolvedAt) + DISPUTE_WINDOW) revert DisputeWindowOpen();
        if (_isNoContest(marketId, m)) revert NoContest();
        if (settled[marketId][msg.sender]) revert AlreadySettled();

        uint8 winner = m.winningOutcome;
        uint256 userStake = stakeOf[marketId][msg.sender][winner];
        if (userStake == 0) revert NothingToClaim();

        settled[marketId][msg.sender] = true;
        payout = (userStake * (m.totalPool - _fee(m))) / outcomePool[marketId][winner];
        token.safeTransfer(msg.sender, payout);
        emit Claimed(marketId, msg.sender, payout);
    }

    /// @notice Get your full stake back. Available when the market is voided, when nobody resolved it
    ///         within REFUND_AFTER of closeTime (this call then voids it), or when it ended with no contest.
    function refund(uint256 marketId) external nonReentrant returns (uint256 amount) {
        Market storage m = _markets[marketId];
        State s = m.state;
        if (s == State.Open) {
            _voidIfExpired(marketId, m);
        } else if (s == State.Resolved) {
            if (block.timestamp < uint256(m.resolvedAt) + DISPUTE_WINDOW) revert DisputeWindowOpen();
            if (!_isNoContest(marketId, m)) revert NotRefundable();
        } else if (s != State.Voided) {
            revert NotRefundable();
        }

        if (settled[marketId][msg.sender]) revert AlreadySettled();
        amount = totalStakeOf[marketId][msg.sender];
        if (amount == 0) revert NothingToClaim();

        settled[marketId][msg.sender] = true;
        token.safeTransfer(msg.sender, amount);
        emit Refunded(marketId, msg.sender, amount);
    }

    /// @notice Anyone can void a market nobody resolved within REFUND_AFTER of closeTime.
    function triggerRefund(uint256 marketId) external {
        Market storage m = _markets[marketId];
        if (m.state != State.Open) revert NotRefundable();
        _voidIfExpired(marketId, m);
    }

    /*//////////////////////////////////////////////////////////////
                                   VIEWS
    //////////////////////////////////////////////////////////////*/

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    /// @notice Fee (in token units) the market pays if it ends with a winner, at the current pool size.
    function feeOf(uint256 marketId) external view returns (uint256) {
        return _fee(_markets[marketId]);
    }

    function isFinalized(uint256 marketId) external view returns (bool) {
        Market storage m = _markets[marketId];
        return m.state == State.Resolved && block.timestamp >= uint256(m.resolvedAt) + DISPUTE_WINDOW;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /*//////////////////////////////////////////////////////////////
                                  INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _fee(Market storage m) private view returns (uint256) {
        return (m.totalPool * m.feeBps) / BPS;
    }

    /// @dev No contest = nobody backed the winner, or everybody did. There is no losing side to pay
    ///      the winners, so stakes are refunded and no fee is taken.
    function _isNoContest(uint256 marketId, Market storage m) private view returns (bool) {
        uint256 winningPool = outcomePool[marketId][m.winningOutcome];
        return winningPool == 0 || winningPool == m.totalPool;
    }

    function _voidIfExpired(uint256 marketId, Market storage m) private {
        if (block.timestamp <= uint256(m.closeTime) + REFUND_AFTER) revert NotRefundable();
        m.state = State.Voided;
        emit MarketVoided(marketId, msg.sender);
    }

    function _consumePermit(uint256 marketId, uint8 outcome, uint256 amount, uint256 deadline, bytes calldata signature)
        private
    {
        if (block.timestamp > deadline) revert PermitExpired();

        StakePermit memory permit;
        permit.user = msg.sender;
        permit.marketId = marketId;
        permit.outcome = outcome;
        permit.amount = amount;
        permit.nonce = nonces[msg.sender];
        permit.deadline = deadline;

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(STAKE_PERMIT_TYPEHASH, permit)));
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != permitSigner) revert InvalidPermit();

        nonces[msg.sender] = permit.nonce + 1;
    }
}
