A tiny static HTML page for extracting Safe Multi-Transfers from transaction ids

# Build & Run the Web UI

Building the static page requires:
- POSIX environment, specifically `make` and `sed`
- [Deno](https://deno.land) for bundling JavaScript
- _Optionally_ [cURL](https://curl.se) for uploading to IPFS

```sh
make # builds dist/index.html static page
make host # builds the static HTML page hosts it locally on port 8000
make ipfs # builds the static HTML page and uploads it to IPFS
make clean # cleans up the dist/ directory
```

# Basic CLI Setup

```sh
brew install deno (macOS)
git clone git@github.com:bh2smith/safe-tx-accounter.git
cd safe-tx-accounter
```

Then, when you have a multisend transaction to verify, fetch the transaction ID from the URL. For example, everythign that comes after `id=` in the following example URL:

https://app.safe.global/transactions/tx?safe=eth:0xA03be496e67Ec29bC62F01a428683D7F9c204930&id=multisig_0xA03be496e67Ec29bC62F01a428683D7F9c204930_0x05b1ed0ddcc1b03c97421d91372b82f67cb1c8fed80de1f856bdfc7b1ed842d7

```sh
export TX_ID=multisig_0xA03be496e67Ec29bC62F01a428683D7F9c204930_0x05b1ed0ddcc1b03c97421d91372b82f67cb1c8fed80de1f856bdfc7b1ed842d7
deno run \
  --allow-read="./" \
  --allow-write="./out.csv" \
  --allow-net=safe-client.safe.global \
  -- \
  "./transfer-accounter.ts" \
  $TX_ID
```

This will validate and generate the CSV File corresponding to the following Solver Payout Transaction.

See Example output [example.out.csv](./example.out.csv)!
