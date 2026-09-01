# AuctoryCertificate — isolated Hardhat workspace

Yes, the task is clear. A self-contained `blockchain/` workspace with its own dependencies, an access-controlled ERC-721 certificate contract, a full test suite, an exported ABI, and Remix deployment instructions. No Sepolia deployment, no private keys.

## Isolation

Everything lives in `blockchain/` with its own `package.json`, `tsconfig.json`, `node_modules`, and `.gitignore` entries. The Vite app never imports it, and the root build/typecheck/lint never touch it (added to `.prettierignore` and the ESLint ignore list).

Pinned versions: Solidity `0.8.24`, `@openzeppelin/contracts` `5.0.2`, Hardhat 2.x with `@nomicfoundation/hardhat-toolbox`, ethers v6, TypeScript, chai/mocha.

## Contract: `AuctoryCertificate`

Extends `ERC721URIStorage`, `AccessControl`, `Pausable`.

Roles
- `DEFAULT_ADMIN_ROLE` — deployer (constructor arg `admin`).
- `MINTER_ROLE`, `TRANSFER_ROLE` — granted to the constructor `operator` address.

Storage per product
```text
productRef (bytes32, unique)  ->  { tokenId, metadataHash (bytes32),
                                    registeredAt, initialSeller, registeredBy }
```
plus `tokenId -> productRef`, and `saleRef (bytes32) -> processed` for sale de-duplication.

Functions
- `registerProduct(bytes32 productRef, bytes32 metadataHash, address sellerWallet, string tokenURI)` — `MINTER_ROLE`, `whenNotPaused`. Reverts on a duplicate `productRef`, zero seller, or empty ref. Mints exactly one token to `sellerWallet`, sets the URI, emits `ProductRegistered`.
- `completeSale(bytes32 saleRef, uint256 tokenId, address buyerWallet, bytes32 saleDataHash)` — `TRANSFER_ROLE`, `whenNotPaused`. Reverts on duplicate `saleRef`, unknown token, or zero buyer. Transfers from the current owner to the buyer (emitting the standard `Transfer`), records the sale, emits `SaleCompleted`.
- `pause()` / `unpause()` — `DEFAULT_ADMIN_ROLE`.
- Role grant/revoke through inherited `AccessControl`.
- Views: `getProduct`, `isSaleProcessed`, `productRefOf`, `supportsInterface`.

Locking down ordinary transfers
- `approve`, `setApprovalForAll`, `transferFrom`, `safeTransferFrom` are overridden to revert with `TransfersDisabled()` for everyone except callers holding `TRANSFER_ROLE`. Internal movement in `completeSale` uses `_transfer`/`_update`, so the controlled path is unaffected and the standard `Transfer` event is still emitted.

Custom errors: `ProductAlreadyRegistered`, `SaleAlreadyProcessed`, `UnknownToken`, `InvalidAddress`, `InvalidRef`, `TransfersDisabled`.

## Tests (`blockchain/test/AuctoryCertificate.ts`)

Deployment roles; unauthorized `registerProduct` / `completeSale` / `pause` / role-grant calls; successful mint and initial ownership; token URI; stored metadata hash and registration fields; duplicate `productRef` rejection; controlled transfer via `completeSale` emitting both `Transfer` and `SaleCompleted`; blocked `approve` / `setApprovalForAll` / `transferFrom` / `safeTransferFrom` by a plain owner; duplicate `saleRef` rejection; paused behaviour and unpause; `supportsInterface` for ERC-165, ERC-721, ERC-721Metadata, and AccessControl.

Run `npx hardhat compile` and `npx hardhat test` in `blockchain/`, with all tests passing before finishing.

## ABI export

A script writes the compiled ABI to `blockchain/abi/AuctoryCertificate.json` (ABI only, no bytecode), runnable via `npm run export:abi`.

## Remix instructions

`blockchain/REMIX.md` with: exact compiler version `0.8.24+commit.e11b9ed9`, EVM version `paris`, optimizer enabled with 200 runs, flattened-source or import-based options, constructor arguments (`admin`, `operator`), step-by-step deployment via Injected Provider, and Etherscan verification settings matching the compiler/optimizer configuration. No network deployment is performed and no keys are requested.

## Out of scope

No Sepolia deployment, no private keys or RPC secrets, no frontend or backend wiring to the contract in this step.
