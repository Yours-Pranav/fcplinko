import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers } from "ethers";

interface User {
  id: number;
  walletAddress: string;
  farcasterHandle?: string;
}

interface WalletContextType {
  isConnected: boolean;
  user: User | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  connectWallet: () => Promise<void>;
  disconnect: () => void;
  apiRequest: (method: string, url: string, data?: any) => Promise<Response>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Check for existing authentication on mount
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const userData = localStorage.getItem("user");
    
    if (token && userData) {
      setAuthToken(token);
      setUser(JSON.parse(userData));
      setIsConnected(true);
      
      // Try to reconnect to MetaMask
      initializeProvider();
    }
  }, []);

  const initializeProvider = async () => {
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
      
      try {
        const signer = await provider.getSigner();
        setSigner(signer);
      } catch (error) {
        console.error("Failed to get signer:", error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      throw new Error("MetaMask not installed");
    }

    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" });
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
      
      const signer = await provider.getSigner();
      setSigner(signer);
      
      const walletAddress = await signer.getAddress();
      
      // Get authentication challenge
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      if (!challengeResponse.ok) {
        throw new Error("Failed to get challenge");
      }

      const { message, challengeToken } = await challengeResponse.json();
      
      // Sign the challenge message
      const signature = await signer.signMessage(message);
      
      // Verify signature and get auth token
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, signature }),
      });

      if (!verifyResponse.ok) {
        throw new Error("Failed to verify signature");
      }

      const { token, user: userData } = await verifyResponse.json();
      
      // Store authentication data
      localStorage.setItem("authToken", token);
      localStorage.setItem("user", JSON.stringify(userData));
      
      setAuthToken(token);
      setUser(userData);
      setIsConnected(true);
      
    } catch (error) {
      console.error("Wallet connection failed:", error);
      throw error;
    }
  };

  const disconnect = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    
    setAuthToken(null);
    setUser(null);
    setProvider(null);
    setSigner(null);
    setIsConnected(false);
  };

  const apiRequest = async (method: string, url: string, data?: any): Promise<Response> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    // Handle authentication errors
    if (response.status === 401) {
      disconnect();
      throw new Error("Authentication required");
    }

    return response;
  };

  const contextValue: WalletContextType = {
    isConnected,
    user,
    provider,
    signer,
    connectWallet,
    disconnect,
    apiRequest,
  };

  return React.createElement(WalletContext.Provider, { value: contextValue }, children);
}
