## Example transaction URL: 

https://app.safe.global/transactions/tx?safe=eth:0xA03be496e67Ec29bC62F01a428683D7F9c204930&id=multisig_0xA03be496e67Ec29bC62F01a428683D7F9c204930_0x05b1ed0ddcc1b03c97421d91372b82f67cb1c8fed80de1f856bdfc7b1ed842d7

```sh
deno run \
  --allow-read="./AddressBook.csv" \
  --allow-write="./out.csv" \
  --allow-net=safe-client.safe.global \
  -- \
  "./transfer-accounter.ts" \
  multisig_0xA03be496e67Ec29bC62F01a428683D7F9c204930_0x05b1ed0ddcc1b03c97421d91372b82f67cb1c8fed80de1f856bdfc7b1ed842d7
```

will generate [example.out.csv](./example.out.csv)!
