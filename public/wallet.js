// Configurações da Sonic Testnet
const SONIC_CONFIG = {
    chainId: 14601,
    rpcUrl: 'https://rpc.testnet.soniclabs.com',
    explorer: 'https://testnet.sonicscan.org',
    currency: 'S'
};

// Estado global da aplicação
let currentAccount = null;
let provider = null;
let signer = null;
let transactions = [];

// Classe para gerenciar WebAuthn (Passkeys)
class PasskeyManager {
    constructor() {
        this.rpId = window.location.hostname;
        this.rpName = 'Sonic Smart Wallet';
    }

    // Criar nova credencial (registro)
    async createCredential(username) {
        try {
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            const createCredentialOptions = {
                publicKey: {
                    rp: {
                        id: this.rpId,
                        name: this.rpName
                    },
                    user: {
                        id: new TextEncoder().encode(username),
                        name: username,
                        displayName: username
                    },
                    challenge: challenge,
                    pubKeyCredParams: [
                        {
                            type: 'public-key',
                            alg: -7 // ES256
                        },
                        {
                            type: 'public-key',
                            alg: -257 // RS256
                        }
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                        residentKey: 'required'
                    },
                    timeout: 60000,
                    attestation: 'direct'
                }
            };

            const credential = await navigator.credentials.create(createCredentialOptions);
            
            // Converter rawId para base64 para armazenamento
            const rawIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
            
            // Armazenar credencial localmente
            const credentialData = {
                id: credential.id,
                rawId: rawIdBase64,
                username: username,
                createdAt: Date.now()
            };
            
            localStorage.setItem('sonic_wallet_credential', JSON.stringify(credentialData));
            console.log('Credencial salva:', credentialData);
            
            return credential;
        } catch (error) {
            console.error('Erro ao criar credencial:', error);
            throw new Error('Falha ao criar passkey: ' + error.message);
        }
    }

    // Autenticar com credencial existente
    async authenticate() {
        try {
            const storedCredential = localStorage.getItem('sonic_wallet_credential');
            if (!storedCredential) {
                // Tentar descobrir credenciais disponíveis
                return await this.authenticateWithDiscovery();
            }

            const credData = JSON.parse(storedCredential);
            console.log('Tentando autenticar com credencial salva:', credData);
            
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            // Converter base64 de volta para ArrayBuffer
            const rawIdBuffer = Uint8Array.from(atob(credData.rawId), c => c.charCodeAt(0));

            const getCredentialOptions = {
                publicKey: {
                    challenge: challenge,
                    allowCredentials: [{
                        id: rawIdBuffer,
                        type: 'public-key'
                    }],
                    userVerification: 'required',
                    timeout: 60000
                }
            };

            console.log('Opções de autenticação:', getCredentialOptions);
            const assertion = await navigator.credentials.get(getCredentialOptions);
            console.log('Autenticação bem-sucedida:', assertion);
            return assertion;
        } catch (error) {
            console.error('Erro na autenticação com credencial salva:', error);
            // Tentar descobrir credenciais como fallback
            try {
                return await this.authenticateWithDiscovery();
            } catch (discoveryError) {
                console.error('Erro na descoberta de credenciais:', discoveryError);
                throw new Error('Falha na autenticação: ' + error.message);
            }
        }
    }

    // Autenticar sem especificar credenciais (descoberta automática)
    async authenticateWithDiscovery() {
        try {
            console.log('Tentando descobrir credenciais disponíveis...');
            
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            const getCredentialOptions = {
                publicKey: {
                    challenge: challenge,
                    // Não especificar allowCredentials permite descoberta automática
                    userVerification: 'required',
                    timeout: 60000
                }
            };

            console.log('Opções de descoberta:', getCredentialOptions);
            const assertion = await navigator.credentials.get(getCredentialOptions);
            console.log('Credencial descoberta:', assertion);
            
            // Salvar a credencial descoberta para uso futuro
            if (assertion && assertion.rawId) {
                const rawIdBase64 = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
                const credentialData = {
                    id: assertion.id,
                    rawId: rawIdBase64,
                    username: 'descoberta',
                    createdAt: Date.now()
                };
                localStorage.setItem('sonic_wallet_credential', JSON.stringify(credentialData));
                console.log('Credencial descoberta salva:', credentialData);
            }
            
            return assertion;
        } catch (error) {
            console.error('Erro na descoberta de credenciais:', error);
            throw new Error('Nenhuma credencial encontrada no dispositivo');
        }
    }

