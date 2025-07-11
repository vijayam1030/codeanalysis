const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Function to check if cloudflared is available
function checkCloudflared() {
  return new Promise((resolve) => {
    exec('cloudflared --version', (error) => {
      resolve(!error);
    });
  });
}

// Function to start Ollama tunnel and update .env
async function setupOllamaTunnel() {
  console.log('🚀 Setting up Ollama tunnel for remote access...');
  
  // Check if cloudflared is available
  const hasCloudflared = await checkCloudflared();
  if (!hasCloudflared) {
    console.log('⚠️  cloudflared not found. Skipping tunnel setup.');
    console.log('   Install cloudflared to enable remote sharing:');
    console.log('   Windows: winget install --id Cloudflare.cloudflared');
    console.log('   macOS: brew install cloudflared');
    console.log('   Linux: Download from https://github.com/cloudflare/cloudflared/releases');
    console.log('🔧 Continuing with local Ollama configuration...');
    return false;
  }

  return new Promise((resolve) => {
    // Start Ollama tunnel
    const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:11434'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let tunnelUrl = '';
    
    tunnel.on('error', (error) => {
      console.log('⚠️  Failed to start tunnel:', error.message);
      console.log('🔧 Continuing with local Ollama configuration...');
      resolve(false);
    });
    
    tunnel.stdout.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[^\\s]*\\.trycloudflare\\.com/);
      if (match && !tunnelUrl) {
        tunnelUrl = match[0];
        console.log(`📡 Ollama tunnel established: ${tunnelUrl}`);
        
        // Update .env file and store tunnel URL
        updateEnvFile(tunnelUrl).then(() => {
          console.log('✅ Environment updated for remote access');
          // Store tunnel URL for API access
          process.env.OLLAMA_TUNNEL_URL = tunnelUrl;
          resolve(true);
        }).catch((err) => {
          console.error('❌ Failed to update .env:', err.message);
          resolve(false);
        });
      }
    });

    tunnel.stderr.on('data', (data) => {
      // Ignore cloudflared startup messages unless it's an error
      const msg = data.toString();
      if (msg.includes('error') || msg.includes('failed')) {
        console.error('❌ Tunnel error:', msg);
      }
    });

    // Store tunnel process for cleanup
    process.ollamaTunnel = tunnel;
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!tunnelUrl) {
        console.log('⚠️  Timeout waiting for tunnel. Continuing with local Ollama...');
        resolve(false);
      }
    }, 10000);
  });
}

// Function to update .env file with tunnel URL
async function updateEnvFile(tunnelUrl) {
  const envPath = path.join(__dirname, '.env');
  
  try {
    let envContent = await fs.readFile(envPath, 'utf8');
    
    // Update or add OLLAMA_URL
    if (envContent.includes('OLLAMA_URL=')) {
      envContent = envContent.replace(
        /OLLAMA_URL=.*/,
        `OLLAMA_URL=${tunnelUrl}`
      );
    } else {
      envContent += `\\nOLLAMA_URL=${tunnelUrl}\\n`;
    }
    
    await fs.writeFile(envPath, envContent);
    process.envModified = true; // Mark that we modified the env file
  } catch (error) {
    throw new Error(`Failed to update .env file: ${error.message}`);
  }
}

// Cleanup function
function cleanup() {
  console.log('\\n🛑 Cleaning up tunnels...');
  
  if (process.ollamaTunnel) {
    process.ollamaTunnel.kill();
  }
  
  // Only restore .env if we actually modified it
  if (process.envModified) {
    const envPath = path.join(__dirname, '.env');
    fs.readFile(envPath, 'utf8').then(content => {
      const restored = content.replace(
        /OLLAMA_URL=https:\/\/.*\\.trycloudflare\\.com/,
        'OLLAMA_URL=http://localhost:11434'
      );
      return fs.writeFile(envPath, restored);
    }).then(() => {
      console.log('✅ Environment restored to local settings');
      process.exit(0);
    }).catch(err => {
      console.error('❌ Failed to restore .env:', err.message);
      process.exit(1);
    });
  } else {
    process.exit(0);
  }
}

// Only set up cleanup handlers for SIGINT and SIGTERM, not exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Main execution
if (require.main === module) {
  setupOllamaTunnel().then((success) => {
    if (success) {
      console.log('🎉 Ollama tunnel setup complete! Backend ready for remote access.');
    } else {
      console.log('🔧 Running in local mode. Install cloudflared for remote sharing.');
    }
    // Don't exit here, let the parent process (npm script) continue
  }).catch((error) => {
    console.error('❌ Tunnel setup failed:', error.message);
    console.log('🔧 Continuing with local Ollama configuration...');
  });
}

module.exports = { setupOllamaTunnel, cleanup };