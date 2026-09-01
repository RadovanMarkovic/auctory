// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AuctoryCertificate
 * @notice ERC-721 certificates of authenticity for Auctory products.
 *
 * Custody is fully controlled by the Auctory operator: ordinary token owners
 * cannot approve or transfer their certificates. The only way a certificate
 * changes hands is `completeSale`, callable by TRANSFER_ROLE.
 */
contract AuctoryCertificate is ERC721URIStorage, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");

    struct ProductRecord {
        uint256 tokenId;
        bytes32 metadataHash;
        uint64 registeredAt;
        address initialSeller;
        address registeredBy;
    }

    struct SaleRecord {
        bytes32 productRef;
        uint256 tokenId;
        address seller;
        address buyer;
        bytes32 saleDataHash;
        uint64 completedAt;
        address processedBy;
    }

    /// @dev Token ids start at 1 so that 0 always means "not registered".
    uint256 private _nextTokenId = 1;

    /// @dev Only true for the duration of an internal controlled transfer.
    bool private _controlledTransfer;

    mapping(bytes32 => ProductRecord) private _products;
    mapping(uint256 => bytes32) private _productRefByTokenId;
    mapping(bytes32 => SaleRecord) private _sales;

    error ZeroAddressNotAllowed();
    error EmptyValueNotAllowed();
    error ProductAlreadyRegistered(bytes32 productRef);
    error ProductNotRegistered(bytes32 productRef);
    error TokenNotRegistered(uint256 tokenId);
    error SaleAlreadyProcessed(bytes32 saleRef);
    error SaleNotFound(bytes32 saleRef);
    error BuyerAlreadyOwner(address buyer);
    error TransfersDisabled();
    error ApprovalsDisabled();

    event ProductRegistered(
        bytes32 indexed productRef,
        uint256 indexed tokenId,
        address indexed sellerWallet,
        bytes32 metadataHash,
        address operator,
        uint256 timestamp
    );

    event SaleCompleted(
        bytes32 indexed saleRef,
        bytes32 indexed productRef,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        bytes32 saleDataHash,
        uint256 timestamp
    );

    constructor(address operator) ERC721("Auctory Certificate", "AUCT") {
        if (operator == address(0)) revert ZeroAddressNotAllowed();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, operator);
        _grantRole(TRANSFER_ROLE, operator);
    }

    // ---------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------

    function registerProduct(
        bytes32 productRef,
        address sellerWallet,
        string calldata uri,
        bytes32 metadataHash
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256 tokenId) {
        if (productRef == bytes32(0) || metadataHash == bytes32(0) || bytes(uri).length == 0) {
            revert EmptyValueNotAllowed();
        }
        if (sellerWallet == address(0)) revert ZeroAddressNotAllowed();
        if (_products[productRef].tokenId != 0) revert ProductAlreadyRegistered(productRef);

        tokenId = _nextTokenId++;

        _products[productRef] = ProductRecord({
            tokenId: tokenId,
            metadataHash: metadataHash,
            registeredAt: uint64(block.timestamp),
            initialSeller: sellerWallet,
            registeredBy: msg.sender
        });
        _productRefByTokenId[tokenId] = productRef;

        _safeMint(sellerWallet, tokenId);
        _setTokenURI(tokenId, uri);

        emit ProductRegistered(
            productRef,
            tokenId,
            sellerWallet,
            metadataHash,
            msg.sender,
            block.timestamp
        );
    }

    // ---------------------------------------------------------------------
    // Controlled sale
    // ---------------------------------------------------------------------

    function completeSale(
        bytes32 saleRef,
        bytes32 productRef,
        address buyerWallet,
        bytes32 saleDataHash
    ) external onlyRole(TRANSFER_ROLE) whenNotPaused {
        if (saleRef == bytes32(0) || saleDataHash == bytes32(0)) revert EmptyValueNotAllowed();
        if (buyerWallet == address(0)) revert ZeroAddressNotAllowed();

        uint256 tokenId = _products[productRef].tokenId;
        if (tokenId == 0) revert ProductNotRegistered(productRef);
        if (_sales[saleRef].tokenId != 0) revert SaleAlreadyProcessed(saleRef);

        address seller = ownerOf(tokenId);
        if (seller == buyerWallet) revert BuyerAlreadyOwner(buyerWallet);

        _sales[saleRef] = SaleRecord({
            productRef: productRef,
            tokenId: tokenId,
            seller: seller,
            buyer: buyerWallet,
            saleDataHash: saleDataHash,
            completedAt: uint64(block.timestamp),
            processedBy: msg.sender
        });

        // Verified Auctory wallets are MetaMask EOAs: use the plain internal
        // transfer so the bypass flag is never active during an external
        // receiver callback.
        _controlledTransfer = true;
        _transfer(seller, buyerWallet, tokenId);
        _controlledTransfer = false;

        emit SaleCompleted(
            saleRef,
            productRef,
            tokenId,
            seller,
            buyerWallet,
            saleDataHash,
            block.timestamp
        );
    }

    // ---------------------------------------------------------------------
    // Custody lock
    // ---------------------------------------------------------------------

    /// @dev Blocks every public transfer path; minting and burning stay possible.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && !_controlledTransfer) {
            revert TransfersDisabled();
        }
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert ApprovalsDisabled();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert ApprovalsDisabled();
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getProduct(bytes32 productRef) external view returns (ProductRecord memory) {
        ProductRecord memory record = _products[productRef];
        if (record.tokenId == 0) revert ProductNotRegistered(productRef);
        return record;
    }

    function getSale(bytes32 saleRef) external view returns (SaleRecord memory) {
        SaleRecord memory record = _sales[saleRef];
        if (record.tokenId == 0) revert SaleNotFound(saleRef);
        return record;
    }

    function tokenIdOf(bytes32 productRef) external view returns (uint256) {
        uint256 tokenId = _products[productRef].tokenId;
        if (tokenId == 0) revert ProductNotRegistered(productRef);
        return tokenId;
    }

    function productRefOf(uint256 tokenId) external view returns (bytes32) {
        bytes32 productRef = _productRefByTokenId[tokenId];
        if (productRef == bytes32(0)) revert TokenNotRegistered(tokenId);
        return productRef;
    }

    function isProductRegistered(bytes32 productRef) external view returns (bool) {
        return _products[productRef].tokenId != 0;
    }

    function isSaleProcessed(bytes32 saleRef) external view returns (bool) {
        return _sales[saleRef].tokenId != 0;
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
