import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { ticketManager } from "./lib/redis";
import { cryptoService } from "./lib/crypto";
import { plinkoSimulator } from "./lib/plinko";
import { authenticate, optionalAuth, type AuthenticatedRequest } from "./middleware/auth";
import rateLimit from "express-rate-limit";

// Rate limiting
const dropRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 drops per minute
  message: { error: 'Too many drop attempts. Please try again later.' }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const jwtSecret = process.env.JWT_SECRET || "default_secret";
  const claimVaultAddress = process.env.CLAIM_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000";

  // Authentication challenge endpoint
  app.post('/api/auth/challenge', async (req, res) => {
    try {
      const { walletAddress } = req.body;
      
      if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      const nonce = cryptoService.generateNonce();
      const message = cryptoService.generateAuthMessage(walletAddress, nonce);
      
      // Store nonce temporarily (in production, use Redis with TTL)
      // For now, include in JWT for verification
      const challengeToken = jwt.sign({ walletAddress, nonce }, jwtSecret, { expiresIn: '5m' });
      
      res.json({ message, challengeToken });
    } catch (error) {
      console.error('Challenge error:', error);
      res.status(500).json({ error: 'Failed to generate challenge' });
    }
  });

  // Authentication verification endpoint
  app.post('/api/auth/verify', async (req, res) => {
    try {
      const { challengeToken, signature } = req.body;
      
      if (!challengeToken || !signature) {
        return res.status(400).json({ error: 'Missing challengeToken or signature' });
      }

      const decoded = jwt.verify(challengeToken, jwtSecret) as { walletAddress: string; nonce: string };
      const message = cryptoService.generateAuthMessage(decoded.walletAddress, decoded.nonce);
      
      const isValid = await cryptoService.verifyWalletSignature(message, signature, decoded.walletAddress);
      
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Get or create user
      let user = await storage.getUserByWallet(decoded.walletAddress);
      if (!user) {
        user = await storage.createUser({ walletAddress: decoded.walletAddress });
      }

      // Generate auth token
      const authToken = jwt.sign({ walletAddress: user.walletAddress }, jwtSecret, { expiresIn: '7d' });
      
      res.json({ 
        token: authToken, 
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          farcasterHandle: user.farcasterHandle
        }
      });
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({ error: 'Failed to verify signature' });
    }
  });

  // Get remaining tickets
  app.get('/api/tickets', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const remainingTickets = await ticketManager.getRemainingTickets(req.user!.walletAddress);
      res.json({ remainingTickets });
    } catch (error) {
      console.error('Tickets error:', error);
      res.status(500).json({ error: 'Failed to get tickets' });
    }
  });

  // Drop ball endpoint
  app.post('/api/drop', dropRateLimit, authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      
      // Check and consume ticket
      const hasTicket = await ticketManager.consumeTicket(user.walletAddress);
      if (!hasTicket) {
        return res.status(400).json({ error: 'No tickets remaining' });
      }

      // Simulate drop
      const dropResult = plinkoSimulator.simulateDrop();
      
      if (!plinkoSimulator.validateDropResult(dropResult)) {
        return res.status(500).json({ error: 'Invalid drop result' });
      }

      // Create drop history
      const dropHistory = await storage.createDropHistory({
        userId: user.id,
        amountCents: dropResult.amountCents,
        pathData: JSON.stringify(dropResult.path),
        voucherId: null
      });

      let voucher = null;

      // Create voucher if amount > 0
      if (dropResult.amountCents > 0) {
        const nonce = cryptoService.generateNonce();
        const expiry = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now
        
        const voucherData = {
          recipient: user.walletAddress,
          amountCents: dropResult.amountCents,
          nonce,
          expiry
        };

        const signature = await cryptoService.signVoucher(voucherData, claimVaultAddress);
        
        voucher = await storage.createVoucher({
          ...voucherData,
          signature,
          redeemedAt: null,
          txHash: null
        });

        // Update drop history with voucher ID
        await storage.createDropHistory({
          userId: user.id,
          amountCents: dropResult.amountCents,
          pathData: JSON.stringify(dropResult.path),
          voucherId: voucher.id
        });
      }

      const remainingTickets = await ticketManager.getRemainingTickets(user.walletAddress);

      res.json({
        dropResult,
        voucher,
        remainingTickets
      });
    } catch (error) {
      console.error('Drop error:', error);
      res.status(500).json({ error: 'Failed to process drop' });
    }
  });

  // Get user vouchers
  app.get('/api/vouchers', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const vouchers = await storage.getVouchersByUser(req.user!.walletAddress);
      res.json({ vouchers });
    } catch (error) {
      console.error('Vouchers error:', error);
      res.status(500).json({ error: 'Failed to get vouchers' });
    }
  });

  // Get drop history
  app.get('/api/history', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const history = await storage.getDropHistoryByUser(req.user!.id);
      res.json({ history });
    } catch (error) {
      console.error('History error:', error);
      res.status(500).json({ error: 'Failed to get history' });
    }
  });

  // Farcaster frame endpoint
  app.get('/frame', async (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Farcaster Plinko</title>
      <meta property="fc:frame" content="vNext">
      <meta property="fc:frame:image" content="${req.protocol}://${req.get('host')}/api/frame/image">
      <meta property="fc:frame:button:1" content="🎯 Drop Ball">
      <meta property="fc:frame:button:2" content="🎟️ Check Tickets">
      <meta property="fc:frame:button:3" content="💰 View Prizes">
      <meta property="fc:frame:post_url" content="${req.protocol}://${req.get('host')}/api/frame/action">
    </head>
    <body>
      <h1>Farcaster Plinko Game</h1>
      <p>Drop balls to win USDC prizes on Arbitrum!</p>
      <a href="${req.protocol}://${req.get('host')}">Play the full game</a>
    </body>
    </html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // Frame image generation
  app.get('/api/frame/image', async (req, res) => {
    // Simple SVG image for the frame
    const svg = `
    <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="400" fill="#1a1a2e"/>
      <text x="300" y="80" font-family="Arial" font-size="36" font-weight="bold" fill="#ffffff" text-anchor="middle">
        🎯 Farcaster Plinko
      </text>
      <text x="300" y="140" font-family="Arial" font-size="18" fill="#16213e" text-anchor="middle">
        Drop balls to win USDC prizes!
      </text>
      <text x="300" y="180" font-family="Arial" font-size="16" fill="#0f3460" text-anchor="middle">
        3 free tickets every 24 hours
      </text>
      <text x="300" y="220" font-family="Arial" font-size="16" fill="#0f3460" text-anchor="middle">
        Win $0.01 - $1.00 per drop
      </text>
      <text x="300" y="260" font-family="Arial" font-size="16" fill="#0f3460" text-anchor="middle">
        Claim prizes on Arbitrum
      </text>
      <rect x="50" y="300" width="500" height="60" fill="#e94560" rx="30"/>
      <text x="300" y="340" font-family="Arial" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">
        🚀 START PLAYING
      </text>
    </svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  });

  // Admin endpoint to reset user tickets (for testing)
  app.post('/api/admin/reset-tickets', async (req, res) => {
    try {
      const { walletAddress, adminSecret } = req.body;
      
      // Simple admin authentication
      if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await ticketManager.resetTickets(walletAddress);
      res.json({ success: true });
    } catch (error) {
      console.error('Admin reset error:', error);
      res.status(500).json({ error: 'Failed to reset tickets' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      signer: cryptoService.getSignerAddress()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
