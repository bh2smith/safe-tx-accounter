import {
  BigNumber,
  utils,
} from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import { readCSVObjects, writeCSVObjects } from "https://deno.land/x/csv@v0.7.4/mod.ts";
import * as path from "https://deno.land/std@0.136.0/path/mod.ts";

interface AddressBookEntry {
  address: string;
  name: string;
  chainId: number;
}

const [txid, pathToPayouts] = Deno.args;

const scriptPath = new URL(import.meta.url).pathname;
const addressbookPath = path.join(
  scriptPath.slice(0, scriptPath.lastIndexOf("/")),
  "./AddressBook.csv",
);
const solvers = [];
const cowRewardTargets = [];
const addressBook: AddressBookEntry[] = [];
for await (
  const entry of readCSVObjects(
    await Deno.open(addressbookPath, { read: true }),
  )
) {
  const address = utils.getAddress(entry.address) as string;
  const name = entry.name;
  const chainId = Number(entry.chainId);
  const parsedEntry: AddressBookEntry = { address, name, chainId };
  addressBook.push(parsedEntry);

  if ((chainId === 1) && /^(prod|barn)-.*/.test(name)) {
    solvers.push(utils.getAddress(address));
  } else if ((chainId === 1) && /^RewardTarget\(.*\)$/.test(name)) {
    cowRewardTargets.push(utils.getAddress(address));
  }
}

const fullNameIfAvailable = (address: string) => {
  const matchingEntry = addressBook.find((entry) =>
    utils.getAddress(address) === utils.getAddress(entry.address)
  );
  if (matchingEntry === undefined) {
    return address;
  } else {
    const { address, name, chainId } = matchingEntry;
    return `${address} (${name} @ chainId ${chainId})`;
  }
};

async function decodePayouts(pathToPayouts: string) {
  const payoutFile = await Deno.open(pathToPayouts);
  const payouts = [];
  for await (const payout of readCSVObjects(payoutFile)) {
    payouts.push(payout);
  }
  payoutFile.close();
  return payouts;
}
const payouts = pathToPayouts !== undefined
  ? await decodePayouts(pathToPayouts)
  : null;

const safeUrl =
  `https://safe-client.safe.global/v1/chains/1/transactions/${txid}`;
const response = await fetch(safeUrl);
const txDetails = await response.json();
let valid = true;

const notifyIfNot = (condition: boolean, msg: string) => {
  if (!condition) {
    valid = false;
    console.log(msg);
  }
};
const notifyIfDifferent = (real: unknown, expected: unknown, msg: string) => {
  if (real !== expected) {
    valid = false;
    console.log(`Expected: ${expected}; is: ${real}.`, msg);
  }
};

function isSameAddress(lhs: string, rhs: string): boolean {
  return lhs.toLowerCase() == rhs.toLowerCase();
}

const multisendCallOnly = "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D";
notifyIfDifferent(
  txDetails.txInfo.to.value,
  multisendCallOnly,
  `Invalid tx target: should be the multisend address, is ${
    fullNameIfAvailable(txDetails.txInfo.to.value)
  }`,
);
notifyIfDifferent(
  txDetails.txData.dataDecoded.method,
  "multiSend",
  `Invalid method for multisend: should be multiSend, is ${txDetails.txData.dataDecoded.method}`,
);
notifyIfDifferent(
  txDetails.txData.value,
  "0",
  "Transaction should be sending zero ETH to the multisend contract",
);

const subTxs: any[] = txDetails.txData.dataDecoded.parameters[0].valueDecoded;

let sumEth = 0n;
let sumCow = 0n;
const cowToken = "0xDEf1CA1fb7FBcDC777520aa7f396b4E015F497aB";
const wethToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const transferList: any[] = [];

