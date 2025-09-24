import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Ticket, Clock, Trophy, Coins } from "lucide-react";
import { useWallet } from "../lib/wallet";

interface GameUIProps {
  user: {
    id: number;
    walletAddress: string;
    farcasterHandle?: string;
  } | null;
}

interface TicketInfo {
  remainingTickets: number;
}

export function GameUI({ user }: GameUIProps) {
  const { apiRequest } = useWallet();
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTicketInfo();
      
      // Poll for ticket updates every 30 seconds
      const interval = setInterval(fetchTicketInfo, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchTicketInfo = async () => {
    try {
      const response = await apiRequest("GET", "/api/tickets");
      const data = await response.json();
      setTicketInfo(data);
    } catch (error) {
      console.error("Failed to fetch ticket info:", error);
    }
  };

  if (!user) return null;

  return (
    <div className="flex gap-4 flex-wrap">
      {/* User Info */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm">Player</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-gray-200 text-sm">
            {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
          </p>
          {user.farcasterHandle && (
            <p className="text-purple-300 text-xs">@{user.farcasterHandle}</p>
          )}
        </CardContent>
      </Card>

      {/* Tickets */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {ticketInfo ? (
            <div className="flex items-center gap-2">
              <Badge 
                variant={ticketInfo.remainingTickets > 0 ? "default" : "secondary"}
                className="bg-green-500/20 text-green-200"
              >
                {ticketInfo.remainingTickets} remaining
              </Badge>
              {ticketInfo.remainingTickets === 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  Reset in 24h
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-sm">Loading...</div>
          )}
        </CardContent>
      </Card>

      {/* How to Play */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            How to Play
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xs text-gray-300 space-y-1">
            <p>• Press SPACE to drop a ball</p>
            <p>• Win $0.01 - $1.00 per drop</p>
            <p>• Claim USDC on Arbitrum</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Prize Range
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-green-400 font-bold">
            $0.01 - $1.00
          </div>
          <div className="text-xs text-gray-400">
            per ball drop
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
