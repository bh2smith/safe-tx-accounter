import { utils } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import { writeCSVObjects } from "https://deno.land/x/csv@v0.7.4/mod.ts";
import { AddressBookEntry, Transfer } from "./models.ts";

export function fullNameIfAvailable(
  addressBook: AddressBookEntry[],
  address: string
): string {
  const matchingEntry = addressBook.find(
    (entry) => utils.getAddress(address) === utils.getAddress(entry.address)
  );
  if (matchingEntry === undefined) {
    return address;
  } else {
    const { address, name, chainId } = matchingEntry;
    return `${address} (${name} @ chainId ${chainId})`;
  }
}

function addressCompare(a: string, b: string): number {
  if (a.toLowerCase() < b.toLowerCase()) {
    return 1;
  } else if (a.toLowerCase() > b.toLowerCase()) {
    return -1;
  } else {
    return 0;
  }
}

const asyncObjectsGenerator = async function* (objectArray: any[]) {
  objectArray.sort((x, y) => addressCompare(x.receiver, y.receiver));
  while (objectArray.length > 0) {
    yield objectArray.pop();
  }
};

export async function writeCSV(transferList: Transfer[]): Promise<void> {
  const file = await Deno.open("./out.csv", { write: true, create: true });
  await writeCSVObjects(file, asyncObjectsGenerator(transferList), {
    header: Object.keys(transferList[0]),
  });
  file.close();
}