for (const [index, subTx] of Object.entries(subTxs)) {
  // Take parameters from CSV if available or fill with reasonable defaults
  const {
    token_type,
    tokenAddress,
    receiver,
    amount,
  } = (payouts !== null) ? payouts[Number(index)] : {
    token_type: subTx.data === null ? "native" : "erc20",
    tokenAddress: subTx.data === null ? "" : cowToken,
    receiver: null,
    amount: null,
  };
  let realReceiver, realAmount;
  const subTxStr = `Subtx at index ${Number(index) + 1}`;
  
  if (token_type === "native") {
    // ETH Transfer
    sumEth += BigInt(subTx.value);
    notifyIfDifferent(
      subTx.data,
      null,
      `${subTxStr} should have no data as it sends native tokens`,
    );
    realReceiver = subTx.to;
    realAmount = subTx.value;
    notifyIfNot(
      solvers.includes(realReceiver),
      `${subTxStr} sends ETH to address ${
        fullNameIfAvailable(realReceiver)
      } that is not in the solver list`,
    );
    transferList.push({
      receiver: realReceiver,
      token: "ETH",
      amount: realAmount,
    });
  } else if (isSameAddress(subTx.to, wethToken)) {
    // WETH Unwrap!
    const { method } = subTx.dataDecoded;
    notifyIfDifferent(
      method,
      "withdraw",
      `${subTxStr} is interacting with WETH but not unwrapping (call to ${method})`,
    );
    notifyIfDifferent(
      subTx.value,
      "0",
      `${subTxStr} also sends the native token in a WETH unwrap`,
    );
  } else {
    notifyIfDifferent(
      tokenAddress,
      cowToken,
      `${subTxStr} is sending a token that isn't COW or the native token. Please check if the CSV has been generated correctly`,
    );
    notifyIfDifferent(
      subTx.to,
      tokenAddress,
      `${subTxStr} is not sending out the expected token`,
    );
    notifyIfDifferent(
      subTx.value,
      "0",
      `${subTxStr} also sends the native token in a token transfer`,
    );
    notifyIfDifferent(
      subTx.dataDecoded.method,
      "transfer",
      `${subTxStr} is not doing a token transfer`,
    );
    notifyIfDifferent(
      subTx.dataDecoded.parameters.length,
      2,
      `${subTxStr} doesn't have the right amount of parameters for a transfer`,
    );
    [{ value: realReceiver }, { value: realAmount }] =
      subTx.dataDecoded.parameters;
    sumCow += BigInt(realAmount); // nonsense if some of the condition is invalid
    notifyIfNot(
      cowRewardTargets.includes(realReceiver),
      `${subTxStr} sends COW to address ${
        fullNameIfAvailable(realReceiver)
      } that is not in the cow reward target list`,
    );
    transferList.push({
      receiver: realReceiver,
      token: subTx.to,
      amount: realAmount,
    });
  }

  notifyIfDifferent(
    subTx.operation,
    0,
    `${subTxStr} is a delegatecall`,
  );
  if (receiver !== null) {
    notifyIfDifferent(
      fullNameIfAvailable(realReceiver),
      fullNameIfAvailable(receiver),
      `${subTxStr} has a different receiver than the one specified in the payout file`,
    );
  }
  if (amount !== null) {
    const diff = BigNumber.from(realAmount).sub(utils.parseEther(amount));
    notifyIfNot(
      diff.lt(5000), // Note: the CSV safe app involves some rounding at some point
      `${subTxStr} sends the wrong amount of tokens (difference: ${
        utils.formatEther(diff)
      })`,
    );
  }
}

function addressCompare(a: string, b: string): number {
  if (a.toLowerCase() < b.toLowerCase()) {
    return 1
  } else if (a.toLowerCase() > b.toLowerCase()) {
    return -1
  } else {
    return 0
  }
}

const asyncObjectsGenerator = async function*(objectArray: any[]) {
  objectArray.sort((x, y) => addressCompare(x.receiver, y.receiver))
  while (objectArray.length > 0) {
    yield objectArray.pop();
  }
}


const file = await Deno.open("./out.csv", { write: true, create: true });

await writeCSVObjects(file, asyncObjectsGenerator(transferList), { header: Object.keys(transferList[0]) } );
file.close();

console.log(`Total ETH sent: ${utils.formatEther(sumEth)}`);
console.log(`Total COW sent: ${utils.formatEther(sumCow)}`);

if (valid) {
  console.log("The transaction is valid!");
} else {
  console.log(
    "The transaction is **invalid** and should not be signed without further investigation",
  );
}
