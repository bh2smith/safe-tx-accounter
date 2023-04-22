import * as path from "https://deno.land/std@0.136.0/path/mod.ts";
import { writeCSV } from "./lib/util.ts";
import { addressBookFromCSV } from "./lib/addressBook.ts";
import { basicTxValidation } from "./lib/validations.ts";
import { SAFE_TX_URL } from "./lib/constants.ts";
import { transferListFromMultisend } from "./lib/transfers.ts";

const [txid] = Deno.args;

async function main(txid: string): Promise<void> {
  const addresses = await addressBookFromCSV(
    path.join(Deno.cwd(), "AddressBook.csv")
  );
  const txDetails = await (await fetch(`${SAFE_TX_URL}/${txid}`)).json();
  basicTxValidation(addresses.addressBook, txDetails);
  const transactions = txDetails.txData.dataDecoded.parameters[0].valueDecoded;
  const transfers = transferListFromMultisend(addresses, transactions);
  await writeCSV(transfers);
}

await main(txid);
