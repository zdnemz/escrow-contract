// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title Escrow
 * @author Gas Abstraction + Arbiter Fee Upgrade
 * @notice Escrow contract with meta-transaction support for gasless UX and flat arbiter fee.
 * @dev Buyer pre-funds escrowAmount + gasPool + arbiterFee. Arbiter/Relayer executes all
 *      actions via signed messages. Seller never pays gas. Arbiter fee paid once at finalization.
 */
contract Escrow is ReentrancyGuard, EIP712 {
    using Address for address payable;
    using ECDSA for bytes32;

    // --- Enums ---

    enum State {
        AWAITING_PAYMENT,  // 0: Contract created, awaiting buyer deposit
        FUNDED,            // 1: Buyer deposited, awaiting seller delivery
        DELIVERED,         // 2: Seller marked delivery, buyer review period active
        COMPLETE,          // 3: Funds released to seller (terminal)
        REFUNDED,          // 4: Funds returned to buyer (terminal)
        DISPUTED           // 5: Dispute raised, awaiting arbiter resolution
    }

    enum ActionType {
        MARK_DELIVERED,    // 0: Seller marks delivery
        CONFIRM_DELIVERY,  // 1: Buyer confirms and releases funds
        REQUEST_REFUND,    // 2: Seller initiates refund
        RAISE_DISPUTE      // 3: Buyer or Seller raises dispute
    }

    // --- Type Hashes ---

    bytes32 public constant ESCROW_ACTION_TYPEHASH = keccak256(
        "EscrowAction(uint8 actionType,uint256 nonce,uint256 deadline)"
    );

    // --- Immutable State Variables ---

    address public immutable buyer;
    address public immutable seller;
    address public immutable arbiter; // Also acts as the authorized relayer
    uint256 public immutable escrowAmount;
    uint256 public immutable deliveryDeadline;
    uint256 public immutable reviewPeriod;
    uint256 public immutable maxGasPrice;
    uint256 public immutable maxGasPerAction;
    uint256 public immutable arbiterFee;

    // --- Mutable State Variables ---

    State public state;
    uint256 public deliveredAt;
    uint256 public gasPoolBalance;
    bool public arbiterFeePaid;

    /// @notice Nonces per signer per action type: nonces[signer][actionType]
    mapping(address => mapping(ActionType => uint256)) public nonces;

    // --- Events ---

    event Deposited(address indexed buyer, uint256 escrowAmount, uint256 gasPool);
    event DeliveryMarked(address indexed seller, uint256 timestamp);
    event DeliveryConfirmed(address indexed buyer);
    event Refunded(address indexed initiator, uint256 amount);
    event AutoReleased(address indexed caller, uint256 amount);
    event AutoRefunded(address indexed caller, uint256 amount);
    event DisputeOpened(address indexed initiator);
    event DisputeResolved(address indexed arbiter, address winner, uint256 amount);
    event GasReimbursed(address indexed relayer, uint256 amount);
    event GasPoolRefunded(address indexed buyer, uint256 amount);
    event MetaActionExecuted(address indexed signer, ActionType actionType, uint256 nonce);
    event ArbiterFeePaid(address indexed arbiter, uint256 amount);

    // --- Errors ---

    error OnlyBuyer();
    error OnlySeller();
    error OnlyArbiter();
    error OnlyRelayer();
    error OnlyBuyerOrSeller();
    error InvalidState(State current, State expected);
    error IncorrectAmount(uint256 sent, uint256 expected);
    error DeliveryDeadlineNotPassed();
    error DeliveryDeadlinePassed();
    error ReviewPeriodNotEnded();
    error ReviewPeriodEnded();
    error NoArbiterSet();
    error InvalidWinner();
    error InvalidSignature();
    error SignatureExpired();
    error InvalidNonce();
    error InsufficientGasPool();
    error InvalidSigner();
    error ArbiterFeeAlreadyPaid();

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

    /// @notice Only the arbiter (who is also the relayer) can execute meta-transactions
    modifier onlyRelayer() {
        if (msg.sender != arbiter) revert OnlyRelayer();
        _;
    }

    modifier inState(State _state) {
        if (state != _state) revert InvalidState(state, _state);
        _;
    }

    // --- Constructor ---

    /**
     * @notice Initializes the Escrow contract with gas abstraction and arbiter fee.
     * @param _buyer The address of the buyer (payer).
     * @param _seller The address of the seller (payee).
     * @param _arbiter The address of the arbiter (also relayer).
     * @param _escrowAmount The amount of ETH to be escrowed for the transaction.
     * @param _deliveryDeadline Unix timestamp by which seller must mark delivery.
     * @param _reviewPeriod Duration in seconds for buyer review after delivery.
     * @param _maxGasPrice Maximum gas price for reimbursement (wei).
     * @param _maxGasPerAction Maximum gas units reimbursable per action.
     * @param _arbiterFee Flat fee paid to arbiter at escrow finalization.
     */
    constructor(
        address _buyer,
        address _seller,
        address _arbiter,
        uint256 _escrowAmount,
        uint256 _deliveryDeadline,
        uint256 _reviewPeriod,
        uint256 _maxGasPrice,
        uint256 _maxGasPerAction,
        uint256 _arbiterFee
    ) payable EIP712("Escrow", "1") {
        require(_buyer != address(0), "Invalid buyer");
        require(_seller != address(0), "Invalid seller");
        require(_arbiter != address(0), "Invalid arbiter/relayer");
        require(_escrowAmount > 0, "Escrow amount must be > 0");
        require(_deliveryDeadline > block.timestamp, "Deadline must be future");
        require(_reviewPeriod > 0, "Review period must be > 0");
        require(_maxGasPrice > 0, "Max gas price must be > 0");
        require(_maxGasPerAction > 0, "Max gas per action must be > 0");

        buyer = _buyer;
        seller = _seller;
        arbiter = _arbiter;
        escrowAmount = _escrowAmount;
        deliveryDeadline = _deliveryDeadline;
        reviewPeriod = _reviewPeriod;
        maxGasPrice = _maxGasPrice;
        maxGasPerAction = _maxGasPerAction;
        arbiterFee = _arbiterFee;

        if (msg.value > 0) {
            // Buyer deposits escrowAmount + arbiterFee + gasPool in one transaction
            require(msg.value > _escrowAmount + _arbiterFee, "Must include gas pool");
            gasPoolBalance = msg.value - _escrowAmount - _arbiterFee;
            state = State.FUNDED;
            emit Deposited(_buyer, _escrowAmount, gasPoolBalance);
        } else {
            state = State.AWAITING_PAYMENT;
        }
    }

    // --- Core Functions (Direct Calls) ---

    /**
     * @notice Buyer deposits the escrow amount, arbiter fee, plus gas pool.
     * @param _gasPool The amount allocated for gas reimbursement.
     */
    function deposit(uint256 _gasPool) external payable onlyBuyer inState(State.AWAITING_PAYMENT) {
        if (msg.value != escrowAmount + arbiterFee + _gasPool) {
            revert IncorrectAmount(msg.value, escrowAmount + arbiterFee + _gasPool);
        }
        gasPoolBalance = _gasPool;
        state = State.FUNDED;
        emit Deposited(msg.sender, escrowAmount, _gasPool);
    }

    // --- Meta-Transaction Functions ---

    /**
     * @notice Execute a meta-transaction to mark delivery (signed by seller).
     * @param signature EIP-712 signature from the seller.
     * @param nonce The expected nonce for this action.
     * @param deadline Signature expiry timestamp.
     */
    function metaMarkDelivered(
        bytes calldata signature,
        uint256 nonce,
        uint256 deadline
    ) external nonReentrant onlyRelayer inState(State.FUNDED) {
        uint256 startGas = gasleft();
        
        // Verify deadline
        if (block.timestamp > deadline) revert SignatureExpired();
        
        // Verify delivery deadline hasn't passed
        if (block.timestamp > deliveryDeadline) revert DeliveryDeadlinePassed();
        
        // Verify signature from seller
        _verifySignature(seller, ActionType.MARK_DELIVERED, nonce, deadline, signature);
        
        // Execute action
        state = State.DELIVERED;
        deliveredAt = block.timestamp;
        
        emit DeliveryMarked(seller, block.timestamp);
        emit MetaActionExecuted(seller, ActionType.MARK_DELIVERED, nonce);
        
        // Reimburse gas
        _reimburseGas(startGas);
    }

    /**
     * @notice Execute a meta-transaction to confirm delivery (signed by buyer).
     * @param signature EIP-712 signature from the buyer.
     * @param nonce The expected nonce for this action.
     * @param deadline Signature expiry timestamp.
     */
    function metaConfirmDelivery(
        bytes calldata signature,
        uint256 nonce,
        uint256 deadline
    ) external nonReentrant onlyRelayer inState(State.DELIVERED) {
        uint256 startGas = gasleft();
        
        // Verify deadline
        if (block.timestamp > deadline) revert SignatureExpired();
        
        // Verify review period hasn't ended
        if (block.timestamp > deliveredAt + reviewPeriod) revert ReviewPeriodEnded();
        
        // Verify signature from buyer
        _verifySignature(buyer, ActionType.CONFIRM_DELIVERY, nonce, deadline, signature);
        
        // Execute action
        state = State.COMPLETE;
        
        emit DeliveryConfirmed(buyer);
        emit MetaActionExecuted(buyer, ActionType.CONFIRM_DELIVERY, nonce);
        
        // Reimburse gas first
        _reimburseGas(startGas);
        
        // Pay arbiter fee (one-time)
        _payArbiterFee();
        
        // Refund remaining gas pool to buyer
        _refundGasPool();
        
        // Transfer escrow to seller
        payable(seller).sendValue(escrowAmount);
    }

    /**
     * @notice Execute a meta-transaction for seller to voluntarily refund (signed by seller).
     * @param signature EIP-712 signature from the seller.
     * @param nonce The expected nonce for this action.
     * @param deadline Signature expiry timestamp.
     */
    function metaRefund(
        bytes calldata signature,
        uint256 nonce,
        uint256 deadline
    ) external nonReentrant onlyRelayer inState(State.FUNDED) {
        uint256 startGas = gasleft();
        
        // Verify deadline
        if (block.timestamp > deadline) revert SignatureExpired();
        
        // Verify signature from seller
        _verifySignature(seller, ActionType.REQUEST_REFUND, nonce, deadline, signature);
        
        // Execute action
        state = State.REFUNDED;
        
        emit Refunded(seller, escrowAmount);
        emit MetaActionExecuted(seller, ActionType.REQUEST_REFUND, nonce);
        
        // Reimburse gas first
        _reimburseGas(startGas);
        
        // Pay arbiter fee (one-time)
        _payArbiterFee();
        
        // Refund remaining gas pool + escrow to buyer
        uint256 totalRefund = escrowAmount + gasPoolBalance;
        gasPoolBalance = 0;
        payable(buyer).sendValue(totalRefund);
    }

    /**
     * @notice Execute a meta-transaction to raise a dispute (signed by buyer or seller).
     * @param signer The address that signed (must be buyer or seller).
     * @param signature EIP-712 signature from the signer.
     * @param nonce The expected nonce for this action.
     * @param deadline Signature expiry timestamp.
     */
    function metaDispute(
        address signer,
        bytes calldata signature,
        uint256 nonce,
        uint256 deadline
    ) external nonReentrant onlyRelayer inState(State.DELIVERED) {
        uint256 startGas = gasleft();
        
        // Verify signer is buyer or seller
        if (signer != buyer && signer != seller) revert InvalidSigner();
        
        // Verify deadline
        if (block.timestamp > deadline) revert SignatureExpired();
        
        // Verify review period hasn't ended
        if (block.timestamp > deliveredAt + reviewPeriod) revert ReviewPeriodEnded();
        
        // Verify arbiter is set
        if (arbiter == address(0)) revert NoArbiterSet();
        
        // Verify signature
        _verifySignature(signer, ActionType.RAISE_DISPUTE, nonce, deadline, signature);
        
        // Execute action
        state = State.DISPUTED;
        
        emit DisputeOpened(signer);
        emit MetaActionExecuted(signer, ActionType.RAISE_DISPUTE, nonce);
        
        // Reimburse gas
        _reimburseGas(startGas);
    }

    /**
     * @notice Arbiter resolves a dispute by sending funds to the winner.
     * @param winner The address to receive the funds (must be buyer or seller).
     * @dev This is called directly by the arbiter, not via meta-transaction.
     */
    function resolveDispute(address winner) external nonReentrant onlyArbiter inState(State.DISPUTED) {
        uint256 startGas = gasleft();
        
        if (winner != buyer && winner != seller) revert InvalidWinner();
        
        if (winner == buyer) {
            state = State.REFUNDED;
        } else {
            state = State.COMPLETE;
        }
        
        emit DisputeResolved(msg.sender, winner, escrowAmount);
        
        // Reimburse gas
        _reimburseGas(startGas);
        
        // Pay arbiter fee (one-time)
        _payArbiterFee();
        
        // Refund remaining gas pool to buyer
        _refundGasPool();
        
        // Transfer escrow to winner
        payable(winner).sendValue(escrowAmount);
    }

    // --- Timeout Functions ---

    /**
     * @notice Auto-release funds to seller if buyer didn't respond within review period.
     * @dev Can be called by anyone after review period ends.
     */
    function claimByTimeout() external nonReentrant inState(State.DELIVERED) {
        if (block.timestamp <= deliveredAt + reviewPeriod) revert ReviewPeriodNotEnded();
        
        state = State.COMPLETE;
        
        emit AutoReleased(msg.sender, escrowAmount);
        
        // Pay arbiter fee (one-time)
        _payArbiterFee();
        
        // Refund remaining gas pool to buyer
        _refundGasPool();
        
        // Transfer escrow to seller
        payable(seller).sendValue(escrowAmount);
    }

    /**
     * @notice Buyer claims refund if seller didn't deliver before deadline.
     * @dev Only callable after deliveryDeadline has passed without delivery.
     */
    function claimRefundByTimeout() external nonReentrant onlyBuyer inState(State.FUNDED) {
        if (block.timestamp <= deliveryDeadline) revert DeliveryDeadlineNotPassed();
        
        state = State.REFUNDED;
        
        // Total refund includes escrow + gas pool
        uint256 totalRefund = escrowAmount + gasPoolBalance;
        gasPoolBalance = 0;
        
        emit AutoRefunded(msg.sender, totalRefund);
        
        // Pay arbiter fee (one-time)
        _payArbiterFee();
        
        payable(buyer).sendValue(totalRefund);
    }

    // --- Internal Functions ---

    /**
     * @notice Verifies an EIP-712 signature and increments the nonce.
     */
    function _verifySignature(
        address expectedSigner,
        ActionType actionType,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal {
        // Check nonce
        if (nonces[expectedSigner][actionType] != nonce) revert InvalidNonce();
        
        // Build the struct hash
        bytes32 structHash = keccak256(abi.encode(
            ESCROW_ACTION_TYPEHASH,
            uint8(actionType),
            nonce,
            deadline
        ));
        
        // Build the digest
        bytes32 digest = _hashTypedDataV4(structHash);
        
        // Recover signer
        address recoveredSigner = digest.recover(signature);
        
        if (recoveredSigner != expectedSigner) revert InvalidSignature();
        
        // Increment nonce
        nonces[expectedSigner][actionType]++;
    }

    /**
     * @notice Reimburses gas to the relayer from the gas pool.
     */
    function _reimburseGas(uint256 startGas) internal {
        uint256 gasUsed = startGas - gasleft() + 21000; // Include base tx cost
        
        // Cap gas price
        uint256 effectiveGasPrice = tx.gasprice < maxGasPrice ? tx.gasprice : maxGasPrice;
        
        // Cap gas used
        uint256 effectiveGasUsed = gasUsed < maxGasPerAction ? gasUsed : maxGasPerAction;
        
        // Calculate refund
        uint256 refund = effectiveGasUsed * effectiveGasPrice;
        
        // Cap at available gas pool
        if (refund > gasPoolBalance) {
            refund = gasPoolBalance;
        }
        
        if (refund > 0) {
            gasPoolBalance -= refund;
            payable(msg.sender).transfer(refund);
            emit GasReimbursed(msg.sender, refund);
        }
    }

    /**
     * @notice Refunds remaining gas pool to the buyer.
     */
    function _refundGasPool() internal {
        if (gasPoolBalance > 0) {
            uint256 refund = gasPoolBalance;
            gasPoolBalance = 0;
            payable(buyer).sendValue(refund);
            emit GasPoolRefunded(buyer, refund);
        }
    }

    /**
     * @notice Pays the arbiter fee (one-time, idempotent).
     * @dev Called during finalization. Safe to call multiple times.
     */
    function _payArbiterFee() internal {
        if (arbiterFeePaid) return; // Idempotent guard
        if (arbiterFee == 0) return; // No fee to pay
        
        arbiterFeePaid = true;
        payable(arbiter).sendValue(arbiterFee);
        emit ArbiterFeePaid(arbiter, arbiterFee);
    }

    // --- View Functions ---

    /**
     * @notice Returns the deadline for buyer to respond after delivery.
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

    /**
     * @notice Get the current nonce for a signer and action type.
     */
    function getNonce(address signer, ActionType actionType) external view returns (uint256) {
        return nonces[signer][actionType];
    }

    /**
     * @notice Returns the EIP-712 domain separator.
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Helper to build the digest for off-chain signing.
     */
    function getActionDigest(
        ActionType actionType,
        uint256 nonce,
        uint256 deadline
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            ESCROW_ACTION_TYPEHASH,
            uint8(actionType),
            nonce,
            deadline
        ));
        return _hashTypedDataV4(structHash);
    }
}
