// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ClaimVault
 * @notice Smart contract for redeeming USDC vouchers from the Farcaster Plinko game
 * @dev Uses ECDSA signature verification to validate server-issued vouchers
 */
contract ClaimVault is Ownable, Pausable, ReentrancyGuard {
    IERC20 public immutable usdc;
    address public signer; // Backend signer address
    
    mapping(bytes32 => bool) public redeemed; // Track redeemed vouchers
    
    uint256 public totalRedeemed; // Total USDC redeemed (in wei)
    uint256 public totalVouchers; // Total number of vouchers redeemed
    
    event Redeemed(
        address indexed recipient,
        uint256 amountCents,
        uint256 amountTokens,
        bytes32 nonce,
        bytes32 voucherHash
    );
    
    event SignerUpdated(address oldSigner, address newSigner);
    event FundsDeposited(address depositor, uint256 amount);
    event FundsWithdrawn(address recipient, uint256 amount);

    error InvalidSignature();
    error VoucherExpired();
    error AlreadyRedeemed();
    error RecipientMismatch();
    error InsufficientFunds();
    error InvalidAmount();
    error ZeroAddress();

    /**
     * @notice Initialize the contract
     * @param _owner Contract owner address
     * @param _signer Backend signer address
     * @param _usdc USDC token contract address
     */
    constructor(
        address _owner,
        address _signer,
        address _usdc
    ) {
        if (_owner == address(0) || _signer == address(0) || _usdc == address(0)) {
            revert ZeroAddress();
        }
        
        _transferOwnership(_owner);
        signer = _signer;
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Redeem a voucher for USDC
     * @param amountCents Prize amount in cents (1-100)
     * @param recipient Recipient address (must be msg.sender)
     * @param nonce Unique voucher identifier
     * @param expiry Voucher expiry timestamp
     * @param signature Server signature
     */
    function redeem(
        uint256 amountCents,
        address recipient,
        bytes32 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        // Validate inputs
        if (block.timestamp > expiry) revert VoucherExpired();
        if (recipient != msg.sender) revert RecipientMismatch();
        if (amountCents == 0 || amountCents > 100) revert InvalidAmount();

        // Generate voucher hash
        bytes32 voucherHash = keccak256(
            abi.encodePacked(amountCents, recipient, nonce, expiry, address(this))
        );

        // Check if already redeemed
        if (redeemed[voucherHash]) revert AlreadyRedeemed();

        // Verify signature
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", voucherHash)
        );
        
        address recovered = _recoverSigner(ethSignedMessageHash, signature);
        if (recovered != signer) revert InvalidSignature();

        // Mark as redeemed
        redeemed[voucherHash] = true;

        // Calculate USDC amount (6 decimals)
        uint256 amountTokens = amountCents * 1e4; // Convert cents to USDC units

        // Check contract balance
        if (usdc.balanceOf(address(this)) < amountTokens) {
            revert InsufficientFunds();
        }

        // Update statistics
        totalRedeemed += amountTokens;
        totalVouchers++;

        // Transfer USDC
        usdc.transfer(recipient, amountTokens);

        emit Redeemed(recipient, amountCents, amountTokens, nonce, voucherHash);
    }

    /**
     * @notice Check if a voucher has been redeemed
     * @param amountCents Prize amount in cents
     * @param recipient Recipient address
     * @param nonce Unique voucher identifier
     * @param expiry Voucher expiry timestamp
     * @return isRedeemed Whether the voucher has been redeemed
     */
    function isVoucherRedeemed(
        uint256 amountCents,
        address recipient,
        bytes32 nonce,
        uint256 expiry
    ) external view returns (bool isRedeemed) {
        bytes32 voucherHash = keccak256(
            abi.encodePacked(amountCents, recipient, nonce, expiry, address(this))
        );
        return redeemed[voucherHash];
    }

    /**
     * @notice Deposit USDC into the contract
     * @param amount Amount to deposit
     */
    function deposit(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        
        usdc.transferFrom(msg.sender, address(this), amount);
        emit FundsDeposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw USDC from the contract (owner only)
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdraw(uint256 amount, address recipient) external onlyOwner {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert ZeroAddress();
        
        usdc.transfer(recipient, amount);
        emit FundsWithdrawn(recipient, amount);
    }

    /**
     * @notice Emergency withdraw all USDC (owner only)
     * @param recipient Recipient address
     */
    function emergencyWithdraw(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        
        uint256 balance = usdc.balanceOf(address(this));
        if (balance > 0) {
            usdc.transfer(recipient, balance);
            emit FundsWithdrawn(recipient, balance);
        }
    }

    /**
     * @notice Update the signer address (owner only)
     * @param newSigner New signer address
     */
    function updateSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        
        address oldSigner = signer;
        signer = newSigner;
        emit SignerUpdated(oldSigner, newSigner);
    }

    /**
     * @notice Pause the contract (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Get contract statistics
     * @return balance Current USDC balance
     * @return redeemed Total USDC redeemed
     * @return vouchers Total vouchers redeemed
     */
    function getStats() external view returns (
        uint256 balance,
        uint256 redeemed,
        uint256 vouchers
    ) {
        return (
            usdc.balanceOf(address(this)),
            totalRedeemed,
            totalVouchers
        );
    }

    /**
     * @notice Recover signer from signature
     * @param hash Message hash
     * @param signature Signature bytes
     * @return Recovered signer address
     */
    function _recoverSigner(
        bytes32 hash,
        bytes calldata signature
    ) internal pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }

        if (v < 27) v += 27;

        return ecrecover(hash, v, r, s);
    }
}
