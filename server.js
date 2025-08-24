const express = require('express');
const cors = require('cors');
const path = require('path');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração da Sonic Testnet
const SONIC_TESTNET_CONFIG = {
  name: 'Sonic Testnet',
  rpcUrl: 'https://rpc.testnet.soniclabs.com',
  chainId: 14601,
  currency: 'S',
  explorer: 'https://testnet.sonicscan.org',
  faucet: 'https://testnet.soniclabs.com/account'
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Provider para Sonic Testnet
const provider = new ethers.JsonRpcProvider(SONIC_TESTNET_CONFIG.rpcUrl);

// Sistema simples de armazenamento de contas (em produção, usar banco de dados)
const accounts = new Map();

// Função para gerar endereço determinístico baseado no credential ID
function generateWalletAddress(credentialId, chainId) {
  const crypto = require('crypto');
  const data = credentialId + chainId.toString();
  const hash = crypto.createHash('sha256').update(data).digest();
  const address = '0x' + hash.slice(-20).toString('hex');
  return address;
}

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint para obter informações da rede
app.get('/api/network', (req, res) => {
  res.json(SONIC_TESTNET_CONFIG);
});

// Endpoint para verificar conexão com a rede
app.get('/api/network/status', async (req, res) => {
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    res.json({
      connected: true,
      network: {
        name: network.name,
        chainId: Number(network.chainId),
        blockNumber: blockNumber
      }
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

// Endpoint para obter saldo
app.post('/api/balance', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Endereço inválido' });
    }
    
    const balance = await provider.getBalance(address);
    const balanceInEth = ethers.formatEther(balance);
    
    res.json({
      address: address,
      balance: balanceInEth,
      symbol: SONIC_TESTNET_CONFIG.currency
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para enviar transação
app.post('/api/send-transaction', async (req, res) => {
  try {
    const { to, amount, privateKey } = req.body;
    
    if (!ethers.isAddress(to)) {
      return res.status(400).json({ error: 'Endereço de destino inválido' });
    }
    
    const wallet = new ethers.Wallet(privateKey, provider);
    const tx = {
      to: to,
      value: ethers.parseEther(amount.toString()),
      gasLimit: 21000
    };
    
    const transaction = await wallet.sendTransaction(tx);
    
    res.json({
      success: true,
      transactionHash: transaction.hash,
      explorerUrl: `${SONIC_TESTNET_CONFIG.explorer}/tx/${transaction.hash}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para estimar gas
app.post('/api/estimate-gas', async (req, res) => {
  try {
    const { to, amount } = req.body;
    
    const gasEstimate = await provider.estimateGas({
      to: to,
      value: ethers.parseEther(amount.toString())
    });
    
    const gasPrice = await provider.getFeeData();
    
    res.json({
      gasLimit: gasEstimate.toString(),
      gasPrice: gasPrice.gasPrice?.toString() || '0',
      maxFeePerGas: gasPrice.maxFeePerGas?.toString() || '0',
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString() || '0'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para criar/salvar conta
app.post('/api/account/create', (req, res) => {
  try {
    const { credentialId, username } = req.body;
    
    if (!credentialId || !username) {
      return res.status(400).json({ error: 'credentialId e username são obrigatórios' });
    }
    
    const walletAddress = generateWalletAddress(credentialId, SONIC_TESTNET_CONFIG.chainId);
    
    const accountData = {
      credentialId: credentialId,
      address: walletAddress,
      username: username,
      createdAt: Date.now(),
      lastAccess: Date.now()
    };
    
    accounts.set(credentialId, accountData);
    console.log('💾 Conta criada no servidor:', accountData);
    
    res.json({
      success: true,
      account: accountData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para recuperar conta por credential ID
app.post('/api/account/retrieve', (req, res) => {
  try {
    const { credentialId } = req.body;
    
    if (!credentialId) {
      return res.status(400).json({ error: 'credentialId é obrigatório' });
    }
    
    console.log('🔍 Buscando conta para credential ID:', credentialId);
    let accountData = accounts.get(credentialId);
    
    if (!accountData) {
      // Se não encontrar no Map, gerar nova conta baseada no ID
      const walletAddress = generateWalletAddress(credentialId, SONIC_TESTNET_CONFIG.chainId);
      
      accountData = {
        credentialId: credentialId,
        address: walletAddress,
        username: 'Usuário Recuperado',
        createdAt: Date.now(),
        lastAccess: Date.now(),
        recovered: true
      };
      
      accounts.set(credentialId, accountData);
      console.log('🔄 Nova conta gerada para recovery:', accountData);
      
      return res.json({
        success: true,
        account: accountData,
        isNewRecovery: true
      });
    }
    
    // Atualizar último acesso
    accountData.lastAccess = Date.now();
    accounts.set(credentialId, accountData);
    console.log('✅ Conta encontrada:', accountData);
    
    res.json({
      success: true,
      account: accountData,
      isNewRecovery: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para listar todas as contas (debug)
app.get('/api/accounts/debug', (req, res) => {
  try {
    const allAccounts = Array.from(accounts.values());
    res.json({
      success: true,
      accounts: allAccounts,
      total: allAccounts.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Acesse: http://localhost:${PORT}`);
  console.log(`🌐 Rede: ${SONIC_TESTNET_CONFIG.name}`);
});