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
  // Usar a mesma lógica de geração que a transação para manter consistência
  const seed = crypto.createHash('sha256').update(credentialId + 'sonic-wallet-seed').digest();
  const privateKey = '0x' + seed.toString('hex');
  
  // Gerar endereço a partir da chave privada
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
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

// Endpoint para enviar transação (Account Abstraction simulada)
app.post('/api/send-transaction', async (req, res) => {
  try {
    const { to, amount, credentialId } = req.body;
    
    if (!ethers.isAddress(to)) {
      return res.status(400).json({ error: 'Endereço de destino inválido' });
    }
    
    if (!credentialId) {
      return res.status(400).json({ error: 'Credential ID é obrigatório para Account Abstraction' });
    }
    
/*    // Verificar se a conta existe
    const accountData = accounts.get(credentialId);
    if (!accountData) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }
*/    
    
    // Gerar chave privada determinística baseada no credential ID (para demo)
    // Em produção real, isso seria feito via bundler e paymaster
    const crypto = require('crypto');
    const seed = crypto.createHash('sha256').update(credentialId + 'sonic-wallet-seed').digest();
    const privateKey = '0x' + seed.toString('hex');
    
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Obter informações da conta remetente (se existir) para logs
    console.log("credentialId", credentialId);
    const senderAccount = accounts.get(credentialId);
    console.log("accounts", accounts);
    console.log("senderAccount", senderAccount);
    const senderInfo = senderAccount ? senderAccount.username : 'Conta não registrada';
    
    console.log(`💸 Enviando transação:`);
    console.log(`  👤 Remetente: ${senderInfo} (${wallet.address})`);
    console.log(`  📍 Destinatário: ${to}`);
    console.log(`  💰 Valor: ${amount} S`);
    
    // Verificar saldo do remetente antes de enviar
    const senderBalance = await provider.getBalance(wallet.address);
    const senderBalanceEth = ethers.formatEther(senderBalance);
    console.log(`  💳 Saldo do remetente: ${senderBalanceEth} S`);
    
    if (parseFloat(senderBalanceEth) < parseFloat(amount)) {
      return res.status(400).json({ 
        error: `Saldo insuficiente. Saldo atual: ${senderBalanceEth} S, Valor a enviar: ${amount} S` 
      });
    }
    
    // Estimar gas
    const gasEstimate = await provider.estimateGas({
      to: to,
      value: ethers.parseEther(amount.toString()),
      from: wallet.address
    });
    
    const feeData = await provider.getFeeData();
    
    const tx = {
      to: to,
      value: ethers.parseEther(amount.toString()),
      gasLimit: gasEstimate,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    };
    
    console.log('📦 Dados da transação:', tx);
    
    const transaction = await wallet.sendTransaction(tx);
    console.log(`✅ Transação enviada: ${transaction.hash}`);
    
    res.json({
      success: true,
      transactionHash: transaction.hash,
      explorerUrl: `${SONIC_TESTNET_CONFIG.explorer}/tx/${transaction.hash}`,
      from: wallet.address,
      to: to,
      value: amount,
      gasUsed: gasEstimate.toString()
    });
  } catch (error) {
    console.error('❌ Erro ao enviar transação:', error);
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

// Endpoint para validar endereço na blockchain
app.post('/api/validate-address', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Endereço é obrigatório' });
    }
    
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ 
        error: 'Formato de endereço inválido',
        isValid: false 
      });
    }
    
    // Verificar se o endereço existe na blockchain (tem alguma atividade)
    const balance = await provider.getBalance(address);
    const transactionCount = await provider.getTransactionCount(address);
    const code = await provider.getCode(address);
    
    const addressInfo = {
      address: address,
      isValid: true,
      balance: ethers.formatEther(balance),
      transactionCount: transactionCount,
      isContract: code !== '0x',
      hasActivity: transactionCount > 0 || parseFloat(ethers.formatEther(balance)) > 0
    };
    
    console.log(`🔍 Validação de endereço: ${address}`, addressInfo);
    
    res.json({
      success: true,
      ...addressInfo
    });
  } catch (error) {
    console.error('❌ Erro ao validar endereço:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obter chave privada (APENAS PARA DESENVOLVIMENTO/TESTNET)
app.post('/api/account/private-key', (req, res) => {
  try {
    const { credentialId } = req.body;
    
    if (!credentialId) {
      return res.status(400).json({ error: 'Credential ID é obrigatório' });
    }
    
    // Verificar se a conta existe
    const accountData = accounts.get(credentialId);
    if (!accountData) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }
    
    // Gerar chave privada (mesma lógica usada nas transações)
    const crypto = require('crypto');
    const seed = crypto.createHash('sha256').update(credentialId + 'sonic-wallet-seed').digest();
    const privateKey = '0x' + seed.toString('hex');
    
    const wallet = new ethers.Wallet(privateKey);
    
    res.json({
      success: true,
      credentialId: credentialId,
      address: wallet.address,
      privateKey: privateKey,
      warning: '⚠️  NUNCA compartilhe esta chave privada! Use apenas para financiar a carteira via faucet.'
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