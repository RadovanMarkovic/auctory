# Deploying `AuctoryCertificate` with Remix

This workspace is isolated from the Auctory web app. Nothing here is deployed automatically,
and no private keys are stored or required by this repository. Deployment is a manual step
you perform yourself in Remix with MetaMask.

## 1. Compiler settings (must match exactly)

Reproducing the same bytecode requires identical settings to `hardhat.config.ts`:

| Setting              | Value                      |
| -------------------- | -------------------------- |
| Compiler             | `0.8.24+commit.e11b9ed9`   |
| Language             | Solidity                   |
| EVM version          | `shanghai`                 |
| Optimization         | Enabled                    |
| Optimizer runs       | `200`                      |
| via IR               | Disabled (unchecked)       |
| License              | MIT                        |

In Remix: **Solidity Compiler** tab → select `0.8.24+commit.e11b9ed9` → **Advanced Configurations**
→ EVM Version `shanghai`, Enable optimization, runs `200`.

## 2. Source

Two options:

- **Direct import (recommended).** Create `AuctoryCertificate.sol` in Remix and paste the contents of
  `blockchain/contracts/AuctoryCertificate.sol`. Remix resolves the `@openzeppelin/contracts/...`
  imports from npm automatically — it will pull the latest 5.x. To pin **5.0.2** exactly, rewrite the
  four imports to:
  ```solidity
  import {ERC721} from "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/token/ERC721/ERC721.sol";
  import {IERC721} from "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/token/ERC721/IERC721.sol";
  import {ERC721URIStorage} from "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
  import {AccessControl} from "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/access/AccessControl.sol";
  import {Pausable} from "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/utils/Pausable.sol";
  ```
- **Flattened source.** Generate one file locally and paste it into Remix:
  ```bash
  cd blockchain
  npx hardhat flatten contracts/AuctoryCertificate.sol > AuctoryCertificate.flat.sol
  ```
  Remove the duplicated `// SPDX-License-Identifier` lines, keeping a single one at the top.
  Flattened source is the easiest input for Etherscan "Solidity (Single file)" verification.

## 3. Constructor

```solidity
constructor(address operator)
```

- `operator` — the Auctory backend operator wallet. It receives `MINTER_ROLE` and `TRANSFER_ROLE`.
- The **deploying** wallet receives `DEFAULT_ADMIN_ROLE` (pause/unpause and role management).
- `operator` must not be the zero address; deployment reverts with `ZeroAddressNotAllowed()`.

Use two different wallets for admin and operator in production.

## 4. Deploying to Sepolia

1. In MetaMask, switch to **Sepolia** (chain ID `11155111`) and fund the deployer with test ETH.
2. In Remix: **Deploy & Run Transactions** tab → Environment **Injected Provider - MetaMask**.
3. Confirm the account shown is your intended admin wallet and the network reads Sepolia (11155111).
4. Contract: `AuctoryCertificate`.
5. In the deploy field, enter the operator address, e.g.
   `0x1111111111111111111111111111111111111111`.
6. Click **Deploy** and confirm in MetaMask.
7. Record the deployed contract address and the deployment transaction hash.

Post-deployment sanity checks (Remix, read functions):
`DEFAULT_ADMIN_ROLE` + `hasRole` for the deployer, `MINTER_ROLE`/`TRANSFER_ROLE` + `hasRole` for the
operator, `name()` = `Auctory Certificate`, `symbol()` = `AUCT`, `totalMinted()` = `0`.

## 5. Etherscan verification (Sepolia)

Remix plugin route: activate the **Contract Verification** (Etherscan) plugin, provide your
Etherscan API key, pick the contract and address, and supply the constructor arguments.

Manual route on `sepolia.etherscan.io` → Contract → **Verify and Publish**:

- Compiler type: `Solidity (Single file)` for flattened source, or `Solidity (Standard-Json-Input)`
  using `blockchain/artifacts/build-info/*.json` (`input` field) for an exact match.
- Compiler version: `v0.8.24+commit.e11b9ed9`
- Open source license: MIT
- Optimization: Yes, runs `200`
- EVM version: `shanghai`
- Constructor arguments ABI-encoded: the operator address, left-padded to 32 bytes and **without**
  the `0x` prefix. Example for operator `0x1111111111111111111111111111111111111111`:
  ```
  0000000000000000000000001111111111111111111111111111111111111111
  ```
  Generate it for your own address with:
  ```bash
  cd blockchain
  npx hardhat console
  > new (require("ethers").AbiCoder)().encode(["address"], ["0xYourOperatorAddress"])
  ```

## 6. ABI

`blockchain/abi/AuctoryCertificate.json` holds the exported ABI (regenerate with
`npm run export-abi`). Use it later for app-side integration.

## 7. Operational notes

- Certificates are custody-locked: `approve`, `setApprovalForAll`, `transferFrom` and both
  `safeTransferFrom` overloads always revert with `TransfersDisabled()` / `ApprovalsDisabled()`.
  Ownership only changes through `completeSale`, called by a `TRANSFER_ROLE` holder.
- `registerProduct` and `completeSale` are blocked while paused; the admin controls `pause()` /
  `unpause()`.
- Token IDs start at `1`; `0` always means "not registered".
