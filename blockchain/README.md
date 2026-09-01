# Auctory blockchain workspace

Isolated Hardhat + TypeScript workspace for the `AuctoryCertificate` ERC-721 contract.
It has its own `package.json` and `node_modules` and is **not** part of the Vite app build
or the app TypeScript project.

```bash
cd blockchain
npm install
npm run compile     # hardhat compile
npm test            # hardhat test
npm run export-abi  # writes abi/AuctoryCertificate.json
```

Pinned toolchain: Solidity `0.8.24` (optimizer on, 200 runs, viaIR off, EVM `shanghai`),
`@openzeppelin/contracts@5.0.2`, Hardhat `2.22.17`, ethers `6.13.4`.

No networks other than the local Hardhat network are configured, and no private keys are used
or stored. Manual Sepolia deployment instructions live in [REMIX.md](./REMIX.md).

## Contract summary

- `registerProduct(productRef, sellerWallet, tokenURI, metadataHash)` — `MINTER_ROLE`, mints one
  token (IDs start at 1) to the seller's verified wallet, once per `productRef`.
- `completeSale(saleRef, productRef, buyerWallet, saleDataHash)` — `TRANSFER_ROLE`, controlled
  transfer to the buyer's verified wallet, once per `saleRef`.
- Custody lock: all public transfer and approval entry points revert; only `completeSale` moves a
  token, via an `_update` override guarded by an internal flag that is set and cleared around the
  internal transfer.
- `pause()` / `unpause()` and role management under `DEFAULT_ADMIN_ROLE`.
