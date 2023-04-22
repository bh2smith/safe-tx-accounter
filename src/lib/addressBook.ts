import * as path from "https://deno.land/std@0.136.0/path/mod.ts";
import { AddressBookEntry } from "./models.ts";
import { readCSVObjects } from "https://deno.land/x/csv@v0.7.4/mod.ts";
import { utils } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";

export interface AddressCollection {
  addressBook: AddressBookEntry[];
  solvers: string[];
  rewardTargets: string[];
}

export async function addressBookFromCSV(
  fileName: string
): Promise<AddressCollection> {
  const scriptPath = new URL(import.meta.url).pathname;
  const addressbookPath = path.join(
    scriptPath.slice(0, scriptPath.lastIndexOf("/")),
    fileName
  );
  const solvers: string[] = [];
  const rewardTargets: string[] = [];
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
        rewardTargets.push(possibleAddress);
      }
    }
  }
  return { addressBook, solvers, rewardTargets };
}
