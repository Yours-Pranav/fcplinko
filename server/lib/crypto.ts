import { ethers } from "ethers";
import crypto from "crypto";

export interface VoucherData {
  recipient: string;
  amountCents: number;
  nonce: string;
  expiry: number;
}

export class CryptoService {
  private signerPrivateKey: string;
  private signer: ethers.Wallet;

  constructor() {
    this.signerPrivateKey = process.env.SIGNER_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;
    this.signer = new ethers.Wallet(this.signerPrivateKey);
  }

  generateNonce(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async signVoucher(voucherData: VoucherData, contractAddress: string): Promise<string> {
    // Create the message hash
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "bytes32", "uint256", "address"],
      [voucherData.amountCents, voucherData.recipient, voucherData.nonce, voucherData.expiry, contractAddress]
    );

    // Create Ethereum signed message hash
    const ethSignedMessageHash = ethers.hashMessage(ethers.getBytes(messageHash));
    
    // Sign the message
    const signature = await this.signer.signMessage(ethers.getBytes(messageHash));
    
    return signature;
  }

  async verifyWalletSignature(message: string, signature: string, expectedAddress: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  generateAuthMessage(walletAddress: string, nonce: string): string {
    return `Sign this message to authenticate with Farcaster Plinko:\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTime: ${new Date().toISOString()}`;
  }

  getSignerAddress(): string {
    return this.signer.address;
  }
}

export const cryptoService = new CryptoService();
