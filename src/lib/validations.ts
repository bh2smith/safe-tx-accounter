import { fullNameIfAvailable } from "./util.ts";
import { AddressBookEntry, SafeTransaction, TxDetails } from "./models.ts";
import { COW_TOKEN } from "./constants.ts";

export function notifyIfNot(condition: boolean, msg: string): void {
  if (!condition) {
    console.log(msg);
  }
}
export function notifyIfDifferent(
  real: unknown,
  expected: unknown,
  msg: string
): void {
  if (real !== expected) {
    console.log(`Expected: ${expected}; is: ${real}.`, msg);
  }
}

export function isSameAddress(lhs: string, rhs: string): boolean {
  return lhs.toLowerCase() == rhs.toLowerCase();
}

export function basicTxValidation(
  addressBook: AddressBookEntry[],
  txDetails: TxDetails
): void {
  const multisendCallOnly = "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D";
  notifyIfDifferent(
    txDetails.txInfo.to.value,
    multisendCallOnly,
    `Invalid tx target: should be the multisend address, is ${fullNameIfAvailable(
      addressBook,
      txDetails.txInfo.to.value
    )}`
  );
  notifyIfDifferent(
    txDetails.txData.dataDecoded.method,
    "multiSend",
    `Invalid method for multisend: should be multiSend, is ${txDetails.txData.dataDecoded.method}`
  );
  notifyIfDifferent(
    txDetails.txData.value,
    "0",
    "Transaction should be sending zero ETH to the multisend contract"
  );
}

export function validateETHTransfer(
  tx: SafeTransaction,
  name: string,
  recipientList: string[],
  addressBook: AddressBookEntry[]
): void {
  notifyIfDifferent(
    tx.data,
    null,
    `${name} should have no data as it sends native tokens`
  );
  notifyIfNot(
    recipientList.includes(tx.to),
    `${name} sends ETH to address ${fullNameIfAvailable(
      addressBook,
      tx.to
    )} that is not in the solver list`
  );
}

export function validateWethUnwrap(tx: SafeTransaction, name: string): void {
  const { method } = tx.dataDecoded;
  notifyIfDifferent(
    method,
    "withdraw",
    `${name} is interacting with WETH but not unwrapping (call to ${method})`
  );
  notifyIfDifferent(
    tx.value,
    "0",
    `${name} also sends the native token in a WETH unwrap`
  );
}

export function validateErc20Transfer(
  tx: SafeTransaction,
  name: string,
  tokenAddress: string
): void {
  notifyIfDifferent(
    tokenAddress,
    COW_TOKEN,
    `${name} is sending a token that isn't COW or the native token. Please check if the CSV has been generated correctly`
  );
  notifyIfDifferent(
    tx.to,
    tokenAddress,
    `${name} is not sending out the expected token`
  );
  notifyIfDifferent(
    tx.value,
    "0",
    `${name} also sends the native token in a token transfer`
  );
  notifyIfDifferent(
    tx.dataDecoded.method,
    "transfer",
    `${name} is not doing a token transfer`
  );
  notifyIfDifferent(
    tx.dataDecoded.parameters.length,
    2,
    `${name} doesn't have the right amount of parameters for a transfer`
  );
}

export function validateExpectedRecipients(
  tx: SafeTransaction,
  addressBook: AddressBookEntry[],
  recipientList: string[],
  receiver: string
): void {
  const receiverName = fullNameIfAvailable(addressBook, receiver);
  notifyIfNot(
    recipientList.includes(receiver),
    `${JSON.stringify(
      tx
    )} sends to ${receiverName} that is not in the expected recipient list`
  );
}
