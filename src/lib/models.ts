export interface AddressBookEntry {
  address: string;
  name: string;
  chainId: number;
}

export interface Transfer {
  receiver: string;
  amount: bigint;
  token: string;
  name: string;
}

interface Values {
  value: string;
}

interface DecodedData {
  parameters: Values[];
  method: string;
}

export interface SafeTransaction {
  to: string;
  value: bigint;
  data: string;
  dataDecoded: DecodedData;
  operation: number;
}

export interface TxInfo {
  to: { value: string };
}

export interface TxDetails {
  txInfo: TxInfo;
  txData: SafeTransaction;
}
