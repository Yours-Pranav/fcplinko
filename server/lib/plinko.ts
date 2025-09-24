export interface PlinkoPath {
  x: number;
  y: number;
  direction: 'left' | 'right';
}

export interface DropResult {
  path: PlinkoPath[];
  finalSlot: number;
  amountCents: number;
}

export class PlinkoSimulator {
  private readonly BOARD_WIDTH = 7; // Number of slots at bottom
  private readonly BOARD_HEIGHT = 8; // Number of peg rows
  private readonly PEG_SPACING = 1.0;
  
  // Prize distribution (cents) - weighted towards lower amounts
  private readonly PRIZE_DISTRIBUTION = [
    { min: 1, max: 5, weight: 40 },    // $0.01 - $0.05 (40% chance)
    { min: 6, max: 15, weight: 30 },   // $0.06 - $0.15 (30% chance)
    { min: 16, max: 35, weight: 20 },  // $0.16 - $0.35 (20% chance)
    { min: 36, max: 65, weight: 8 },   // $0.36 - $0.65 (8% chance)
    { min: 66, max: 100, weight: 2 },  // $0.66 - $1.00 (2% chance)
  ];

  simulateDrop(seed?: string): DropResult {
    // Use provided seed for deterministic results or generate random
    const rng = seed ? this.createSeededRandom(seed) : Math.random;
    
    const path: PlinkoPath[] = [];
    let currentX = Math.floor(this.BOARD_WIDTH / 2); // Start at center
    
    // Simulate ball falling through pegs
    for (let row = 0; row < this.BOARD_HEIGHT; row++) {
      const y = row * this.PEG_SPACING;
      
      // Random bounce left or right
      const direction = rng() < 0.5 ? 'left' : 'right';
      
      if (direction === 'left' && currentX > 0) {
        currentX--;
      } else if (direction === 'right' && currentX < this.BOARD_WIDTH - 1) {
        currentX++;
      }
      
      path.push({
        x: currentX * this.PEG_SPACING,
        y,
        direction
      });
    }
    
    const finalSlot = currentX;
    const amountCents = this.calculatePrize(finalSlot, rng);
    
    return {
      path,
      finalSlot,
      amountCents
    };
  }

  private calculatePrize(slot: number, rng: () => number): number {
    // Select prize tier based on weights
    const totalWeight = this.PRIZE_DISTRIBUTION.reduce((sum, tier) => sum + tier.weight, 0);
    const randomWeight = rng() * totalWeight;
    
    let currentWeight = 0;
    for (const tier of this.PRIZE_DISTRIBUTION) {
      currentWeight += tier.weight;
      if (randomWeight <= currentWeight) {
        // Random amount within tier range
        return Math.floor(rng() * (tier.max - tier.min + 1)) + tier.min;
      }
    }
    
    // Fallback to minimum prize
    return 1;
  }

  private createSeededRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return () => {
      hash = (hash * 9301 + 49297) % 233280;
      return hash / 233280;
    };
  }

  // Validation helper for drop results
  validateDropResult(result: DropResult): boolean {
    return (
      result.amountCents >= 1 && 
      result.amountCents <= 100 &&
      result.finalSlot >= 0 && 
      result.finalSlot < this.BOARD_WIDTH &&
      result.path.length === this.BOARD_HEIGHT
    );
  }
}

export const plinkoSimulator = new PlinkoSimulator();
