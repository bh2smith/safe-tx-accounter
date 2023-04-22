import { utils } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import * as path from "https://deno.land/std@0.136.0/path/mod.ts";
import { Transfer, SafeTransaction } from "./lib/models.ts";
import { fullNameIfAvailable, writeCSV } from "./lib/util.ts";
import { addressBookFromCSV } from "./lib/addressBook.ts";
import {
  basicTxValidation,
  validateETHTransfer,
  validateWethUnwrap,
  isSameAddress,
  validateErc20Transfer,
  notifyIfDifferent,
  notifyIfNot,
} from "./lib/validations.ts";
import { COW_TOKEN, WETH_TOKEN } from "./lib/constants.ts";

const [txid] = Deno.args;

const scriptPath = new URL(import.meta.url).pathname;
const addressbookPath = path.join(
  scriptPath.slice(0, scriptPath.lastIndexOf("/")),
  "./AddressBook.csv"
);
const { addressBook, solvers, rewardTargets } = await addressBookFromCSV(
  addressbookPath
);

const response = await fetch(
  `https://safe-client.safe.global/v1/chains/1/transactions/${txid}`
);
const txDetails = await response.json();

basicTxValidation(addressBook, txDetails);

const subTxs: SafeTransaction[] =
  txDetails.txData.dataDecoded.parameters[0].valueDecoded;

let sumEth = 0n;
let sumCow = 0n;
const transferList = [];
for (const [index, subTx] of Object.entries(subTxs)) {
  const subTxStr = `Subtx at index ${Number(index) + 1}`;

  if (subTx.data === null) {
    // Native ETH Transfer
    sumEth += BigInt(subTx.value);
    validateETHTransfer(subTx, subTxStr, solvers, addressBook);
    transferList.push({
      receiver: subTx.to,
      token: "ETH",
      amount: subTx.value,
      name: fullNameIfAvailable(addressBook, subTx.to),
    });
  } else if (isSameAddress(subTx.to, WETH_TOKEN)) {
    // WETH Unwrap! We assume this is a WETH unwrap because we do not expect there to be WETH transfers.
    validateWethUnwrap(subTx, subTxStr);
  } else {
    // ERC20 Transfer
    validateErc20Transfer(subTx, subTxStr, COW_TOKEN);
    const [{ value: receiver }, { value: amount }] =
      subTx.dataDecoded.parameters;
    sumCow += BigInt(amount);
    const receiverName = fullNameIfAvailable(addressBook, receiver);
    notifyIfNot(
      rewardTargets.includes(receiver),
      `${subTxStr} sends COW to address ${receiverName} that is not in the cow reward target list`
    );
    transferList.push({
      receiver,
      token: subTx.to,
      amount: BigInt(amount),
      name: receiverName,
    });
  }
  notifyIfDifferent(subTx.operation, 0, `${subTxStr} is a delegatecall`);
}

await writeCSV(transferList);
// TODO - this should become an alert!
console.log(`Total ETH sent: ${utils.formatEther(sumEth)}`);
console.log(`Total COW sent: ${utils.formatEther(sumCow)}`);
