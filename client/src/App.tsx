import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { KeyboardControls } from "@react-three/drei";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/inter";
import "./index.css";

import { PlinkoBoard } from "./components/PlinkoBoard";
import { WalletConnect } from "./components/WalletConnect";
import { GameUI } from "./components/GameUI";
import { VoucherList } from "./components/VoucherList";
import { useWallet, WalletProvider } from "./lib/wallet";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// Control scheme for the game
const controls = [
  { name: "drop", keys: ["Space", "Enter"] },
  { name: "reset", keys: ["KeyR"] },
];

function GameContent() {
  const { isConnected, user } = useWallet();
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setShowGame(true);
    }
  }, [isConnected]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-white mb-4">🎯 Farcaster Plinko</h1>
          <p className="text-xl text-gray-300 mb-8">
            Drop balls to win USDC prizes on Arbitrum!
          </p>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">How to Play</h2>
            <div className="text-left text-gray-200 space-y-2">
              <p>🎟️ Get 3 free tickets every 24 hours</p>
              <p>🎯 Drop balls through the Plinko board</p>
              <p>💰 Win $0.01 - $1.00 per drop</p>
              <p>🚀 Claim prizes as USDC on Arbitrum</p>
            </div>
          </div>
        </div>
        <WalletConnect />
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-hidden">
      <KeyboardControls map={controls}>
        {/* Game UI Overlay */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4">
          <GameUI user={user} />
        </div>

        {/* Vouchers Panel */}
        <div className="absolute top-0 right-0 w-80 h-full z-10 p-4 overflow-y-auto">
          <VoucherList />
        </div>

        {/* 3D Plinko Game */}
        <Canvas
          shadows
          camera={{
            position: [0, 8, 12],
            fov: 45,
            near: 0.1,
            far: 1000
          }}
          gl={{
            antialias: true,
            powerPreference: "high-performance"
          }}
        >
          <color attach="background" args={["#0f0f23"]} />
          
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <pointLight position={[0, 10, 0]} intensity={0.5} />

          <Suspense fallback={null}>
            <PlinkoBoard />
          </Suspense>
        </Canvas>
      </KeyboardControls>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <GameContent />
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
