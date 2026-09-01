# AuctoryCertificate — isolated Hardhat workspace (no Sepolia deploy)

A new `blockchain/` folder at the project root with its own `package.json`, `node_modules`, and TypeScript config. It is excluded from the Vite build and app typecheck, so the running app is untouched. No deployment, no private keys.

## 1. Workspace

- `blockchain/` with pinned versions: Solidity `0.8.24`, `@openzeppelin/contracts@5.0.2`, Hardhat 2.x + `@nomicfoundation/hardhat-toolbox`, ethers v6, TypeScript, Chai.
- Compiler settings pinned in `hardhat.config.ts`: optimizer enabled, `runs: 200`, `viaIR: false`, `evmVersion: "shanghai"` — the exact same settings are repeated in the Remix guide so bytecode matches.
- Root `.gitignore` / `.prettierignore` / tsconfig excludes updated so `blockchain/` never enters the Vite or app TypeScript graph. `blockchain/node_modules`, `artifacts`, `cache`, `coverage`, and generated typechain types are gitignored; `blockchain/abi/AuctoryCertificate.json` stays tracked.


## 2. Contract `AuctoryCertificate`

ERC721URIStorage + AccessControl + Pausable.

- Constructor takes an operator address: deployer gets `DEFAULT_ADMIN_ROLE`, operator gets `MINTER_ROLE` and `TRANSFER_ROLE`. Zero-address operator reverts.
- `registerProduct(bytes32 productRef, address sellerWallet, string tokenURI, bytes32 metadataHash)` — `MINTER_ROLE` only, `whenNotPaused`:
  - reverts on zero `productRef`, zero `metadataHash`, empty `tokenURI`, zero seller wallet, or an already-registered `productRef`;
  - mints exactly one token to the seller wallet and sets the token URI; token IDs start at 1, so 0 stays the unregistered default;
  - stores `{ tokenId, metadataHash, registeredAt, initialSeller, registeredBy }` plus `productRef → tokenId` and `tokenId → productRef` lookups;
  - emits `ProductRegistered(productRef, tokenId, sellerWallet, metadataHash, operator, timestamp)`.
- `completeSale(bytes32 saleRef, bytes32 productRef, address buyerWallet, bytes32 saleDataHash)` — `TRANSFER_ROLE` only, `whenNotPaused`:
  - reverts on zero `saleRef`, zero `saleDataHash`, zero buyer, unknown product, duplicate `saleRef`, or buyer already the current owner;
  - performs the transfer through the internal controlled path;
  - records `{ productRef, tokenId, seller, buyer, saleDataHash, completedAt, operator }`;
  - emits the standard `Transfer` plus `SaleCompleted(saleRef, productRef, tokenId, seller, buyer, saleDataHash, timestamp)`.
- Controlled-custody lock (OpenZeppelin 5.0.2 correct form): the three-argument `safeTransferFrom` is non-virtual and is not overridden. Instead an `_update` override rejects any owner-to-nonzero-address transfer unless an internal controlled-sale flag is set, so every public transfer variant — `transferFrom`, both `safeTransferFrom` overloads — reverts with `TransfersDisabled()`. Minting (from zero) stays allowed. `approve` and `setApprovalForAll` are explicitly overridden to revert.
- `completeSale` sets the internal flag only immediately around the internal transfer and resets it right after. Because verified Auctory wallets are MetaMask EOAs, the transfer uses the internal controlled path so the flag is never active during an external receiver callback.
- Admin-only `pause()` / `unpause()`; role management via standard AccessControl `grantRole`/`revokeRole` under `DEFAULT_ADMIN_ROLE`.
- View helpers: `getProduct(productRef)`, `getSale(saleRef)`, `tokenIdOf(productRef)`, `productRefOf(tokenId)`, `isProductRegistered`, `isSaleProcessed`. Unknown `tokenIdOf` / `productRefOf` lookups revert instead of returning ambiguous zero defaults.
- `supportsInterface` covers ERC165, ERC721, ERC721Metadata, AccessControl.

## 3. Tests (`blockchain/test/AuctoryCertificate.test.ts`)

Deployment roles; unauthorized `registerProduct`/`completeSale`/`pause` revert; mint count and initial ownership; first token ID is 1; token URI; stored metadata hash and registration fields; duplicate `productRef` reverts; every zero/empty validation (zero `productRef`, zero `metadataHash`, empty `tokenURI`, zero seller, zero `saleRef`, zero `saleDataHash`, zero buyer); unknown `tokenIdOf` / `productRefOf` / `getProduct` / `getSale` lookups revert; controlled transfer moves ownership and emits both `Transfer` and `SaleCompleted`; every public transfer overload reverts for the owner and for an approved-attempt caller — `transferFrom`, `safeTransferFrom(address,address,uint256)`, `safeTransferFrom(address,address,uint256,bytes)` — plus `approve` and `setApprovalForAll`; duplicate `saleRef` reverts; paused state blocks register and sale, unpause restores; `supportsInterface` matrix.

Run `npx hardhat compile` and `npx hardhat test` in `blockchain/` and report results.

## 4. ABI export and Remix guide

- Export script writes `blockchain/abi/AuctoryCertificate.json` (ABI only) after compile.
- `blockchain/REMIX.md`: exact compiler version `0.8.24+commit.e11b9ed9`, EVM version `shanghai`, optimizer enabled with 200 runs, viaIR disabled, flattened-vs-import instructions, constructor argument (operator address), Injected Provider deployment to Sepolia, and Etherscan verification steps including ABI-encoded constructor args.

## 5. Out of scope for this step

No Sepolia deployment, no private keys, no app wiring, no database or UI changes. Frontend integration comes in a later step.
