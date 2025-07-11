const { setupOllamaTunnel } = require('./tunnel-setup.js');

async function startWithTunnel() {
  try {
    // Try to setup tunnel (will gracefully fail if cloudflared not available)
    await setupOllamaTunnel();
  } catch (error) {
    console.log('🔧 Tunnel setup failed, continuing with local configuration...');
  }
  
  // Always start the server regardless of tunnel success/failure
  console.log('🚀 Starting backend server...');
  require('./server.js');
}

startWithTunnel();