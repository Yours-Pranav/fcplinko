// Farcaster frame utilities
export interface FrameMetadata {
  title: string;
  description: string;
  imageUrl: string;
  buttons: FrameButton[];
  postUrl: string;
}

export interface FrameButton {
  text: string;
  action?: "post" | "post_redirect" | "link";
  target?: string;
}

export function generateFrameHTML(metadata: FrameMetadata): string {
  const buttons = metadata.buttons
    .map((button, index) => {
      const buttonIndex = index + 1;
      let html = `<meta property="fc:frame:button:${buttonIndex}" content="${button.text}">`;
      
      if (button.action) {
        html += `\n    <meta property="fc:frame:button:${buttonIndex}:action" content="${button.action}">`;
      }
      
      if (button.target) {
        html += `\n    <meta property="fc:frame:button:${buttonIndex}:target" content="${button.target}">`;
      }
      
      return html;
    })
    .join("\n    ");

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${metadata.title}</title>
    
    <!-- Open Graph -->
    <meta property="og:title" content="${metadata.title}">
    <meta property="og:description" content="${metadata.description}">
    <meta property="og:image" content="${metadata.imageUrl}">
    
    <!-- Farcaster Frame -->
    <meta property="fc:frame" content="vNext">
    <meta property="fc:frame:image" content="${metadata.imageUrl}">
    <meta property="fc:frame:post_url" content="${metadata.postUrl}">
    ${buttons}
</head>
<body>
    <h1>${metadata.title}</h1>
    <p>${metadata.description}</p>
    <img src="${metadata.imageUrl}" alt="Farcaster Plinko Game" style="max-width: 100%; height: auto;">
    <br><br>
    <a href="/" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px;">
        🚀 Play Full Game
    </a>
</body>
</html>`;
}

export function createGameFrameMetadata(baseUrl: string): FrameMetadata {
  return {
    title: "🎯 Farcaster Plinko - Win USDC!",
    description: "Drop balls through the Plinko board to win USDC prizes on Arbitrum! Get 3 free tickets every 24 hours.",
    imageUrl: `${baseUrl}/api/frame/image`,
    buttons: [
      { text: "🎯 Drop Ball", action: "post" },
      { text: "🎟️ Check Tickets", action: "post" },
      { text: "💰 View Prizes", action: "post" },
      { text: "🚀 Play Full Game", action: "link", target: baseUrl }
    ],
    postUrl: `${baseUrl}/api/frame/action`
  };
}

// SVG template for frame images
export function generateFrameImage(options: {
  title: string;
  subtitle?: string;
  ticketsRemaining?: number;
  lastWin?: number;
  backgroundGradient?: string[];
}): string {
  const {
    title,
    subtitle = "Drop balls to win USDC prizes!",
    ticketsRemaining,
    lastWin,
    backgroundGradient = ["#1a1a2e", "#16213e", "#0f3460"]
  } = options;

  const gradient = backgroundGradient
    .map((color, index) => `<stop offset="${index * 50}%" style="stop-color:${color}"/>`)
    .join("");

  return `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      ${gradient}
    </linearGradient>
  </defs>
  
  <rect width="600" height="400" fill="url(#bg)"/>
  
  <!-- Main Title -->
  <text x="300" y="80" font-family="Arial, sans-serif" font-size="36" font-weight="bold" 
        fill="#ffffff" text-anchor="middle" stroke="#000" stroke-width="1">
    ${title}
  </text>
  
  <!-- Subtitle -->
  <text x="300" y="130" font-family="Arial, sans-serif" font-size="18" 
        fill="#e2e8f0" text-anchor="middle">
    ${subtitle}
  </text>
  
  ${ticketsRemaining !== undefined ? `
  <!-- Tickets Info -->
  <rect x="200" y="160" width="200" height="40" fill="#4a5568" rx="20" opacity="0.8"/>
  <text x="300" y="185" font-family="Arial, sans-serif" font-size="16" font-weight="bold"
        fill="#ffffff" text-anchor="middle">
    🎟️ ${ticketsRemaining} tickets left
  </text>
  ` : ''}
  
  ${lastWin !== undefined && lastWin > 0 ? `
  <!-- Last Win -->
  <rect x="200" y="220" width="200" height="40" fill="#38a169" rx="20" opacity="0.9"/>
  <text x="300" y="245" font-family="Arial, sans-serif" font-size="16" font-weight="bold"
        fill="#ffffff" text-anchor="middle">
    🎉 Last win: $${(lastWin / 100).toFixed(2)}
  </text>
  ` : ''}
  
  <!-- Prize Range -->
  <text x="300" y="300" font-family="Arial, sans-serif" font-size="20" font-weight="bold"
        fill="#fbbf24" text-anchor="middle">
    💰 Win $0.01 - $1.00 per drop
  </text>
  
  <!-- Call to Action -->
  <rect x="150" y="330" width="300" height="50" fill="#7c3aed" rx="25"/>
  <text x="300" y="365" font-family="Arial, sans-serif" font-size="24" font-weight="bold"
        fill="#ffffff" text-anchor="middle">
    🎯 START PLAYING
  </text>
</svg>`;
}
