require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    arbitrum: {
      url: process.env.RPC_URL_ARBITRUM || "https://arb1.arbitrum.io/rpc",
      accounts: process.env.OWNER_PRIVATE_KEY ? [process.env.OWNER_PRIVATE_KEY] : [],
      chainId: 42161,
    },
    arbitrumGoerli: {
      url: process.env.RPC_URL_ARBITRUM_GOERLI || "https://goerli-rollup.arbitrum.io/rpc",
      accounts: process.env.OWNER_PRIVATE_KEY ? [process.env.OWNER_PRIVATE_KEY] : [],
      chainId: 421613,
    },
    arbitrumSepolia: {
      url: process.env.RPC_URL_ARBITRUM_SEPOLIA || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.OWNER_PRIVATE_KEY ? [process.env.OWNER_PRIVATE_KEY] : [],
      chainId: 421614,
    },
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      arbitrumGoerli: process.env.ARBISCAN_API_KEY || "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || "",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  mocha: {
    timeout: 20000,
  },
};
