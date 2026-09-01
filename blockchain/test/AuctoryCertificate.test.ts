import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const PRODUCT_REF = ethers.id("product-1");
const PRODUCT_REF_2 = ethers.id("product-2");
const METADATA_HASH = ethers.id("metadata-1");
const SALE_REF = ethers.id("sale-1");
const SALE_HASH = ethers.id("sale-data-1");
const TOKEN_URI = "ipfs://QmAuctoryCertificate/1";
const ZERO_BYTES32 = ethers.ZeroHash;
const ZERO_ADDRESS = ethers.ZeroAddress;

async function deployFixture() {
  const [admin, operator, seller, buyer, stranger] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("AuctoryCertificate");
  const certificate = await factory.deploy(operator.address);
  await certificate.waitForDeployment();
  return { certificate, admin, operator, seller, buyer, stranger };
}

async function registeredFixture() {
  const ctx = await deployFixture();
  await ctx.certificate
    .connect(ctx.operator)
    .registerProduct(PRODUCT_REF, ctx.seller.address, TOKEN_URI, METADATA_HASH);
  return ctx;
}

describe("AuctoryCertificate", () => {
  describe("deployment and roles", () => {
    it("assigns admin to the deployer and minter/transfer to the operator", async () => {
      const { certificate, admin, operator } = await loadFixture(deployFixture);
      const adminRole = await certificate.DEFAULT_ADMIN_ROLE();
      const minterRole = await certificate.MINTER_ROLE();
      const transferRole = await certificate.TRANSFER_ROLE();

      expect(await certificate.hasRole(adminRole, admin.address)).to.equal(true);
      expect(await certificate.hasRole(minterRole, operator.address)).to.equal(true);
      expect(await certificate.hasRole(transferRole, operator.address)).to.equal(true);
      expect(await certificate.hasRole(minterRole, admin.address)).to.equal(false);
      expect(await certificate.hasRole(transferRole, admin.address)).to.equal(false);
    });

    it("exposes name and symbol", async () => {
      const { certificate } = await loadFixture(deployFixture);
      expect(await certificate.name()).to.equal("Auctory Certificate");
      expect(await certificate.symbol()).to.equal("AUCT");
    });

    it("rejects a zero operator address", async () => {
      const factory = await ethers.getContractFactory("AuctoryCertificate");
      await expect(factory.deploy(ZERO_ADDRESS)).to.be.revertedWithCustomError(
        factory,
        "ZeroAddressNotAllowed",
      );
    });

    it("supports admin role management", async () => {
      const { certificate, admin, stranger } = await loadFixture(deployFixture);
      const minterRole = await certificate.MINTER_ROLE();

      await certificate.connect(admin).grantRole(minterRole, stranger.address);
      expect(await certificate.hasRole(minterRole, stranger.address)).to.equal(true);

      await certificate.connect(admin).revokeRole(minterRole, stranger.address);
      expect(await certificate.hasRole(minterRole, stranger.address)).to.equal(false);
    });

    it("blocks role management by non-admins", async () => {
      const { certificate, stranger } = await loadFixture(deployFixture);
      const minterRole = await certificate.MINTER_ROLE();
      await expect(
        certificate.connect(stranger).grantRole(minterRole, stranger.address),
      ).to.be.revertedWithCustomError(certificate, "AccessControlUnauthorizedAccount");
    });
  });

  describe("registerProduct", () => {
    it("mints exactly one token to the seller, starting at token id 1", async () => {
      const { certificate, operator, seller } = await loadFixture(deployFixture);

      await expect(
        certificate
          .connect(operator)
          .registerProduct(PRODUCT_REF, seller.address, TOKEN_URI, METADATA_HASH),
      )
        .to.emit(certificate, "ProductRegistered")
        .withArgs(
          PRODUCT_REF,
          1n,
          seller.address,
          METADATA_HASH,
          operator.address,
          (value: bigint) => value > 0n,
        );

      expect(await certificate.ownerOf(1)).to.equal(seller.address);
      expect(await certificate.balanceOf(seller.address)).to.equal(1n);
      expect(await certificate.totalMinted()).to.equal(1n);
      expect(await certificate.tokenIdOf(PRODUCT_REF)).to.equal(1n);
      expect(await certificate.productRefOf(1)).to.equal(PRODUCT_REF);
    });

    it("stores the token URI and product record", async () => {
      const { certificate, operator, seller } = await loadFixture(registeredFixture);
      expect(await certificate.tokenURI(1)).to.equal(TOKEN_URI);

      const record = await certificate.getProduct(PRODUCT_REF);
      expect(record.tokenId).to.equal(1n);
      expect(record.metadataHash).to.equal(METADATA_HASH);
      expect(record.initialSeller).to.equal(seller.address);
      expect(record.registeredBy).to.equal(operator.address);
      expect(record.registeredAt).to.be.greaterThan(0n);
      expect(await certificate.isProductRegistered(PRODUCT_REF)).to.equal(true);
    });

    it("increments token ids across registrations", async () => {
      const { certificate, operator, seller } = await loadFixture(registeredFixture);
      await certificate
        .connect(operator)
        .registerProduct(PRODUCT_REF_2, seller.address, TOKEN_URI, METADATA_HASH);
      expect(await certificate.tokenIdOf(PRODUCT_REF_2)).to.equal(2n);
      expect(await certificate.totalMinted()).to.equal(2n);
    });

    it("rejects callers without MINTER_ROLE", async () => {
      const { certificate, admin, stranger, seller } = await loadFixture(deployFixture);
      for (const caller of [admin, stranger]) {
        await expect(
          certificate
            .connect(caller)
            .registerProduct(PRODUCT_REF, seller.address, TOKEN_URI, METADATA_HASH),
        ).to.be.revertedWithCustomError(certificate, "AccessControlUnauthorizedAccount");
      }
    });

    it("rejects duplicate product registration", async () => {
      const { certificate, operator, seller, buyer } = await loadFixture(registeredFixture);
      await expect(
        certificate
          .connect(operator)
          .registerProduct(PRODUCT_REF, buyer.address, TOKEN_URI, METADATA_HASH),
      )
        .to.be.revertedWithCustomError(certificate, "ProductAlreadyRegistered")
        .withArgs(PRODUCT_REF);
    });

    it("rejects a zero productRef", async () => {
      const { certificate, operator, seller } = await loadFixture(deployFixture);
      await expect(
        certificate
          .connect(operator)
          .registerProduct(ZERO_BYTES32, seller.address, TOKEN_URI, METADATA_HASH),
      ).to.be.revertedWithCustomError(certificate, "EmptyValueNotAllowed");
    });

    it("rejects a zero metadataHash", async () => {
      const { certificate, operator, seller } = await loadFixture(deployFixture);
      await expect(
        certificate
          .connect(operator)
          .registerProduct(PRODUCT_REF, seller.address, TOKEN_URI, ZERO_BYTES32),
      ).to.be.revertedWithCustomError(certificate, "EmptyValueNotAllowed");
    });

    it("rejects an empty tokenURI", async () => {
      const { certificate, operator, seller } = await loadFixture(deployFixture);
      await expect(
        certificate
          .connect(operator)
          .registerProduct(PRODUCT_REF, seller.address, "", METADATA_HASH),
      ).to.be.revertedWithCustomError(certificate, "EmptyValueNotAllowed");
    });

    it("rejects a zero seller wallet", async () => {
      const { certificate, operator } = await loadFixture(deployFixture);
      await expect(
        certificate
          .connect(operator)
          .registerProduct(PRODUCT_REF, ZERO_ADDRESS, TOKEN_URI, METADATA_HASH),
      ).to.be.revertedWithCustomError(certificate, "ZeroAddressNotAllowed");
    });
  });

  describe("unknown lookups", () => {
    it("reverts for unknown product lookups", async () => {
      const { certificate } = await loadFixture(deployFixture);
      await expect(certificate.tokenIdOf(PRODUCT_REF)).to.be.revertedWithCustomError(
        certificate,
        "ProductNotRegistered",
      );
      await expect(certificate.getProduct(PRODUCT_REF)).to.be.revertedWithCustomError(
        certificate,
        "ProductNotRegistered",
      );
      expect(await certificate.isProductRegistered(PRODUCT_REF)).to.equal(false);
    });

    it("reverts for unknown token ids, including token id 0", async () => {
      const { certificate } = await loadFixture(registeredFixture);
      await expect(certificate.productRefOf(0)).to.be.revertedWithCustomError(
        certificate,
        "TokenNotRegistered",
      );
      await expect(certificate.productRefOf(99)).to.be.revertedWithCustomError(
        certificate,
        "TokenNotRegistered",
      );
    });

    it("reverts for unknown sale lookups", async () => {
      const { certificate } = await loadFixture(deployFixture);
      await expect(certificate.getSale(SALE_REF)).to.be.revertedWithCustomError(
        certificate,
        "SaleNotFound",
      );
      expect(await certificate.isSaleProcessed(SALE_REF)).to.equal(false);
    });
  });

  describe("completeSale", () => {
    it("transfers the token and emits Transfer and SaleCompleted", async () => {
      const { certificate, operator, seller, buyer } = await loadFixture(registeredFixture);

      const tx = certificate
        .connect(operator)
        .completeSale(SALE_REF, PRODUCT_REF, buyer.address, SALE_HASH);

      await expect(tx)
        .to.emit(certificate, "Transfer")
        .withArgs(seller.address, buyer.address, 1n);
      await expect(tx)
        .to.emit(certificate, "SaleCompleted")
        .withArgs(
          SALE_REF,
          PRODUCT_REF,
          1n,
          seller.address,
          buyer.address,
          SALE_HASH,
          (value: bigint) => value > 0n,
        );

      expect(await certificate.ownerOf(1)).to.equal(buyer.address);
      expect(await certificate.balanceOf(seller.address)).to.equal(0n);
      expect(await certificate.balanceOf(buyer.address)).to.equal(1n);
      expect(await certificate.isSaleProcessed(SALE_REF)).to.equal(true);

      const sale = await certificate.getSale(SALE_REF);
      expect(sale.productRef).to.equal(PRODUCT_REF);
      expect(sale.tokenId).to.equal(1n);
      expect(sale.seller).to.equal(seller.address);
      expect(sale.buyer).to.equal(buyer.address);
      expect(sale.saleDataHash).to.equal(SALE_HASH);
      expect(sale.processedBy).to.equal(operator.address);
    });

    it("rejects callers without TRANSFER_ROLE", async () => {
      const { certificate, admin, stranger, buyer } = await loadFixture(registeredFixture);
      for (const caller of [admin, stranger, buyer]) {
        await expect(
          certificate.connect(caller).completeSale(SALE_REF, PRODUCT_REF, buyer.address, SALE_HASH),
        ).to.be.revertedWithCustomError(certificate, "AccessControlUnauthorizedAccount");
      }
    });

    it("rejects a duplicate sale reference", async () => {
      const { certificate, operator, buyer, stranger } = await loadFixture(registeredFixture);
      await certificate
        .connect(operator)
        .completeSale(SALE_REF, PRODUCT_REF, buyer.address, SALE_HASH);

      await expect(
        certificate.connect(operator).completeSale(SALE_REF, PRODUCT_REF, stranger.address, SALE_HASH),
      )
        .to.be.revertedWithCustomError(certificate, "SaleAlreadyProcessed")
        .withArgs(SALE_REF);
    });

    it("rejects an unregistered product", async () => {
      const { certificate, operator, buyer } = await loadFixture(registeredFixture);
      await expect(
        certificate.connect(operator).completeSale(SALE_REF, PRODUCT_REF_2, buyer.address, SALE_HASH),
      ).to.be.revertedWithCustomError(certificate, "ProductNotRegistered");
    });

    it("rejects a zero saleRef, zero saleDataHash and zero buyer", async () => {
      const { certificate, operator, buyer } = await loadFixture(registeredFixture);
      await expect(
        certificate.connect(operator).completeSale(ZERO_BYTES32, PRODUCT_REF, buyer.address, SALE_HASH),
      ).to.be.revertedWithCustomError(certificate, "EmptyValueNotAllowed");
      await expect(
        certificate.connect(operator).completeSale(SALE_REF, PRODUCT_REF, buyer.address, ZERO_BYTES32),
      ).to.be.revertedWithCustomError(certificate, "EmptyValueNotAllowed");
      await expect(
        certificate.connect(operator).completeSale(SALE_REF, PRODUCT_REF, ZERO_ADDRESS, SALE_HASH),
      ).to.be.revertedWithCustomError(certificate, "ZeroAddressNotAllowed");
    });

    it("rejects a buyer who already owns the token", async () => {
      const { certificate, operator, seller } = await loadFixture(registeredFixture);
      await expect(
        certificate.connect(operator).completeSale(SALE_REF, PRODUCT_REF, seller.address, SALE_HASH),
      )
        .to.be.revertedWithCustomError(certificate, "BuyerAlreadyOwner")
        .withArgs(seller.address);
    });

    it("does not leave the controlled-transfer flag active", async () => {
      const { certificate, operator, seller, buyer } = await loadFixture(registeredFixture);
      await certificate
        .connect(operator)
        .completeSale(SALE_REF, PRODUCT_REF, buyer.address, SALE_HASH);

      await expect(
        certificate.connect(buyer).transferFrom(buyer.address, seller.address, 1),
      ).to.be.revertedWithCustomError(certificate, "TransfersDisabled");
    });
  });

  describe("custody lock", () => {
    it("blocks approve and setApprovalForAll for everyone", async () => {
      const { certificate, seller, buyer, operator, admin } = await loadFixture(registeredFixture);
      for (const caller of [seller, buyer, operator, admin]) {
        await expect(
          certificate.connect(caller).approve(buyer.address, 1),
        ).to.be.revertedWithCustomError(certificate, "ApprovalsDisabled");
        await expect(
          certificate.connect(caller).setApprovalForAll(buyer.address, true),
        ).to.be.revertedWithCustomError(certificate, "ApprovalsDisabled");
      }
      expect(await certificate.getApproved(1)).to.equal(ZERO_ADDRESS);
      expect(await certificate.isApprovedForAll(seller.address, buyer.address)).to.equal(false);
    });

    it("blocks every public transfer overload for the owner", async () => {
      const { certificate, seller, buyer } = await loadFixture(registeredFixture);

      await expect(
        certificate.connect(seller).transferFrom(seller.address, buyer.address, 1),
      ).to.be.revertedWithCustomError(certificate, "TransfersDisabled");

      await expect(
        certificate
          .connect(seller)
          ["safeTransferFrom(address,address,uint256)"](seller.address, buyer.address, 1),
      ).to.be.revertedWithCustomError(certificate, "TransfersDisabled");

      await expect(
        certificate
          .connect(seller)
          ["safeTransferFrom(address,address,uint256,bytes)"](
            seller.address,
            buyer.address,
            1,
            "0x",
          ),
      ).to.be.revertedWithCustomError(certificate, "TransfersDisabled");

      expect(await certificate.ownerOf(1)).to.equal(seller.address);
    });

    it("blocks transfer attempts from operators, admins and strangers", async () => {
      const { certificate, operator, admin, stranger, seller, buyer } =
        await loadFixture(registeredFixture);
      for (const caller of [operator, admin, stranger]) {
        await expect(
          certificate.connect(caller).transferFrom(seller.address, buyer.address, 1),
        ).to.be.revertedWithCustomError(certificate, "TransfersDisabled");
        await expect(
          certificate
            .connect(caller)
            ["safeTransferFrom(address,address,uint256)"](seller.address, buyer.address, 1),
        ).to.be.revertedWithCustomError(certificate, "TransfersDisabled");
      }
    });
  });

  describe("pausing", () => {
    it("only the admin can pause and unpause", async () => {
      const { certificate, operator, stranger, admin } = await loadFixture(deployFixture);
      for (const caller of [operator, stranger]) {
        await expect(certificate.connect(caller).pause()).to.be.revertedWithCustomError(
          certificate,
          "AccessControlUnauthorizedAccount",
        );
      }
      await certificate.connect(admin).pause();
      expect(await certificate.paused()).to.equal(true);

      await expect(certificate.connect(stranger).unpause()).to.be.revertedWithCustomError(
        certificate,
        "AccessControlUnauthorizedAccount",
      );
      await certificate.connect(admin).unpause();
      expect(await certificate.paused()).to.equal(false);
    });

    it("blocks registration and sales while paused, and resumes after unpause", async () => {
      const { certificate, admin, operator, seller, buyer } = await loadFixture(registeredFixture);
      await certificate.connect(admin).pause();

      await expect(
        certificate
          .connect(operator)
          .registerProduct(PRODUCT_REF_2, seller.address, TOKEN_URI, METADATA_HASH),
      ).to.be.revertedWithCustomError(certificate, "EnforcedPause");

      await expect(
        certificate.connect(operator).completeSale(SALE_REF, PRODUCT_REF, buyer.address, SALE_HASH),
      ).to.be.revertedWithCustomError(certificate, "EnforcedPause");

      await certificate.connect(admin).unpause();
      await certificate
        .connect(operator)
        .completeSale(SALE_REF, PRODUCT_REF, buyer.address, SALE_HASH);
      expect(await certificate.ownerOf(1)).to.equal(buyer.address);
    });
  });

  describe("interface support", () => {
    it("supports ERC165, ERC721, ERC721Metadata and AccessControl", async () => {
      const { certificate } = await loadFixture(deployFixture);
      expect(await certificate.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC165
      expect(await certificate.supportsInterface("0x80ac58cd")).to.equal(true); // ERC721
      expect(await certificate.supportsInterface("0x5b5e139f")).to.equal(true); // ERC721Metadata
      expect(await certificate.supportsInterface("0x7965db0b")).to.equal(true); // AccessControl
      expect(await certificate.supportsInterface("0xffffffff")).to.equal(false);
    });
  });
});
