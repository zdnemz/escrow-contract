// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title Escrow
 * @author Dispute-Minimized Upgrade
 * @notice A trustless escrow contract with deadline-based auto-resolution.
 * @dev Escrow outcomes are deterministically derivable from on-chain state and time.
 *      No escrow remains indefinitely locked due to user inactivity.
 */
contract Escrow is ReentrancyGuard {
    using Address for address payable;

    // --- Enums ---

    /// @notice Monotonic, irreversible state machine
    enum State {
        AWAITING_PAYMENT,  // 0: Contract created, awaiting buyer deposit
        FUNDED,            // 1: Buyer deposited, awaiting seller delivery
        DELIVERED,         // 2: Seller marked delivery, buyer review period active
        COMPLETE,          // 3: Funds released to seller (terminal)
        REFUNDED,          // 4: Funds returned to buyer (terminal)
        DISPUTED           // 5: Dispute raised, awaiting arbiter resolution
    }

    // --- State Variables ---

    address public immutable buyer;
    address public immutable seller;
    address public immutable arbiter;
    uint256 public immutable amount;
    
    /// @notice Deadline by which seller must mark delivery (Unix timestamp)
    uint256 public immutable deliveryDeadline;
    
    /// @notice Duration (seconds) buyer has to approve/dispute after delivery
    uint256 public immutable reviewPeriod;

    State public state;
    
    /// @notice Timestamp when seller marked delivery (0 if not yet delivered)
    uint256 public deliveredAt;

    // --- Events ---

    event Deposited(address indexed buyer, uint256 amount);
    event DeliveryMarked(address indexed seller, uint256 timestamp);
    event DeliveryConfirmed(address indexed buyer);
    event Refunded(address indexed caller, uint256 amount);
    event AutoReleased(address indexed caller, uint256 amount);
    event AutoRefunded(address indexed caller, uint256 amount);
    event DisputeOpened(address indexed caller);
    event DisputeResolved(address indexed arbiter, address winner, uint256 amount);

    // --- Errors ---

    error OnlyBuyer();
    error OnlySeller();
    error OnlyArbiter();
    error OnlyBuyerOrSeller();
    error InvalidState(State current, State expected);
    error IncorrectAmount(uint256 sent, uint256 expected);
    error DeliveryDeadlineNotPassed();
    error DeliveryDeadlinePassed();
    error ReviewPeriodNotEnded();
    error ReviewPeriodEnded();
    error NoArbiterSet();
    error InvalidWinner();

    // --- Modifiers ---

    modifier onlyBuyer() {
        if (msg.sender != buyer) revert OnlyBuyer();
        _;
    }

    modifier onlySeller() {
        if (msg.sender != seller) revert OnlySeller();
        _;
    }

    modifier onlyArbiter() {
        if (msg.sender != arbiter) revert OnlyArbiter();
        _;
    }

    modifier inState(State _state) {
        if (state != _state) revert InvalidState(state, _state);
        _;
    }

    // --- Constructor ---

    /**
     * @notice Initializes the Escrow contract with deadline parameters.
     * @param _buyer The address of the buyer (payer).
     * @param _seller The address of the seller (payee).
     * @param _arbiter The address of the arbiter.
     * @param _amount The amount of ETH to be escrowed.
     * @param _deliveryDeadline Unix timestamp by which seller must mark delivery.
     * @param _reviewPeriod Duration in seconds for buyer review after delivery.
     */
    constructor(
        address _buyer,
        address _seller,
        address _arbiter,
        uint256 _amount,
        uint256 _deliveryDeadline,
        uint256 _reviewPeriod
    ) payable {
        require(_buyer != address(0), "Invalid buyer");
        require(_seller != address(0), "Invalid seller");
        require(_amount > 0, "Amount must be > 0");
        require(_deliveryDeadline > block.timestamp, "Deadline must be future");
        require(_reviewPeriod > 0, "Review period must be > 0");

        buyer = _buyer;
        seller = _seller;
        arbiter = _arbiter;
        amount = _amount;
        deliveryDeadline = _deliveryDeadline;
        reviewPeriod = _reviewPeriod;

        if (msg.value > 0) {
            if (msg.value != _amount) revert IncorrectAmount(msg.value, _amount);
            state = State.FUNDED;
            emit Deposited(_buyer, msg.value);
        } else {
            state = State.AWAITING_PAYMENT;
        }
    }

    // --- Core Functions ---

    /**
     * @notice Buyer deposits the funds into the escrow.
     */
    function deposit() external payable onlyBuyer inState(State.AWAITING_PAYMENT) {
        if (msg.value != amount) revert IncorrectAmount(msg.value, amount);
        state = State.FUNDED;
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Seller marks the order as delivered. Starts the buyer review period.
     * @dev Must be called before deliveryDeadline.
     */
    function markDelivered() external onlySeller inState(State.FUNDED) {
        if (block.timestamp > deliveryDeadline) revert DeliveryDeadlinePassed();
        
        state = State.DELIVERED;
        deliveredAt = block.timestamp;
        emit DeliveryMarked(msg.sender, block.timestamp);
    }

    /**
     * @notice Buyer confirms delivery and releases funds to seller.
     * @dev Only callable during review period.
     */
    function confirmDelivery() external nonReentrant onlyBuyer inState(State.DELIVERED) {
        if (block.timestamp > deliveredAt + reviewPeriod) revert ReviewPeriodEnded();
        
        state = State.COMPLETE;
        payable(seller).sendValue(address(this).balance);
        emit DeliveryConfirmed(msg.sender);
    }

    /**
     * @notice Seller voluntarily refunds the buyer.
     */
    function refund() external nonReentrant onlySeller inState(State.FUNDED) {
        state = State.REFUNDED;
        uint256 balance = address(this).balance;
        payable(buyer).sendValue(balance);
        emit Refunded(msg.sender, balance);
    }

    // --- Timeout Functions ---

    /**
     * @notice Auto-release funds to seller if buyer didn't respond within review period.
     * @dev Can be called by anyone after review period ends.
     */
    function claimByTimeout() external nonReentrant inState(State.DELIVERED) {
        if (block.timestamp <= deliveredAt + reviewPeriod) revert ReviewPeriodNotEnded();
        
        state = State.COMPLETE;
        uint256 balance = address(this).balance;
        payable(seller).sendValue(balance);
        emit AutoReleased(msg.sender, balance);
    }

    /**
     * @notice Buyer claims refund if seller didn't deliver before deadline.
     * @dev Only callable after deliveryDeadline has passed without delivery.
     */
    function claimRefundByTimeout() external nonReentrant onlyBuyer inState(State.FUNDED) {
        if (block.timestamp <= deliveryDeadline) revert DeliveryDeadlineNotPassed();
        
        state = State.REFUNDED;
        uint256 balance = address(this).balance;
        payable(buyer).sendValue(balance);
        emit AutoRefunded(msg.sender, balance);
    }

    // --- Dispute Functions ---

    /**
     * @notice Raise a dispute during the review period.
     * @dev Only buyer or seller can dispute. Arbiter must be set.
     */
    function dispute() external inState(State.DELIVERED) {
        if (msg.sender != buyer && msg.sender != seller) revert OnlyBuyerOrSeller();
        if (arbiter == address(0)) revert NoArbiterSet();
        if (block.timestamp > deliveredAt + reviewPeriod) revert ReviewPeriodEnded();

        state = State.DISPUTED;
        emit DisputeOpened(msg.sender);
    }

    /**
     * @notice Arbiter resolves a dispute by sending funds to the winner.
     * @param winner The address to receive the funds (must be buyer or seller).
     */
    function resolveDispute(address winner) external nonReentrant onlyArbiter inState(State.DISPUTED) {
        if (winner != buyer && winner != seller) revert InvalidWinner();
        
        uint256 balance = address(this).balance;
        
        if (winner == buyer) {
            state = State.REFUNDED;
        } else {
            state = State.COMPLETE;
        }

        payable(winner).sendValue(balance);
        emit DisputeResolved(msg.sender, winner, balance);
    }

    // --- View Functions ---

    /**
     * @notice Returns the deadline for buyer to respond after delivery.
     * @return Unix timestamp, or 0 if not yet delivered.
     */
    function reviewDeadline() external view returns (uint256) {
        if (deliveredAt == 0) return 0;
        return deliveredAt + reviewPeriod;
    }

    /**
     * @notice Check if the escrow can be auto-released to seller.
     */
    function canClaimByTimeout() external view returns (bool) {
        return state == State.DELIVERED && block.timestamp > deliveredAt + reviewPeriod;
    }

    /**
     * @notice Check if the buyer can claim refund due to seller timeout.
     */
    function canClaimRefundByTimeout() external view returns (bool) {
        return state == State.FUNDED && block.timestamp > deliveryDeadline;
    }
}
