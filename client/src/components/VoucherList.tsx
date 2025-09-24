import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { ExternalLink, Gift, Clock, CheckCircle, Loader2 } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { redeemVoucher } from "../lib/contract";

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

export function VoucherList() {
  const { apiRequest, isConnected } = useWallet();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isConnected) {
      fetchVouchers();
      
      // Poll for updates every 60 seconds
      const interval = setInterval(fetchVouchers, 60000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/vouchers");
      const data = await response.json();
      setVouchers(data.vouchers || []);
    } catch (error) {
      console.error("Failed to fetch vouchers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (voucher: Voucher) => {
    if (redeeming.has(voucher.id)) return;
    
    setRedeeming(prev => new Set(prev).add(voucher.id));
    
    try {
      const result = await redeemVoucher(voucher);
      
      if (result.success && result.txHash) {
        // Update voucher status
        setVouchers(prev => 
          prev.map(v => 
            v.id === voucher.id 
              ? { ...v, redeemedAt: new Date().toISOString(), txHash: result.txHash! }
              : v
          )
        );
        
        console.log(`Voucher redeemed successfully! TX: ${result.txHash}`);
      } else {
        console.error("Redemption failed:", result.error);
      }
    } catch (error) {
      console.error("Redemption error:", error);
    } finally {
      setRedeeming(prev => {
        const next = new Set(prev);
        next.delete(voucher.id);
        return next;
      });
    }
  };

  const isExpired = (expiry: number) => {
    return Date.now() / 1000 > expiry;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getVoucherStatus = (voucher: Voucher) => {
    if (voucher.redeemedAt) return "redeemed";
    if (isExpired(voucher.expiry)) return "expired";
    return "available";
  };

  const getStatusBadge = (voucher: Voucher) => {
    const status = getVoucherStatus(voucher);
    
    switch (status) {
      case "redeemed":
        return (
          <Badge variant="outline" className="bg-green-500/20 text-green-200 border-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Redeemed
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="bg-red-500/20 text-red-200 border-red-400">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      case "available":
        return (
          <Badge variant="outline" className="bg-blue-500/20 text-blue-200 border-blue-400">
            <Gift className="h-3 w-3 mr-1" />
            Available
          </Badge>
        );
    }
  };

  if (!isConnected) {
    return (
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white text-sm">Vouchers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm">Connect wallet to view vouchers</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/10 backdrop-blur-sm border-white/20">
      <CardHeader>
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Gift className="h-4 w-4" />
          Your Vouchers ({vouchers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-4 space-y-3">
            {loading && vouchers.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-4">
                Loading vouchers...
              </div>
            ) : vouchers.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-4">
                No vouchers yet. Drop some balls to win prizes!
              </div>
            ) : (
              vouchers.map((voucher) => (
                <Card key={voucher.id} className="bg-white/5 border-white/10">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-lg font-bold text-green-400">
                        ${(voucher.amountCents / 100).toFixed(2)}
                      </div>
                      {getStatusBadge(voucher)}
                    </div>
                    
                    <div className="text-xs text-gray-400 mb-3 space-y-1">
                      <p>Won: {formatDate(voucher.issuedAt)}</p>
                      <p>Expires: {new Date(voucher.expiry * 1000).toLocaleDateString()}</p>
                      {voucher.txHash && (
                        <p className="flex items-center gap-1">
                          TX: {voucher.txHash.slice(0, 8)}...
                          <ExternalLink className="h-3 w-3" />
                        </p>
                      )}
                    </div>

                    {getVoucherStatus(voucher) === "available" && (
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleRedeem(voucher)}
                        disabled={redeeming.has(voucher.id)}
                      >
                        {redeeming.has(voucher.id) ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Redeeming...
                          </>
                        ) : (
                          "Claim on Arbitrum"
                        )}
                      </Button>
                    )}

                    {voucher.txHash && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => window.open(`https://arbiscan.io/tx/${voucher.txHash}`, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View on Arbiscan
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