    // Verificar se há credencial salva
    hasStoredCredential() {
        return localStorage.getItem('sonic_wallet_credential') !== null;
    }

    // Limpar credencial
    clearCredential() {
        console.log('Limpando credenciais...');
        localStorage.removeItem('sonic_wallet_credential');
        localStorage.removeItem('sonic_wallet_account');
        console.log('Credenciais limpas');
    }

    // Debug: Mostrar informações das credenciais
    debugCredentials() {
        const credential = localStorage.getItem('sonic_wallet_credential');
        const account = localStorage.getItem('sonic_wallet_account');
        
        console.log('=== DEBUG CREDENCIAIS ===');
        console.log('Credencial armazenada:', credential ? JSON.parse(credential) : 'Nenhuma');
        console.log('Conta armazenada:', account ? JSON.parse(account) : 'Nenhuma');
        console.log('Suporte WebAuthn:', !!window.PublicKeyCredential);
        console.log('Hostname atual:', window.location.hostname);
        console.log('========================');
        
        return {
            credential: credential ? JSON.parse(credential) : null,
            account: account ? JSON.parse(account) : null,
            hasWebAuthn: !!window.PublicKeyCredential,
            hostname: window.location.hostname
        };
    }
}

// Classe para gerenciar Account Abstraction (EIP-4337)
class SmartWalletManager {
    constructor() {
        this.passkeyManager = new PasskeyManager();
    }

    // Gerar endereço da smart wallet baseado na passkey
    async generateWalletAddress(credential) {
        try {
            // Simular geração de endereço determinístico baseado na credencial
            const credentialId = credential.id || credential.rawId;
            const encoder = new TextEncoder();
            const data = encoder.encode(credentialId + SONIC_CONFIG.chainId);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = new Uint8Array(hashBuffer);
            
            // Pegar os últimos 20 bytes para simular um endereço Ethereum
            const addressBytes = hashArray.slice(-20);
            const address = '0x' + Array.from(addressBytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            
            return address;
        } catch (error) {
            console.error('Erro ao gerar endereço:', error);
            throw error;
        }
    }

    // Criar nova conta smart wallet
    async createAccount(username) {
        try {
            showLoading('Criando sua conta com passkey...');
            
            const credential = await this.passkeyManager.createCredential(username);
            const walletAddress = await this.generateWalletAddress(credential);
            
            const accountData = {
                address: walletAddress,
                username: username,
                credentialId: credential.id,
                createdAt: Date.now()
            };
            
            localStorage.setItem('sonic_wallet_account', JSON.stringify(accountData));
            
            hideLoading();
            return accountData;
        } catch (error) {
            hideLoading();
            throw error;
        }
    }

    // Conectar com conta existente
    async connectAccount() {
        try {
            showLoading('Conectando com sua passkey...');
            
            const assertion = await this.passkeyManager.authenticate();
            const storedAccount = localStorage.getItem('sonic_wallet_account');
            
            if (!storedAccount) {
                throw new Error('Conta não encontrada');
            }
            
            const accountData = JSON.parse(storedAccount);
            
            hideLoading();
            return accountData;
        } catch (error) {
            hideLoading();
            throw error;
        }
    }

    // Desconectar conta
    disconnect() {
        this.passkeyManager.clearCredential();
        currentAccount = null;
    }
}

// Instância global do gerenciador
const smartWallet = new SmartWalletManager();

// Funções utilitárias
function showLoading(text = 'Processando...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingModal').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingModal').classList.add('hidden');
}

