// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import '@solidstate/contracts/token/ERC20/ERC20.sol';

contract ERC20Mock is ERC20 {
  constructor (
    string memory symbol
  ) {
    _mint(msg.sender, 1 ether);

    ERC20MetadataStorage.layout().symbol = symbol;
  }
}
