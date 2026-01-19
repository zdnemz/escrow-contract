// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./Escrow.sol";

contract EscrowFactory {
    event EscrowCreated(
        address indexed escrowAddress, 
        address indexed buyer, 
        address indexed seller, 
        address arbiter, 
        uint256 amount
    );

    /**
     * @notice Deploys a new Escrow contract.
     * @param _seller The address of the seller.
     * @param _arbiter The address of the arbiter.
     * @return The address of the newly deployed Escrow contract.
     */
    function createEscrow(address _seller, address _arbiter) external payable returns (address) {
        Escrow newEscrow = new Escrow{value: msg.value}(
            msg.sender, // Buyer is the caller
            _seller,
            _arbiter,
            msg.value
        );

        emit EscrowCreated(address(newEscrow), msg.sender, _seller, _arbiter, msg.value);

        return address(newEscrow);
    }
}
