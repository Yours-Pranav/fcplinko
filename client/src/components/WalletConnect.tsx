import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Loader2, Wallet } from "lucide-react";
import { useWallet } from "../lib/wallet";

export function WalletConnect() {
  const [isConnecting, setIsConnecting] = useState(false);
  const { connectWallet, isConnected, user } = useWallet();

  const handleConnect = async () => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);
    try {
      await connectWallet();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  if (isConnected && user) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Connect Wallet
        </CardTitle>
        <CardDescription>
          Connect your wallet to start playing Plinko and earning USDC prizes!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full"
          size="lg"
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Connect MetaMask
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
