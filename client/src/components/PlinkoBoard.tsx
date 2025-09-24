import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Box, Sphere, Text } from "@react-three/drei";
import * as THREE from "three";
import { useKeyboardControls } from "@react-three/drei";
import { useWallet } from "../lib/wallet";

interface Ball {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  active: boolean;
}

interface Peg {
  position: THREE.Vector3;
}

export function PlinkoBoard() {
  const { apiRequest } = useWallet();
  const [balls, setBalls] = useState<Ball[]>([]);
  const [pegs] = useState<Peg[]>(() => {
    const pegArray: Peg[] = [];
    const rows = 8;
    const cols = 7;
    
    for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 2;
      for (let col = 0; col < pegsInRow; col++) {
        const x = (col - pegsInRow / 2 + 0.5) * 1.5;
        const y = 6 - row * 0.8;
        const z = 0;
        pegArray.push({ position: new THREE.Vector3(x, y, z) });
      }
    }
    
    return pegArray;
  });

  const [prizes] = useState([
    { position: new THREE.Vector3(-4.5, -2, 0), value: 10 },
    { position: new THREE.Vector3(-3, -2, 0), value: 50 },
    { position: new THREE.Vector3(-1.5, -2, 0), value: 100 },
    { position: new THREE.Vector3(0, -2, 0), value: 250 },
    { position: new THREE.Vector3(1.5, -2, 0), value: 100 },
    { position: new THREE.Vector3(3, -2, 0), value: 50 },
    { position: new THREE.Vector3(4.5, -2, 0), value: 10 },
  ]);

  const dropPressed = useKeyboardControls((state) => state.drop);
  const [lastDrop, setLastDrop] = useState(false);
  const ballIdRef = useRef(0);

  // Handle drop ball input
  useEffect(() => {
    if (dropPressed && !lastDrop) {
      dropBall();
    }
    setLastDrop(dropPressed);
  }, [dropPressed, lastDrop]);

  const dropBall = async () => {
    try {
      console.log("Attempting to drop ball...");
      const response = await apiRequest("POST", "/api/drop");
      const data = await response.json();
      
      if (data.dropResult) {
        // Create new ball
        const newBall: Ball = {
          id: ballIdRef.current++,
          position: new THREE.Vector3(0, 7, 0),
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.1, // Small random horizontal velocity
            0,
            0
          ),
          active: true,
        };

        setBalls(prev => [...prev, newBall]);
        
        console.log(`Ball dropped! Won ${data.dropResult.amountCents} cents`);
        console.log(`Remaining tickets: ${data.remainingTickets}`);
        
        if (data.voucher) {
          console.log("Voucher created:", data.voucher);
        }
      }
    } catch (error) {
      console.error("Failed to drop ball:", error);
    }
  };

  useFrame((state, delta) => {
    setBalls(prevBalls => {
      return prevBalls.map(ball => {
        if (!ball.active) return ball;

        // Apply gravity
        ball.velocity.y -= 9.8 * delta;

        // Update position
        ball.position.add(ball.velocity.clone().multiplyScalar(delta));

        // Check collision with pegs
        pegs.forEach(peg => {
          const distance = ball.position.distanceTo(peg.position);
          if (distance < 0.3) { // Ball radius + peg radius
            // Simple bounce logic
            const direction = ball.position.clone().sub(peg.position).normalize();
            ball.velocity.reflect(direction);
            ball.velocity.multiplyScalar(0.8); // Energy loss
            
            // Add some randomness
            ball.velocity.x += (Math.random() - 0.5) * 2;
          }
        });

        // Check if ball reached bottom
        if (ball.position.y < -3) {
          ball.active = false;
        }

        // Boundary collision
        if (Math.abs(ball.position.x) > 6) {
          ball.velocity.x *= -0.8;
          ball.position.x = Math.sign(ball.position.x) * 6;
        }

        return ball;
      }).filter(ball => ball.active || ball.position.y > -5); // Remove balls that fell too far
    });
  });

  return (
    <group>
      {/* Board base */}
      <Box position={[0, -3.5, 0]} args={[12, 0.5, 2]} receiveShadow>
        <meshStandardMaterial color="#4a5568" />
      </Box>

      {/* Side walls */}
      <Box position={[-6, 0, 0]} args={[0.2, 12, 2]}>
        <meshStandardMaterial color="#2d3748" />
      </Box>
      <Box position={[6, 0, 0]} args={[0.2, 12, 2]}>
        <meshStandardMaterial color="#2d3748" />
      </Box>

      {/* Pegs */}
      {pegs.map((peg, index) => (
        <Sphere key={index} position={peg.position} args={[0.1]} castShadow>
          <meshStandardMaterial color="#e2e8f0" />
        </Sphere>
      ))}

      {/* Prize slots */}
      {prizes.map((prize, index) => (
        <group key={index} position={prize.position}>
          <Box position={[0, -0.5, 0]} args={[1.2, 1, 0.5]}>
            <meshStandardMaterial color="#38b2ac" />
          </Box>
          <Text
            position={[0, 0, 0.3]}
            fontSize={0.3}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            ${(prize.value / 100).toFixed(2)}
          </Text>
        </group>
      ))}

      {/* Balls */}
      {balls.map(ball => (
        <Sphere 
          key={ball.id} 
          position={ball.position} 
          args={[0.15]} 
          castShadow
        >
          <meshStandardMaterial color="#f56565" />
        </Sphere>
      ))}

      {/* Instructions */}
      <Text
        position={[0, 8, 0]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        Press SPACE or ENTER to drop a ball!
      </Text>
    </group>
  );
}
