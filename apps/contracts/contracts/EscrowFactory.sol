// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./Escrow.sol";

/**
 * @title EscrowFactory
 * @notice Factory contract for deploying Escrow instances.
 * @dev Buyer deposits escrowAmount + gasPool. Arbiter acts as relayer.
 */
contract EscrowFactory {
    event EscrowCreated(
        address indexed escrowAddress,
        address indexed buyer,
        address indexed seller,
        address arbiter,
        uint256 escrowAmount,
        uint256 gasPool,
        uint256 arbiterFee,
        uint256 maxGasPrice,
        uint256 maxGasPerAction,
        uint256 deliveryDeadline,
        uint256 reviewPeriod
    );

    /**
     * @notice Deploys a new Escrow contract with gas abstraction and arbiter fee.
     * @param _seller The address of the seller.
     * @param _arbiter The address of the arbiter (also relayer).
     * @param _escrowAmount The amount for the escrow transaction.
     * @param _gasPool The amount for gas reimbursement pool.
     * @param _arbiterFee Flat fee paid to arbiter at escrow finalization.
     * @param _maxGasPrice Maximum gas price for reimbursement.
     * @param _maxGasPerAction Maximum gas units per action.
     * @param _deliveryDeadline Unix timestamp by which seller must mark delivery.
     * @param _reviewPeriod Duration in seconds for buyer review after delivery.
     * @return The address of the newly deployed escrow contract.
     */
    function createEscrow(
        address _seller,
        address _arbiter,
        uint256 _escrowAmount,
        uint256 _gasPool,
        uint256 _arbiterFee,
        uint256 _maxGasPrice,
        uint256 _maxGasPerAction,
        uint256 _deliveryDeadline,
        uint256 _reviewPeriod
    ) external payable returns (address) {
        require(msg.value == _escrowAmount + _gasPool + _arbiterFee, "Incorrect payment");

        Escrow newEscrow = new Escrow{value: msg.value}(
            msg.sender,      // buyer
            _seller,
            _arbiter,
            _escrowAmount,
            _deliveryDeadline,
            _reviewPeriod,
            _maxGasPrice,
            _maxGasPerAction,
            _arbiterFee
        );

        emit EscrowCreated(
            address(newEscrow),
            msg.sender,
            _seller,
            _arbiter,
            _escrowAmount,
            _gasPool,
            _arbiterFee,
            _maxGasPrice,
            _maxGasPerAction,
            _deliveryDeadline,
            _reviewPeriod
        );

        return address(newEscrow);
    }
}
