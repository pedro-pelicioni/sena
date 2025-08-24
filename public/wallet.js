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
                        userVerification: 'preferred',
                        residentKey: 'preferred',
                        requireResidentKey: false
                    },
                    timeout: 60000,
                    attestation: 'none'
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
                    userVerification: 'preferred',
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
                    userVerification: 'preferred',
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
            console.log('✅ Credencial criada:', credential);
            
            // Salvar conta no backend
            const response = await fetch('/api/account/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    credentialId: credential.id,
                    username: username
                })
            });
            
            const data = await response.json();
            console.log('📡 Resposta do servidor (create):', data);
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao criar conta no servidor');
            }
            
            const accountData = data.account;
            
            // Salvar conta localmente também
            localStorage.setItem('sonic_wallet_account', JSON.stringify(accountData));
            
            hideLoading();
            return accountData;
        } catch (error) {
            hideLoading();
            console.error('❌ Erro ao criar conta:', error);
            throw error;
        }
    }

    // Conectar com conta existente
    async connectAccount() {
        try {
            showLoading('Conectando com sua passkey...');
            
            // Primeiro, autenticar com passkey
            const assertion = await this.passkeyManager.authenticate();
            console.log('✅ Passkey autenticada:', assertion);
            
            // Tentar recuperar conta do backend usando credential ID
            const response = await fetch('/api/account/retrieve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    credentialId: assertion.id
                })
            });
            
            const data = await response.json();
            console.log('📡 Resposta do servidor (retrieve):', data);
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao recuperar conta');
            }
            
            const accountData = data.account;
            
            // Salvar conta localmente
            localStorage.setItem('sonic_wallet_account', JSON.stringify(accountData));
            
            if (data.isNewRecovery) {
                console.log('🔄 Conta recuperada automaticamente');
                setTimeout(() => {
                    showMessage('Conta Recuperada!', 'Sua conta foi recuperada automaticamente com base na sua passkey');
                }, 1000);
            }
            
            hideLoading();
            return accountData;
        } catch (error) {
            hideLoading();
            console.error('❌ Erro ao conectar conta:', error);
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

// Função para enviar transação real na Sonic Testnet
async function sendTransaction(to, amount) {
    try {
        showLoading('Autenticando com passkey...');
        
        // Autenticar com passkey para autorização
        const assertion = await smartWallet.passkeyManager.authenticate();
        console.log('✅ Passkey autorizada para transação');
        
        showLoading('Enviando transação para a Sonic Testnet...');
        
        // Enviar transação real via backend
        const response = await fetch('/api/send-transaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: to,
                amount: amount,
                credentialId: assertion.id
            })
        });
        
        const data = await response.json();
        console.log('📡 Resposta da transação:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao enviar transação');
        }
        
        const transaction = {
            hash: data.transactionHash,
            from: data.from,
            to: data.to,
            value: data.value,
            status: 'success',
            timestamp: Date.now(),
            explorerUrl: data.explorerUrl,
            gasUsed: data.gasUsed,
            isReal: true // Flag para indicar que é uma transação real
        };
        
        transactions.unshift(transaction);
        updateTransactionHistory();
        
        hideLoading();
        
        showMessage(
            'Transação Enviada com Sucesso!', 
            `Hash: ${data.transactionHash.substring(0, 10)}... | Clique para ver no explorer`,
            false
        );
        
        // Atualizar saldo após alguns segundos
        setTimeout(() => {
            updateBalance();
        }, 3000);
        
        return transaction;
    } catch (error) {
        hideLoading();
        console.error('❌ Erro ao enviar transação:', error);
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
                <strong>${tx.status === 'success' ? '✅' : '⏳'} ${tx.value} S ${tx.isReal ? '🌐' : '🎭'}</strong>
                <small>${new Date(tx.timestamp).toLocaleString('pt-BR')}</small>
            </div>
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 3px;">
                De: ${tx.from ? tx.from.substring(0, 10) + '...' + tx.from.substring(-6) : 'N/A'}
            </div>
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 5px;">
                Para: ${tx.to.substring(0, 10)}...${tx.to.substring(-6)}
            </div>
            ${tx.gasUsed ? `<div style="font-size: 0.8rem; color: #888; margin-bottom: 3px;">⛽ Gas: ${parseInt(tx.gasUsed).toLocaleString()} units</div>` : ''}
            <div style="font-size: 0.8rem; color: ${tx.isReal ? '#28a745' : '#ffc107'}; margin-bottom: 3px;">
                ${tx.isReal ? '🌐 Transação Real na Sonic Testnet' : '🎭 Transação Simulada'}
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
            console.log(currentAccount);
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
    
    const validateAddress = async (address) => {
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return null;
        }
        
        try {
            const response = await fetch('/api/validate-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address })
            });
            
            const data = await response.json();
            return response.ok ? data : null;
        } catch (error) {
            console.error('Erro ao validar endereço:', error);
            return null;
        }
    };

    const updateGasEstimate = async () => {
        const amount = amountInput.value;
        const address = addressInput.value;
        const gasEstimateEl = document.getElementById('gasEstimate');
        
        if (!amount || !address) {
            gasEstimateEl.textContent = 'Preencha os campos acima';
            return;
        }
        
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            gasEstimateEl.innerHTML = '❌ Formato de endereço inválido';
            return;
        }
        
        gasEstimateEl.textContent = 'Validando endereço...';
        
        // Validar endereço primeiro
        const addressInfo = await validateAddress(address);
        if (!addressInfo) {
            gasEstimateEl.innerHTML = '❌ Erro ao validar endereço';
            return;
        }
        
        // Mostrar informações do endereço
        const statusIcon = addressInfo.hasActivity ? '✅' : '⚠️';
        const statusText = addressInfo.hasActivity ? 'Ativo' : 'Novo';
        const contractText = addressInfo.isContract ? ' (Contrato)' : '';
        
        gasEstimateEl.innerHTML = `
            ${statusIcon} ${statusText}${contractText}<br>
            💰 Saldo: ${parseFloat(addressInfo.balance).toFixed(4)} S<br>
            📊 Transações: ${addressInfo.transactionCount}
        `;
        
        // Estimar gas se tudo estiver válido
        if (amount && parseFloat(amount) > 0) {
            const gasData = await estimateGas(address, amount);
            if (gasData) {
                gasEstimateEl.innerHTML += `<br>⛽ Gas: ${parseInt(gasData.gasLimit).toLocaleString()} units`;
            }
        }
    };
    
    // Debounce para evitar muitas chamadas à API
    let debounceTimer;
    const debouncedUpdate = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateGasEstimate, 500); // 500ms delay
    };
    
    amountInput.addEventListener('input', debouncedUpdate);
    addressInput.addEventListener('input', debouncedUpdate);
    
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

    document.getElementById('listAccountsBtn').addEventListener('click', async () => {
        try {
            showLoading('Buscando contas no servidor...');
            
            const response = await fetch('/api/accounts/debug');
            const data = await response.json();
            
            hideLoading();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao buscar contas');
            }
            
            const debugInfo = document.getElementById('debugInfo');
            debugInfo.innerHTML = `
                <h4>📋 Contas no Servidor (${data.total}):</h4>
                ${data.accounts.length === 0 ? 
                    '<p>Nenhuma conta encontrada no servidor</p>' :
                    data.accounts.map(account => `
                        <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                            <strong>👤 ${account.username}</strong><br>
                            <strong>🆔 Credential ID:</strong> ${account.credentialId.substring(0, 20)}...<br>
                            <strong>💼 Endereço:</strong> ${account.address}<br>
                            <strong>📅 Criado em:</strong> ${new Date(account.createdAt).toLocaleString('pt-BR')}<br>
                            <strong>🕒 Último acesso:</strong> ${new Date(account.lastAccess).toLocaleString('pt-BR')}<br>
                            ${account.recovered ? '<strong>🔄 Conta Recuperada</strong><br>' : ''}
                        </div>
                    `).join('')
                }
            `;
        } catch (error) {
            hideLoading();
            showMessage('Erro', error.message, true);
            
            document.getElementById('debugInfo').innerHTML = `
                <h4>❌ Erro ao buscar contas:</h4>
                <strong>Erro:</strong> ${error.message}
            `;
        }
    });

    document.getElementById('showPrivateKeyBtn').addEventListener('click', async () => {
        if (!currentAccount) {
            showMessage('Erro', 'Você precisa estar conectado para ver a chave privada', true);
            return;
        }

        if (!confirm('⚠️ ATENÇÃO: A chave privada será mostrada na tela. Certifique-se de que ninguém está olhando. Continuar?')) {
            return;
        }

        try {
            showLoading('Obtendo chave privada...');
            
            const response = await fetch('/api/account/private-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentialId: currentAccount.credentialId })
            });
            
            const data = await response.json();
            
            hideLoading();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao obter chave privada');
            }
            
            const debugInfo = document.getElementById('debugInfo');
            debugInfo.innerHTML = `
                <h4>🔑 Chave Privada da Carteira:</h4>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 2px solid #ffc107; margin: 10px 0;">
                    <strong>⚠️ ${data.warning}</strong>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace;">
                    <strong>🆔 Credential ID:</strong><br>
                    <code style="word-break: break-all;">${data.credentialId}</code><br><br>
                    <strong>💼 Endereço:</strong><br>
                    <code>${data.address}</code><br><br>
                    <strong>🔑 Chave Privada:</strong><br>
                    <code style="word-break: break-all;">${data.privateKey}</code>
                </div>
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; border: 2px solid #28a745; margin: 10px 0;">
                    <strong>💡 Como usar:</strong><br>
                    1. Copie a chave privada acima<br>
                    2. Acesse: <a href="https://testnet.soniclabs.com/account" target="_blank">Sonic Faucet</a><br>
                    3. Importe a chave privada na MetaMask<br>
                    4. Solicite tokens do faucet<br>
                    5. Use os tokens para fazer transações reais!
                </div>
                <button onclick="navigator.clipboard.writeText('${data.privateKey}')" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; margin: 5px;">
                    📋 Copiar Chave Privada
                </button>
                <button onclick="navigator.clipboard.writeText('${data.address}')" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; margin: 5px;">
                    📋 Copiar Endereço
                </button>
            `;
        } catch (error) {
            hideLoading();
            showMessage('Erro', error.message, true);
            
            document.getElementById('debugInfo').innerHTML = `
                <h4>❌ Erro ao obter chave privada:</h4>
                <strong>Erro:</strong> ${error.message}
            `;
        }
    });
});
