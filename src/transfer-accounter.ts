import {
  BigNumber,
  utils,
} from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import { readCSVObjects } from "https://deno.land/x/csv@v0.7.4/mod.ts";
import * as path from "https://deno.land/std@0.136.0/path/mod.ts";
import { AddressBookEntry, Transfer, SafeTransaction } from "./models.ts";
import { decodePayouts, fullNameIfAvailable, writeCSV } from "./util.ts";
import {
  basicTxValidation,
  validateETHTransfer,
  validateWethUnwrap,
  isSameAddress,
  validateErc20Transfer,
  notifyIfDifferent,
  notifyIfNot
} from "./validations.ts";
import { COW_TOKEN, WETH_TOKEN } from "./constants.ts";

const [txid, pathToPayouts] = Deno.args;

const scriptPath = new URL(import.meta.url).pathname;
const addressbookPath = path.join(
  scriptPath.slice(0, scriptPath.lastIndexOf("/")),
  "./AddressBook.csv"
);
const solvers: string[] = [];
const cowRewardTargets: string[] = [];
const addressBook: AddressBookEntry[] = [];
for await (const entry of readCSVObjects(
  await Deno.open(addressbookPath, { read: true })
)) {
  const address = utils.getAddress(entry.address) as string;
  const name = entry.name;
  const chainId = Number(entry.chainId);
  const parsedEntry: AddressBookEntry = { address, name, chainId };
  addressBook.push(parsedEntry);

  if (chainId === 1 && /^(prod|barn)-.*/.test(name)) {
    const possibleAddress = utils.getAddress(address);
    if (possibleAddress) {
      solvers.push(possibleAddress);
    }
  } else if (chainId === 1 && /^RewardTarget\(.*\)$/.test(name)) {
    const possibleAddress = utils.getAddress(address);
    if (possibleAddress) {
      cowRewardTargets.push(possibleAddress);
    }
  }
}

const payouts = pathToPayouts !== undefined ? await decodePayouts(pathToPayouts) : null;
const response = await fetch(`https://safe-client.safe.global/v1/chains/1/transactions/${txid}`);
const txDetails = await response.json();

basicTxValidation(addressBook, txDetails);

const subTxs: SafeTransaction[] =
  txDetails.txData.dataDecoded.parameters[0].valueDecoded;

let sumEth = 0n;
let sumCow = 0n;

const transferList: Transfer[] = [];
for (const [index, subTx] of Object.entries(subTxs)) {
  // Take parameters from CSV if available or fill with reasonable defaults
  const { token_type, tokenAddress, receiver, amount } =
    payouts !== null
      ? payouts[Number(index)]
      : {
          token_type: subTx.data === null ? "native" : "erc20",
          tokenAddress: subTx.data === null ? "" : COW_TOKEN,
          receiver: null,
          amount: null,
        };
  let realReceiver, realAmount;
  const subTxStr = `Subtx at index ${Number(index) + 1}`;

  if (token_type === "native") {
    // ETH Transfer
    sumEth += BigInt(subTx.value);
    validateETHTransfer(subTx, subTxStr, solvers, addressBook);
    realReceiver = subTx.to
    transferList.push({
      receiver: subTx.to,
      token: "ETH",
      amount: subTx.value,
      name: fullNameIfAvailable(addressBook, subTx.to),
    });
  } else if (isSameAddress(subTx.to, WETH_TOKEN)) {
    // WETH Unwrap!
    validateWethUnwrap(subTx, subTxStr);
  } else {
    // ERC20 Transfer
    validateErc20Transfer(subTx, subTxStr, tokenAddress);
    const [{ value: realReceiver }, { value: realAmount }] =
      subTx.dataDecoded.parameters;

    sumCow += BigInt(realAmount); // nonsense if some of the condition is invalid
    transferList.push({
      receiver: realReceiver,
      token: subTx.to,
      amount: BigInt(realAmount),
      name: fullNameIfAvailable(addressBook, realReceiver),
    });
  }

  notifyIfDifferent(subTx.operation, 0, `${subTxStr} is a delegatecall`);
  if (receiver !== null && realReceiver !== undefined) {
    notifyIfDifferent(
      fullNameIfAvailable(addressBook, realReceiver),
      fullNameIfAvailable(addressBook, receiver),
      `${subTxStr} has a different receiver than the one specified in the payout file`
    );
  }
  if (amount !== null) {
    const diff = BigNumber.from(realAmount).sub(utils.parseEther(amount));
    notifyIfNot(
      diff.lt(5000), // Note: the CSV safe app involves some rounding at some point
      `${subTxStr} sends the wrong amount of tokens (difference: ${utils.formatEther(
        diff
      )})`
    );
  }
}

await writeCSV(transferList);
// TODO - this should become an alert!
console.log(`Total ETH sent: ${utils.formatEther(sumEth)}`);
console.log(`Total COW sent: ${utils.formatEther(sumCow)}`);