function showMessage(title, text, isError = false) {
    const modal = document.getElementById('messageModal');
    const icon = document.getElementById('messageIcon');
    const titleEl = document.getElementById('messageTitle');
    const textEl = document.getElementById('messageText');
    
    icon.textContent = isError ? '❌' : '✅';
    titleEl.textContent = title;
    textEl.textContent = text;
    
    modal.classList.remove('hidden');
}

function hideMessage() {
    document.getElementById('messageModal').classList.add('hidden');
}

// Função para verificar suporte a WebAuthn
function checkWebAuthnSupport() {
    if (!window.PublicKeyCredential) {
        showMessage('Erro', 'Seu navegador não suporta passkeys (WebAuthn)', true);
        return false;
    }
    return true;
}

// Função para conectar com a rede
async function connectToNetwork() {
    try {
        const response = await fetch('/api/network/status');
        const data = await response.json();
        
        if (data.connected) {
            document.getElementById('networkStatus').textContent = '🟢 Conectado';
            return true;
        } else {
            document.getElementById('networkStatus').textContent = '🔴 Erro de conexão';
            return false;
        }
    } catch (error) {
        console.error('Erro ao conectar com a rede:', error);
        document.getElementById('networkStatus').textContent = '🔴 Erro de conexão';
        return false;
    }
}

// Função para atualizar saldo
async function updateBalance() {
    if (!currentAccount) return;
    
    try {
        const response = await fetch('/api/balance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: currentAccount.address
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('walletBalance').textContent = 
                parseFloat(data.balance).toFixed(4);
        } else {
            console.error('Erro ao buscar saldo:', data.error);
        }
    } catch (error) {
        console.error('Erro ao atualizar saldo:', error);
    }
}

// Função para copiar endereço
function copyAddress() {
    if (currentAccount) {
        navigator.clipboard.writeText(currentAccount.address).then(() => {
            showMessage('Copiado!', 'Endereço copiado para a área de transferência');
        });
    }
}

// Função para estimar gas
async function estimateGas(to, amount) {
    try {
        const response = await fetch('/api/estimate-gas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ to, amount })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao estimar gas:', error);
        return null;
    }
}

// Função para enviar transação (simulada para Account Abstraction)
async function sendTransaction(to, amount) {
    try {
        showLoading('Enviando transação...');
        
        // Simular assinatura com passkey
        await smartWallet.passkeyManager.authenticate();
        
        // Simular envio de UserOperation (EIP-4337)
        // Em uma implementação real, isso seria enviado para um bundler
        const userOp = {
            sender: currentAccount.address,
            to: to,
            value: amount,
            timestamp: Date.now(),
            nonce: transactions.length
        };
        
        // Simular hash da transação
        const txHash = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        const transaction = {
            hash: txHash,
            from: currentAccount.address,
            to: to,
            value: amount,
            status: 'success',
            timestamp: Date.now(),
            explorerUrl: `${SONIC_CONFIG.explorer}/tx/${txHash}`
        };
        
        transactions.unshift(transaction);
        updateTransactionHistory();
        
        hideLoading();
        
        showMessage(
            'Transação Enviada!', 
            `Hash: ${txHash.substring(0, 10)}...`
        );
        
        // Atualizar saldo após alguns segundos
        setTimeout(() => {
            updateBalance();
        }, 2000);
        
        return transaction;
    } catch (error) {
        hideLoading();
        throw error;
    }
}

