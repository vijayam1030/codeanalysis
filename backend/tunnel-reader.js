const fs = require('fs').promises;
const path = require('path');

// Function to read tunnel URLs from log files
async function readTunnelUrls() {
  const tunnelInfo = {
    ollama: null,
    backend: null,
    frontend: null,
    lastUpdated: new Date().toISOString()
  };

  const logFiles = [
    { name: 'ollama', file: 'ollama-tunnel.log' },
    { name: 'backend', file: 'backend-tunnel.log' },
    { name: 'frontend', file: 'frontend-tunnel.log' }
  ];

  // Check both current directory and parent directory for log files
  const possiblePaths = [
    process.cwd(),
    path.join(process.cwd(), '..'),
    path.join(__dirname, '..'),
    __dirname
  ];

  for (const logFile of logFiles) {
    let url = null;
    
    for (const basePath of possiblePaths) {
      const logPath = path.join(basePath, logFile.file);
      
      try {
        const logContent = await fs.readFile(logPath, 'utf8');
        
        // Extract cloudflare URL from log content
        const urlMatch = logContent.match(/https:\/\/[^\\s]*\\.trycloudflare\\.com/);
        if (urlMatch) {
          url = urlMatch[0];
          console.log(`📡 Found ${logFile.name} tunnel: ${url}`);
          break; // Found URL, no need to check other paths
        }
      } catch (error) {
        // Log file doesn't exist in this path, try next
        continue;
      }
    }
    
    tunnelInfo[logFile.name] = url;
  }

  return tunnelInfo;
}

// Function to watch for new tunnel URLs
function watchTunnelLogs(callback) {
  const logFiles = ['ollama-tunnel.log', 'backend-tunnel.log', 'frontend-tunnel.log'];
  const possiblePaths = [
    process.cwd(),
    path.join(process.cwd(), '..'),
    path.join(__dirname, '..'),
    __dirname
  ];

  // Check for new URLs every 5 seconds
  const interval = setInterval(async () => {
    try {
      const tunnelInfo = await readTunnelUrls();
      callback(tunnelInfo);
    } catch (error) {
      console.warn('Error reading tunnel logs:', error.message);
    }
  }, 5000);

  return () => clearInterval(interval);
}

// Function to get tunnel status including URLs from logs
async function getTunnelStatus() {
  const tunnelUrls = await readTunnelUrls();
  
  return {
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    isRemote: tunnelUrls.ollama !== null || tunnelUrls.backend !== null || tunnelUrls.frontend !== null,
    backendPort: process.env.PORT || 5000,
    frontendPort: 4200,
    tunnels: {
      ollama: tunnelUrls.ollama,
      backend: tunnelUrls.backend,
      frontend: tunnelUrls.frontend
    },
    shareableUrls: {
      backend: tunnelUrls.backend || `http://localhost:${process.env.PORT || 5000}`,
      frontend: tunnelUrls.frontend || 'http://localhost:4200'
    },
    lastUpdated: tunnelUrls.lastUpdated
  };
}

module.exports = {
  readTunnelUrls,
  watchTunnelLogs,
  getTunnelStatus
};