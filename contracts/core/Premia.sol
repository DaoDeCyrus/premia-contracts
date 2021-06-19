// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import {OwnableStorage} from '@solidstate/contracts/access/OwnableStorage.sol';
import {Diamond} from '@solidstate/contracts/proxy/diamond/Diamond.sol';

import {ProxyManagerStorage} from './ProxyManagerStorage.sol';

/**
 * @title Premia core contract
 * @dev based on the EIP2535 Diamond standard
 */
contract Premia is Diamond {

    /**
     * @notice deploy contract and connect given diamond facets
     * @param poolImplementation implementaion Pool contract
     */
    constructor (
        address poolImplementation
    ) {
        OwnableStorage.layout().owner = msg.sender;

        {
            ProxyManagerStorage.Layout storage l = ProxyManagerStorage.layout();
            l.poolImplementation = poolImplementation;
        }
    }
}