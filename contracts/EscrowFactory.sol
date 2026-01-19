// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./Escrow.sol";

/**
 * @title EscrowFactory
 * @notice Factory contract for deploying dispute-minimized Escrow instances.
 */
contract EscrowFactory {
    event EscrowCreated(
        address indexed escrowAddress, 
        address indexed buyer, 
        address indexed seller, 
        address arbiter, 
        uint256 amount,
        uint256 deliveryDeadline,
        uint256 reviewPeriod
    );

    /**
     * @notice Deploys a new Escrow contract with deadline parameters.
     * @param _seller The address of the seller.
     * @param _arbiter The address of the arbiter (can be address(0) to disable disputes).
     * @param _deliveryDeadline Unix timestamp by which seller must mark delivery.
     * @param _reviewPeriod Duration in seconds for buyer review after delivery.
     * @return The address of the newly deployed Escrow contract.
     */
    function createEscrow(
        address _seller, 
        address _arbiter,
        uint256 _deliveryDeadline,
        uint256 _reviewPeriod
    ) external payable returns (address) {
        Escrow newEscrow = new Escrow{value: msg.value}(
            msg.sender,
            _seller,
            _arbiter,
            msg.value,
            _deliveryDeadline,
            _reviewPeriod
        );

        emit EscrowCreated(
            address(newEscrow), 
            msg.sender, 
            _seller, 
            _arbiter, 
            msg.value,
            _deliveryDeadline,
            _reviewPeriod
        );

        return address(newEscrow);
    }
}
