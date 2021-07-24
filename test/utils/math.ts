import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
  formatUnits,
  hexConcat,
  hexDataSlice,
  hexZeroPad,
  parseEther,
  parseUnits,
} from 'ethers/lib/utils';
import { BytesLike } from '@ethersproject/bytes';

export enum TokenType {
  UnderlyingFreeLiq = 0,
  BaseFreeLiq = 1,
  UnderlyingReservedLiq = 2,
  BaseReservedLiq = 3,
  LongCall = 4,
  ShortCall = 5,
  LongPut = 6,
  ShortPut = 7,
}

export interface TokenIdParams {
  tokenType: TokenType;
  maturity: BigNumber;
  strike64x64: BigNumber;
}

export function fixedFromBigNumber(bn: BigNumber) {
  return bn.abs().shl(64).mul(bn.abs().div(bn));
}

export function fixedFromFloat(float: BigNumberish) {
  const [integer = '', decimal = ''] = float.toString().split('.');
  return fixedFromBigNumber(ethers.BigNumber.from(`${integer}${decimal}`)).div(
    ethers.BigNumber.from(`1${'0'.repeat(decimal.length)}`),
  );
}

export function bnToNumber(bn: BigNumber, decimals = 18) {
  return Number(formatUnits(bn, decimals));
}

export function fixedToNumber(fixed: BigNumber) {
  const integer = fixed.shr(64);
  const decimals = fixed.sub(integer.shl(64));

  const decimalsNumber = decimals.mul(1e10).div(BigNumber.from(1).shl(64));

  return Number(integer) + Number(decimalsNumber) / 1e10;
}

export function fixedToBn(fixed: BigNumber, decimals = 18) {
  return parseUnits(fixedToNumber(fixed).toString(), decimals);
}

export function formatTokenId({
  tokenType,
  maturity,
  strike64x64,
}: TokenIdParams) {
  return hexConcat([
    hexZeroPad(BigNumber.from(tokenType).toHexString(), 1),
    hexZeroPad('0x0', 7),
    hexZeroPad(maturity.toHexString(), 8),
    hexZeroPad(strike64x64.toHexString(), 16),
  ]);
}

export function getOptionTokenIds(
  maturity: BigNumber,
  strike64x64: BigNumber,
  isCall: boolean,
) {
  return {
    short: formatTokenId({
      tokenType: isCall ? TokenType.ShortCall : TokenType.ShortPut,
      maturity,
      strike64x64,
    }),
    long: formatTokenId({
      tokenType: isCall ? TokenType.LongCall : TokenType.LongPut,
      maturity,
      strike64x64,
    }),
  };
}

export function parseTokenId(tokenId: BytesLike): TokenIdParams {
  return {
    tokenType: Number(hexDataSlice(tokenId, 0, 1)),
    maturity: BigNumber.from(hexDataSlice(tokenId, 8, 16)),
    strike64x64: BigNumber.from(hexDataSlice(tokenId, 16, 32)),
  };
}
