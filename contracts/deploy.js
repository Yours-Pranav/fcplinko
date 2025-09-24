const hre = require("hardhat");

async function main() {
  console.log("Deploying ClaimVault contract...");

  // Get configuration from environment
  const owner = process.env.OWNER_ADDRESS || process.env.DEPLOYER_ADDRESS;
  const signer = process.env.SIGNER_ADDRESS;
  const usdc = process.env.USDC_ADDRESS;

  if (!owner || !signer || !usdc) {
    throw new Error("Missing required environment variables: OWNER_ADDRESS, SIGNER_ADDRESS, USDC_ADDRESS");
  }

  // Deploy the contract
  const ClaimVault = await hre.ethers.getContractFactory("ClaimVault");
  const claimVault = await ClaimVault.deploy(owner, signer, usdc);

  await claimVault.deployed();

  console.log("ClaimVault deployed to:", claimVault.address);
  console.log("Owner:", owner);
  console.log("Signer:", signer);
  console.log("USDC:", usdc);

  // Wait for block confirmations
  console.log("Waiting for block confirmations...");
  await claimVault.deployTransaction.wait(5);

  // Verify contract on Arbiscan (if API key is available)
  if (process.env.ARBISCAN_API_KEY) {
    console.log("Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: claimVault.address,
        constructorArguments: [owner, signer, usdc],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Contract verification failed:", error.message);
    }
  }

  // Output deployment information
  console.log("\n=== Deployment Complete ===");
  console.log(`ClaimVault Address: ${claimVault.address}`);
  console.log(`Transaction Hash: ${claimVault.deployTransaction.hash}`);
  console.log(`Block Number: ${claimVault.deployTransaction.blockNumber}`);
  console.log(`Gas Used: ${claimVault.deployTransaction.gasLimit?.toString()}`);
  
  console.log("\n=== Next Steps ===");
  console.log("1. Add CLAIM_VAULT_ADDRESS to your .env file:");
  console.log(`   CLAIM_VAULT_ADDRESS=${claimVault.address}`);
  console.log("2. Deposit USDC into the contract using the deposit() function");
  console.log("3. Update your frontend configuration with the new contract address");
  
  return claimVault.address;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = { main };
