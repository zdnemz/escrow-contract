// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title Escrow
 * @dev A trustless escrow contract for secure ETH transactions between a Buyer and a Seller,
 * with an optional Arbiter for dispute resolution.
 */
contract Escrow is ReentrancyGuard {
    using Address for address payable;

    // --- Enums ---

    enum State {
        AWAITING_PAYMENT,
        AWAITING_DELIVERY,
        COMPLETE,
        REFUNDED,
        DISPUTED
    }

    // --- State Variables ---

    address public immutable buyer;
    address public immutable seller;
    address public immutable arbiter;
    uint256 public immutable amount;

    State public state;

    // --- Events ---

    event Deposited(address indexed buyer, uint256 amount);
    event ConfirmDelivery(address indexed caller);
    event Refunded(address indexed caller, uint256 amount);
    event DisputeOpened(address indexed caller);
    event DisputeResolved(address indexed arbiter, address winner, uint256 amount);

    // --- Errors ---

    error OnlyBuyer();
    error OnlySeller();
    error OnlyArbiter();
    error OnlyBuyerOrArbiter();
    error OnlyBuyerOrSeller();
    error OnlyParticipant();
    error InvalidState(State current, State expected);
    error IncorrectAmount(uint256 sent, uint256 expected);
    error FundTransferFailed();

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
     * @notice Initializes the Escrow contract.
     * @param _buyer The address of the buyer (payer).
     * @param _seller The address of the seller (payee).
     * @param _arbiter The address of the arbiter (optional, can be address(0)).
     * @param _amount The amount of ETH to be escrowed.
     */
    constructor(
        address _buyer,
        address _seller,
        address _arbiter,
        uint256 _amount
    ) payable {
        require(_buyer != address(0), "Invalid buyer");
        require(_seller != address(0), "Invalid seller");
        // Arbiter can be address(0) if no dispute resolution is needed
        require(_amount > 0, "Amount must be > 0");

        buyer = _buyer;
        seller = _seller;
        arbiter = _arbiter;
        amount = _amount;

        if (msg.value > 0) {
            if (msg.value != _amount) revert IncorrectAmount(msg.value, _amount);
            state = State.AWAITING_DELIVERY;
            emit Deposited(msg.sender, msg.value);
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
        state = State.AWAITING_DELIVERY;
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Confirm delivery and release funds to the seller.
     * Can be called by the Buyer (happy path) or the Arbiter (if manual override needed).
     */
    function confirmDelivery() external nonReentrant inState(State.AWAITING_DELIVERY) {
        if (msg.sender != buyer && msg.sender != arbiter) revert OnlyBuyerOrArbiter();

        state = State.COMPLETE;
        payable(seller).sendValue(address(this).balance);
        emit ConfirmDelivery(msg.sender);
    }

    /**
     * @notice Refund funds to the buyer.
     * Can be called by the Seller (if they can't fulfill) or the Arbiter.
     */
    function refund() external nonReentrant inState(State.AWAITING_DELIVERY) {
        if (msg.sender != seller && msg.sender != arbiter) revert OnlyBuyerOrSeller(); // Logic check: actually usually Seller allows refund, or Arbiter enforces it.

        state = State.REFUNDED;
        payable(buyer).sendValue(address(this).balance);
        emit Refunded(msg.sender, address(this).balance);
    }

    /**
     * @notice Raise a dispute, locking the funds until Arbiter resolves it.
     * Can be called by Buyer or Seller.
     */
    function dispute() external inState(State.AWAITING_DELIVERY) {
        if (msg.sender != buyer && msg.sender != seller) revert OnlyBuyerOrSeller();
        if (arbiter == address(0)) revert("No arbiter set");

        state = State.DISPUTED;
        emit DisputeOpened(msg.sender);
    }

    /**
     * @notice Resolve a dispute by sending funds to the winner.
     * Only callable by the Arbiter.
     * @param winner The address to receive the funds (must be Buyer or Seller).
     */
    function resolveDispute(address winner) external nonReentrant onlyArbiter inState(State.DISPUTED) {
        require(winner == buyer || winner == seller, "Winner must be buyer or seller");
        
        uint256 balance = address(this).balance;
        
        if (winner == buyer) {
            state = State.REFUNDED;
        } else {
            state = State.COMPLETE;
        }

        payable(winner).sendValue(balance);
        emit DisputeResolved(msg.sender, winner, balance);
    }
}