// Função para atualizar histórico de transações
function updateTransactionHistory() {
    const container = document.getElementById('transactionHistory');
    
    if (transactions.length === 0) {
        container.innerHTML = '<p class="no-transactions">Nenhuma transação ainda</p>';
        return;
    }
    
    container.innerHTML = transactions.map(tx => `
        <div class="transaction-item ${tx.status}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <strong>${tx.status === 'success' ? '✅' : '⏳'} ${tx.value} S</strong>
                <small>${new Date(tx.timestamp).toLocaleString('pt-BR')}</small>
            </div>
            <div style="font-size: 0.9rem; color: #666;">
                Para: ${tx.to.substring(0, 10)}...${tx.to.substring(-8)}
            </div>
            <div class="transaction-hash" style="margin-top: 5px;">
                <a href="${tx.explorerUrl}" target="_blank" style="color: #667eea; text-decoration: none;">
                    ${tx.hash.substring(0, 20)}...
                </a>
            </div>
        </div>
    `).join('');
}

// Função para mostrar seção da carteira
function showWalletSection() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('walletSection').classList.remove('hidden');
    
    document.getElementById('walletAddress').textContent = currentAccount.address;
    updateBalance();
}

// Função para mostrar seção de autenticação
function showAuthSection() {
    document.getElementById('walletSection').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar suporte a WebAuthn
    if (!checkWebAuthnSupport()) {
        return;
    }
    
    // Conectar com a rede
    await connectToNetwork();
    
    // Verificar se há conta salva
    const storedAccount = localStorage.getItem('sonic_wallet_account');
    if (storedAccount && smartWallet.passkeyManager.hasStoredCredential()) {
        currentAccount = JSON.parse(storedAccount);
        showWalletSection();
    }
    
    // Botão criar conta
    document.getElementById('createAccountBtn').addEventListener('click', async () => {
        try {
            const username = prompt('Digite um nome de usuário para sua carteira:');
            if (!username) return;
            
            currentAccount = await smartWallet.createAccount(username);
            showWalletSection();
            showMessage('Conta Criada!', 'Sua smart wallet foi criada com sucesso!');
        } catch (error) {
            showMessage('Erro', error.message, true);
        }
    });
    
    // Botão conectar
    document.getElementById('loginBtn').addEventListener('click', async () => {
        try {
            currentAccount = await smartWallet.connectAccount();
            showWalletSection();
            showMessage('Conectado!', 'Bem-vindo de volta!');
        } catch (error) {
            showMessage('Erro', error.message, true);
        }
    });
    
    // Botão desconectar
    document.getElementById('logoutBtn').addEventListener('click', () => {
        smartWallet.disconnect();
        showAuthSection();
        showMessage('Desconectado', 'Você foi desconectado com sucesso');
    });
    
    // Botão copiar endereço
    document.getElementById('copyAddressBtn').addEventListener('click', copyAddress);
    
    // Botão atualizar saldo
    document.getElementById('refreshBalanceBtn').addEventListener('click', updateBalance);
    
    // Formulário de envio
    document.getElementById('sendForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const recipientAddress = document.getElementById('recipientAddress').value;
        const sendAmount = parseFloat(document.getElementById('sendAmount').value);
        
        if (!recipientAddress || !sendAmount) {
            showMessage('Erro', 'Preencha todos os campos', true);
            return;
        }
        
        if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
            showMessage('Erro', 'Endereço inválido', true);
            return;
        }
        
        try {
            await sendTransaction(recipientAddress, sendAmount);
            
            // Limpar formulário
            document.getElementById('recipientAddress').value = '';
            document.getElementById('sendAmount').value = '';
        } catch (error) {
            showMessage('Erro', error.message, true);
        }
    });
    
    // Estimativa de gas em tempo real
    const amountInput = document.getElementById('sendAmount');
    const addressInput = document.getElementById('recipientAddress');
    
    const updateGasEstimate = async () => {
        const amount = amountInput.value;
        const address = addressInput.value;
        
        if (amount && address && /^0x[a-fA-F0-9]{40}$/.test(address)) {
            const gasData = await estimateGas(address, amount);
            if (gasData) {
                document.getElementById('gasEstimate').textContent = 
                    `${parseInt(gasData.gasLimit).toLocaleString()} units`;
            }
        } else {
            document.getElementById('gasEstimate').textContent = 'Calculando...';
        }
    };
    
    amountInput.addEventListener('input', updateGasEstimate);
    addressInput.addEventListener('input', updateGasEstimate);
    
    // Fechar modal
    document.getElementById('closeModalBtn').addEventListener('click', hideMessage);
    
    // Fechar modal clicando fora
    document.getElementById('messageModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            hideMessage();
        }
    });

    // Botão toggle debug
    document.getElementById('toggleDebugBtn').addEventListener('click', () => {
        const debugSection = document.getElementById('debugSection');
        debugSection.classList.toggle('hidden');
    });

    // Botões de debug
    document.getElementById('debugCredsBtn').addEventListener('click', () => {
        const debugData = smartWallet.passkeyManager.debugCredentials();
        const debugInfo = document.getElementById('debugInfo');
        
        debugInfo.innerHTML = `
            <h4>🔍 Informações de Debug:</h4>
            <strong>Suporte WebAuthn:</strong> ${debugData.hasWebAuthn ? '✅ Sim' : '❌ Não'}
            <strong>Hostname:</strong> ${debugData.hostname}
            
            <h4>💾 Credencial Armazenada:</h4>
            ${debugData.credential ? JSON.stringify(debugData.credential, null, 2) : 'Nenhuma credencial encontrada'}
            
            <h4>👤 Conta Armazenada:</h4>
            ${debugData.account ? JSON.stringify(debugData.account, null, 2) : 'Nenhuma conta encontrada'}
            
            <h4>📱 Informações do Dispositivo:</h4>
            <strong>User Agent:</strong> ${navigator.userAgent}
            <strong>Platform:</strong> ${navigator.platform}
            <strong>Secure Context:</strong> ${window.isSecureContext ? '✅ Sim' : '❌ Não'}
        `;
    });

    document.getElementById('clearCredsBtn').addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar todas as credenciais? Esta ação não pode ser desfeita.')) {
            smartWallet.passkeyManager.clearCredential();
            currentAccount = null;
            showAuthSection();
            showMessage('Limpeza Concluída', 'Todas as credenciais foram removidas');
            
            // Atualizar debug info
            document.getElementById('debugInfo').innerHTML = '<p>✅ Credenciais limpas com sucesso!</p>';
        }
    });

    document.getElementById('testPasskeyBtn').addEventListener('click', async () => {
        try {
            showLoading('Testando passkey...');
            
            // Tentar autenticar para testar
            const assertion = await smartWallet.passkeyManager.authenticate();
            
            hideLoading();
            showMessage('Teste Bem-sucedido!', 'Sua passkey está funcionando corretamente');
            
            document.getElementById('debugInfo').innerHTML = `
                <h4>✅ Teste de Passkey Bem-sucedido!</h4>
                <strong>Credential ID:</strong> ${assertion.id}
                <strong>Raw ID Length:</strong> ${assertion.rawId.byteLength} bytes
                <strong>User Handle:</strong> ${assertion.response.userHandle ? 'Presente' : 'Ausente'}
                <strong>Signature Length:</strong> ${assertion.response.signature.byteLength} bytes
            `;
        } catch (error) {
            hideLoading();
            showMessage('Teste Falhou', error.message, true);
            
            document.getElementById('debugInfo').innerHTML = `
                <h4>❌ Teste de Passkey Falhou:</h4>
                <strong>Erro:</strong> ${error.message}
                
                <h4>💡 Possíveis Soluções:</h4>
                • Verifique se você tem uma passkey criada para este site
                • Certifique-se de que está em um contexto seguro (HTTPS ou localhost)
                • Tente limpar as credenciais e criar uma nova conta
                • Verifique se seu dispositivo suporta WebAuthn
            `;
        }
    });
});
