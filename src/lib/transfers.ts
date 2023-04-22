import { utils } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import { Transfer, SafeTransaction } from "./models.ts";
import { fullNameIfAvailable } from "./util.ts";
import {
  validateETHTransfer,
  validateWethUnwrap,
  isSameAddress,
  validateErc20Transfer,
  notifyIfDifferent,
  notifyIfNot,
} from "./validations.ts";
import { COW_TOKEN, WETH_TOKEN } from "./constants.ts";
import { AddressCollection } from "./addressBook.ts";

export function transferListFromMultisend(
  addresses: AddressCollection,
  safeTxs: SafeTransaction[]
): Transfer[] {
  const { addressBook, solvers, rewardTargets } = addresses;
  let sumEth = 0n;
  let sumCow = 0n;
  const transferList = [];
  for (const [index, tx] of Object.entries(safeTxs)) {
    const txStr = `Tx at index ${Number(index) + 1}`;

    if (tx.data === null) {
      // Native ETH Transfer
      sumEth += BigInt(tx.value);
      validateETHTransfer(tx, txStr, solvers, addressBook);
      transferList.push({
        receiver: tx.to,
        token: "ETH",
        amount: tx.value,
        name: fullNameIfAvailable(addressBook, tx.to),
      });
    } else if (isSameAddress(tx.to, WETH_TOKEN)) {
      // WETH Unwrap! We assume this is a WETH unwrap because we do not expect there to be WETH transfers.
      validateWethUnwrap(tx, txStr);
    } else {
      // ERC20 Transfer
      validateErc20Transfer(tx, txStr, COW_TOKEN);
      const [{ value: receiver }, { value: amount }] =
        tx.dataDecoded.parameters;
      sumCow += BigInt(amount);
      const receiverName = fullNameIfAvailable(addressBook, receiver);
      notifyIfNot(
        rewardTargets.includes(receiver),
        `${txStr} sends COW to address ${receiverName} that is not in the cow reward target list`
      );
      transferList.push({
        receiver,
        token: tx.to,
        amount: BigInt(amount),
        name: receiverName,
      });
    }
    notifyIfDifferent(tx.operation, 0, `${txStr} is a delegatecall`);
  }
  console.log(`Total ETH sent: ${utils.formatEther(sumEth)}`);
  console.log(`Total COW sent: ${utils.formatEther(sumCow)}`);
  return transferList;
}
