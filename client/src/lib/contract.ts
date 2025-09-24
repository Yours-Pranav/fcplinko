import { ethers } from "ethers";

// Use a default address for demo purposes
// In production, this would come from environment variables or config
const CLAIM_VAULT_ADDRESS = "0x0000000000000000000000000000000000000000";

// ClaimVault ABI - only the functions we need
const CLAIM_VAULT_ABI = [
  "function redeem(uint256 amountCents, address recipient, bytes32 nonce, uint256 expiry, bytes signature) external",
  "function redeemed(bytes32) view returns (bool)",
  "event Redeemed(address indexed to, uint256 amount, bytes32 nonce, bytes signature, bytes32 voucherHash)"
];

interface Voucher {
  id: number;
  recipient: string;
  amountCents: number;
  nonce: string;
  expiry: number;
  signature: string;
  issuedAt: string;
  redeemedAt: string | null;
  txHash: string | null;
}

interface RedemptionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export async function redeemVoucher(voucher: Voucher): Promise<RedemptionResult> {
  try {
    // Check if MetaMask is available
    if (typeof window.ethereum === "undefined") {
      return { success: false, error: "MetaMask not installed" };
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CLAIM_VAULT_ADDRESS, CLAIM_VAULT_ABI, signer);

    // Check if already redeemed
    const voucherHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "bytes32", "uint256", "address"],
      [voucher.amountCents, voucher.recipient, voucher.nonce, voucher.expiry, CLAIM_VAULT_ADDRESS]
    );

    const isRedeemed = await contract.redeemed(voucherHash);
    if (isRedeemed) {
      return { success: false, error: "Voucher already redeemed" };
    }

    // Check expiry
    if (Date.now() / 1000 > voucher.expiry) {
      return { success: false, error: "Voucher has expired" };
    }

    // Switch to Arbitrum network if needed
    const network = await provider.getNetwork();
    const ARBITRUM_CHAIN_ID = BigInt(42161); // Arbitrum One

    if (network.chainId !== ARBITRUM_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa4b1' }], // Arbitrum One
        });
      } catch (switchError: any) {
        // Chain not added to MetaMask
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xa4b1',
              chainName: 'Arbitrum One',
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://arb1.arbitrum.io/rpc'],
              blockExplorerUrls: ['https://arbiscan.io/']
            }]
          });
        } else {
          throw switchError;
        }
      }
    }

    // Estimate gas
    const gasEstimate = await contract.redeem.estimateGas(
      voucher.amountCents,
      voucher.recipient,
      voucher.nonce,
      voucher.expiry,
      voucher.signature
    );

    // Execute redemption with extra gas buffer
    const tx = await contract.redeem(
      voucher.amountCents,
      voucher.recipient,
      voucher.nonce,
      voucher.expiry,
      voucher.signature,
      {
        gasLimit: gasEstimate * BigInt(120) / BigInt(100) // 20% buffer
      }
    );

    console.log("Redemption transaction submitted:", tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log("Redemption successful:", receipt.hash);
      return { success: true, txHash: receipt.hash };
    } else {
      return { success: false, error: "Transaction failed" };
    }

  } catch (error: any) {
    console.error("Redemption error:", error);
    
    // Parse common errors
    if (error.code === 4001) {
      return { success: false, error: "Transaction rejected by user" };
    }
    
    if (error.message?.includes("insufficient funds")) {
      return { success: false, error: "Insufficient ETH for gas fees" };
    }
    
    if (error.message?.includes("Invalid signature")) {
      return { success: false, error: "Invalid voucher signature" };
    }
    
    if (error.message?.includes("Already redeemed")) {
      return { success: false, error: "Voucher already redeemed" };
    }
    
    return { 
      success: false, 
      error: error.message || "Unknown error occurred" 
    };
  }
}

export function getArbitrumscanUrl(txHash: string): string {
  return `https://arbiscan.io/tx/${txHash}`;
}

export function getVoucherHash(voucher: Voucher): string {
  return ethers.solidityPackedKeccak256(
    ["uint256", "address", "bytes32", "uint256", "address"],
    [voucher.amountCents, voucher.recipient, voucher.nonce, voucher.expiry, CLAIM_VAULT_ADDRESS]
  );
}
