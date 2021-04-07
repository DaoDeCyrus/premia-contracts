// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC20/IERC20.sol';
import '@solidstate/contracts/token/ERC1155/ERC1155Base.sol';

import '../pair/Pair.sol';
import './PoolStorage.sol';

import { ABDKMath64x64 } from 'abdk-libraries-solidity/ABDKMath64x64.sol';
import { OptionMath } from '../libraries/OptionMath.sol';

/**
 * @title Median option pool
 * @dev deployed standalone and referenced by PoolProxy
 */
contract Pool is OwnableInternal, ERC1155Base {
  using ABDKMath64x64 for int128;

  /**
   * @notice get address of PairProxy contract
   * @return pair address
   */
  function getPair () external view returns (address) {
    return PoolStorage.layout().pair;
  }

  /**
   * @notice get price of option contract
   * @param amount size of option contract
   * @param maturity timestamp of option maturity
   * @param strikePrice option strike price
   * @return price price of option contract
   */
  function quote (
    uint256 amount,
    uint64 maturity,
    int128 strikePrice
  ) public view returns (int128 price) {
    require(maturity > block.timestamp, 'Pool: maturity must be in the future');

    PoolStorage.Layout storage l = PoolStorage.layout();

    // TODO: convert wei amount to fixed point
    int128 amount64x64;

    int128 oldLiquidity = l.liquidity;
    int128 newLiquidity = oldLiquidity.add(amount64x64);

    // TODO: convert volatility to variance
    int128 variance = Pair(l.pair).getVolatility();

    // TODO: fetch
    int128 spotPrice;

    // TODO: convert maturity to timeToMaturity
    int128 timeToMaturity = ABDKMath64x64.fromUInt(maturity);

    price = OptionMath.quotePrice(
      variance,
      strikePrice,
      spotPrice,
      timeToMaturity,
      l.cLevel,
      oldLiquidity,
      newLiquidity,
      OptionMath.ONE_64x64,
      false
    ).mul(amount64x64);
  }

  /**
   * @notice TODO
   */
  function valueOfOption (
    uint256 tokenId,
    uint256 amount
  ) public view returns (int128) {
    (uint8 tokenType, uint64 maturity, int128 strikePrice) = _parametersFor(tokenId);
    // TODO: verify tokenType

    // TODO: get spot price now or at maturity
    int128 spotPrice;

    if (strikePrice > spotPrice) {
      return strikePrice.sub(spotPrice).mul(ABDKMath64x64.fromUInt(amount));
    } else {
      return 0;
    }
  }

  /**
   * @notice deposit underlying currency, underwriting puts of that currency with respect to base currency
   * @param amount quantity of underlying currency to deposit
   * @return share of pool granted
   */
  function deposit (
    uint256 amount
  ) external returns (uint256 share) {
    // TODO: convert ETH to WETH if applicable

    PoolStorage.Layout storage l = PoolStorage.layout();

    // TODO: multiply by decimals

    IERC20(l.underlying).transferFrom(msg.sender, address(this), amount);

    // TODO: convert wei amount to fixed point
    int128 amount64x64;

    // TODO: mint liquidity tokens

    int128 oldLiquidity = l.liquidity;
    int128 newLiquidity = oldLiquidity.add(amount64x64);
    l.liquidity = newLiquidity;

    l.cLevel = OptionMath.calculateCLevel(
      l.cLevel,
      oldLiquidity,
      newLiquidity,
      OptionMath.ONE_64x64
    );
  }

  /**
   * @notice redeem pool share tokens for underlying asset
   * @param share quantity of share tokens to redeem
   * @return amount of underlying asset withdrawn
   */
  function withdraw (
    uint256 share
  ) external returns (uint256 amount) {
    // TODO: ensure available liquidity, queue if necessary

    PoolStorage.Layout storage l = PoolStorage.layout();

    // TODO: burn liquidity tokens

    // TODO: calculate share of pool

    // TODO: calculate amount out
    IERC20(l.underlying).transfer(msg.sender, amount);

    // TODO: convert wei amount to fixed point
    int128 amount64x64;

    int128 oldLiquidity = l.liquidity;
    int128 newLiquidity = oldLiquidity.sub(amount64x64);
    l.liquidity = newLiquidity;

    l.cLevel = OptionMath.calculateCLevel(
      l.cLevel,
      oldLiquidity,
      newLiquidity,
      OptionMath.ONE_64x64
    );
  }

  /**
   * @notice purchase put option
   * @param amount size of option contract
   * @param maturity timestamp of option maturity
   * @param strikePrice option strike price
   */
  function purchase (
    uint256 amount,
    uint64 maturity,
    int128 strikePrice
  ) external returns (uint256 price) {
    // TODO: convert ETH to WETH if applicable
    // TODO: maturity must be integer number of calendar days
    // TODO: accept minimum price to prevent slippage
    // TODO: reserve liquidity

    PoolStorage.Layout storage l = PoolStorage.layout();

    int128 price64x64 = quote(amount, maturity, strikePrice);

    // TODO: set C-Level

    // TODO: convert wei amount to fixed point
    IERC20(l.base).transferFrom(msg.sender, address(this), price);

    // TODO: tokenType
    _mint(msg.sender, _tokenIdFor(0, maturity, strikePrice), amount, '');
  }

  /**
   * @notice exercise put option
   * @param tokenId ERC1155 token id
   * @param amount quantity of option contract tokens to exercise
   */
  function exercise (
    uint256 tokenId,
    uint256 amount
  ) public {
    int128 value64x64 = valueOfOption(tokenId, amount);

    require(value64x64 > 0, 'Pool: option must be in-the-money');

    _burn(msg.sender, tokenId, amount);

    // TODO: multiply by decimals
    IERC20(PoolStorage.layout().underlying).transfer(msg.sender, value64x64.toUInt());
  }

  /**
   * @notice calculate ERC1155 token id for given option parameters
   * @param tokenType TODO
   * @param maturity timestamp of option maturity
   * @param strikePrice option strike price
   * @return tokenId token id
   */
  function _tokenIdFor (
    uint8 tokenType,
    uint64 maturity,
    int128 strikePrice
  ) internal pure returns (uint256 tokenId) {
    assembly {
      tokenId := add(strikePrice, add(shl(128, maturity), shl(248, tokenType)))
    }
  }

  /**
   * @notice derive option maturity and strike price from ERC1155 token id
   * @param tokenId token id
   * @return tokenType TODO
   * @return maturity timestamp of option maturity
   * @return strikePrice option strike price
   */
  function _parametersFor (
    uint256 tokenId
  ) internal pure returns (uint8 tokenType, uint64 maturity, int128 strikePrice) {
    assembly {
      tokenType := shr(248, tokenId)
      maturity := shr(128, tokenId)
      strikePrice := tokenId
    }
  }
}
