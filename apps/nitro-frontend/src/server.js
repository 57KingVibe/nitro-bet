const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// ==========================================
// 🔐 1. OAUTH LOGIC (REALLY WORKING)
// ==========================================
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    // Auth successful. Issue session JWT here.
    res.json({ success: true, user: { name: payload.name, email: payload.email, picture: payload.picture } });
  } catch (error) {
    console.error("OAuth Error:", error);
    res.status(401).json({ error: 'Invalid OAuth Token' });
  }
});

// ==========================================
// 🏦 2. FORGELAYER INTEGRATION (WEB3 VAULT)
// ==========================================
const FORGELAYER_KEY = process.env.FORGELAYER_API_KEY;

// Endpoint 1: Create a Decentralized Vault for a New User
app.post('/api/wallet/create', async (req, res) => {
  try {
    const { userEmail } = req.body;
    
    // Ping ForgeLayer to spin up a non-custodial Base/Solana wallet
    const forgeRes = await axios.post('https://api.forgelayer.com/v1/wallets/generate', {
      network: 'base-mainnet',
      identifier: userEmail
    }, {
      headers: { 'Authorization': `Bearer ${FORGELAYER_KEY}` }
    });

    res.json({ success: true, vaultAddress: forgeRes.data.address });
  } catch (error) {
    console.error("Vault Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate Web3 Vault' });
  }
});

// Endpoint 2: Ghost Mode Execution (Direct Smart Contract Bet)
app.post('/api/wallet/ghost-mode', async (req, res) => {
  try {
    const { vaultAddress, tacticalMarket, stakeAmount } = req.body;

    // ForgeLayer routes the transaction directly to a smart contract.
    // If the telemetry hits (e.g., Fastest Lap), the contract auto-pays.
    const betRes = await axios.post('https://api.forgelayer.com/v1/transactions/execute', {
      walletAddress: vaultAddress,
      contractAddress: 'YOUR_SMART_CONTRACT_ADDRESS_HERE',
      functionName: 'placeTacticalStake',
      params: [tacticalMarket, stakeAmount]
    }, {
      headers: { 'Authorization': `Bearer ${FORGELAYER_KEY}` }
    });

    res.json({ success: true, transactionHash: betRes.data.txHash, status: 'GHOST_MODE_ACTIVE' });
  } catch (error) {
    res.status(500).json({ error: 'Ghost Mode Transaction Failed' });
  }
});

// ==========================================
// 🏎️ 3. REAL-TIME TELEMETRY (SOCKET.IO)
// ==========================================
io.on('connection', (socket) => {
  console.log('⚡ User connected to live telemetry grid:', socket.id);
  
  // High-frequency telemetry updates
  setInterval(() => {
    socket.emit('odds_update', { 
      driverId: 'leclerc', 
      market: 'interval', 
      newOdds: (Math.random() * 2 + 1).toFixed(2) 
    });
  }, 3000);

  socket.on('disconnect', () => {
    console.log('User dropped from grid:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Nitro Backend blazing on port ${PORT}`));
