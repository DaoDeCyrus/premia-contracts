import {
  SolidStateERC20,
  SolidStateERC20__factory,
  ExchangeHelper__factory,
  PremiaErc20,
  PremiaErc20__factory,
  PremiaStakingMigrator,
  PremiaStakingUpgrade__factory,
  ProxyUpgradeableOwnable__factory,
  VePremia__factory,
} from '../../typechain';
import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { bnToNumber } from '../utils/math';

let admin: SignerWithAddress;
let user1: SignerWithAddress;
let treasury: SignerWithAddress;

const { API_KEY_ALCHEMY } = process.env;
const jsonRpcUrl = `https://eth-mainnet.alchemyapi.io/v2/${API_KEY_ALCHEMY}`;
const blockNumber = 15251100;

let premia: PremiaErc20;
let xPremia: SolidStateERC20;

let holders: string[] = [];

describe('PremiaStakingUpgrade', () => {
  let snapshotId: number;

  beforeEach(async () => {
    snapshotId = await ethers.provider.send('evm_snapshot', []);
  });

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [snapshotId]);
  });

  before(async () => {
    await ethers.provider.send('hardhat_reset', [
      { forking: { jsonRpcUrl, blockNumber } },
    ]);

    [admin, user1] = await ethers.getSigners();

    // Impersonate owner
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: ['0xc22fae86443aeed038a4ed887bba8f5035fd12f0'],
    });

    treasury = await ethers.getSigner(
      '0xc22fae86443aeed038a4ed887bba8f5035fd12f0',
    );

    premia = PremiaErc20__factory.connect(
      '0x6399c842dd2be3de30bf99bc7d1bbf6fa3650e70',
      treasury,
    );

    //

    xPremia = SolidStateERC20__factory.connect(
      '0xF1bB87563A122211d40d393eBf1c633c330377F9',
      admin,
    );
    const filter = xPremia.filters.Transfer(null, null);
    for (const e of await xPremia.queryFilter(filter)) {
      const to = e.args.to.toLowerCase();
      if (!holders.includes(to)) {
        holders.push(to);
      }

      const from = e.args.from.toLowerCase();
      if (!holders.includes(from)) {
        holders.push(from);
      }
    }

    const r = await xPremia.queryFilter({
      address: '0xf1bb87563a122211d40d393ebf1c633c330377f9',
      topics: [
        '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
      ],
    });

    for (const e of await xPremia.queryFilter({
      address: '0xf1bb87563a122211d40d393ebf1c633c330377f9',
      topics: [
        '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
      ],
    })) {
      const user = '0x' + e.topics[1].slice(26).toLowerCase();
      if (!holders.includes(user)) {
        holders.push(user);
      }
    }

    for (const e of await xPremia.queryFilter({
      address: '0xf1bb87563a122211d40d393ebf1c633c330377f9',
      topics: [
        '0xb4caaf29adda3eefee3ad552a8e85058589bf834c7466cae4ee58787f70589ed',
      ],
    })) {
      const user = '0x' + e.topics[1].slice(26).toLowerCase();
      if (!holders.includes(user)) {
        holders.push(user);
      }
    }

    holders = holders.filter(
      (el) => el.toLowerCase() !== xPremia.address.toLowerCase(),
    );
  });

  it('should successfully upgrade', async () => {
    // Impersonate owner
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: ['0xc22fae86443aeed038a4ed887bba8f5035fd12f0'],
    });

    const upgrade = await new PremiaStakingUpgrade__factory(treasury).deploy(
      premia.address,
    );
    await ProxyUpgradeableOwnable__factory.connect(
      xPremia.address,
      treasury,
    ).setImplementation(upgrade.address);

    // const totalSupplyBefore = await xPremia.totalSupply();

    // console.log(
    //   'AA',
    //   await xPremia.balanceOf('0xa3A7B6F88361F48403514059F1F16C8E78d60EeC'),
    // );

    // console.log(
    //   'locked',
    //   formatEther(await xPremia.balanceOf(xPremia.address)),
    // );

    const upgradeContract = PremiaStakingUpgrade__factory.connect(
      xPremia.address,
      treasury,
    );

    for (let i = 0; i <= Math.floor(holders.length / 100); i++) {
      console.log(i * 100, (i + 1) * 100);
      const tx = await upgradeContract.upgrade(
        holders.slice(i * 100, (i + 1) * 100),
      );
      console.log('GAS', (await tx.wait()).gasUsed.toString());
    }

    const totalSupplyAfter = await xPremia.totalSupply();
    const premiaStaked = await premia.balanceOf(xPremia.address);

    const exchangeHelper = await new ExchangeHelper__factory(treasury).deploy();
    const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    let vePremia = await new VePremia__factory(treasury).deploy(
      ethers.constants.AddressZero,
      premia.address,
      usdc,
      exchangeHelper.address,
    );

    await ProxyUpgradeableOwnable__factory.connect(
      xPremia.address,
      treasury,
    ).setImplementation(vePremia.address);

    vePremia = VePremia__factory.connect(xPremia.address, treasury);

    const pendingWithdrawals = await vePremia.getPendingWithdrawals();

    // console.log(formatEther(totalSupplyAfter));
    // console.log(formatEther(premiaStaked.sub(pendingWithdrawals)));
    // console.log(
    //   'tot',
    //   formatEther(totalSupplyAfter.sub(premiaStaked.sub(pendingWithdrawals))),
    // );
    expect(
      bnToNumber(totalSupplyAfter.sub(premiaStaked.sub(pendingWithdrawals))),
    ).to.be.almost(0);

    const totalPower = await vePremia.getTotalPower();
    expect(bnToNumber(totalPower.mul(4))).to.almost(
      bnToNumber(totalSupplyAfter),
    );

    expect(await vePremia.balanceOf(vePremia.address)).to.eq(0);

    // console.log(holders.length);
  });
});