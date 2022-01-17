// SPDX-License-Identifier: LGPL-3.0-or-later

pragma solidity ^0.8.0;

interface IPoolSell {
    /**
     * @notice Enable or disable buyback
     * @param state whether to enable or disable buyback
     */
    function setBuyBackEnabled(bool state) external;

    /**
     * @notice Get whether buyback is enabled or not for a given LP
     * @param account LP account for which to check
     * @return whether buyback is enabled or not
     */
    function isBuyBackEnabled(address account) external view returns (bool);

    /**
     * @notice get list of underwriters with buyback enabled for a specific shortTokenId
     * @param shortTokenId the long token id
     * @return buyers list of underwriters with buyback enabled for this shortTokenId
     * @return amounts amounts of options underwritten by each LP with buyback enabled
     */
    function getBuyers(uint256 shortTokenId)
        external
        view
        returns (address[] memory buyers, uint256[] memory amounts);

    /**
     * @notice sell options back to the pool to LP who enabled buyback
     * @param maturity timestamp of option maturity
     * @param strike64x64 64x64 fixed point representation of strike price
     * @param contractSize size of option contract
     * @param isCall true for call, false for put
     * @param buyers list of potential buyers (to allow getting the list through static call, to save gas)
     */
    function sell(
        uint64 maturity,
        int128 strike64x64,
        bool isCall,
        uint256 contractSize,
        address[] memory buyers
    ) external;
}
