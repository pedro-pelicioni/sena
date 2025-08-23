# 🎵 Sonic Smart Wallet

Uma Smart Wallet com Account Abstraction (EIP-4337) e autenticação via Passkeys para a Sonic Testnet.

## ✨ Funcionalidades

- 🔐 **Autenticação com Passkeys**: Use a biometria do seu dispositivo para acessar sua carteira
- 🧠 **Account Abstraction (EIP-4337)**: Smart wallet sem necessidade de gerenciar chaves privadas
- ⚡ **Sonic Testnet**: Transações ultra-rápidas na rede Sonic
- 💸 **Envio de Transações**: Interface simples para enviar tokens
- 📋 **Histórico**: Acompanhe suas transações
- 📱 **Responsivo**: Funciona em desktop e mobile

## 🚀 Instalação e Execução

### Pré-requisitos

- Node.js (versão 16 ou superior)
- Navegador moderno com suporte a WebAuthn (Chrome, Firefox, Safari, Edge)
- Dispositivo com suporte a biometria (recomendado)

### Passo a Passo

1. **Clone o repositório ou baixe os arquivos**

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor:**
   ```bash
   npm start
   ```
   
   Ou para desenvolvimento:
   ```bash
   npm run dev
   ```

4. **Acesse a aplicação:**
   ```
   http://localhost:3000
   ```

## 🔧 Configuração da Sonic Testnet

A aplicação já vem configurada para a Sonic Testnet:

- **Nome da Rede**: Sonic Testnet
- **RPC URL**: https://rpc.testnet.soniclabs.com
- **Chain ID**: 14601
- **Símbolo**: S
- **Explorer**: https://testnet.sonicscan.org
- **Faucet**: https://testnet.soniclabs.com/account

## 📖 Como Usar

### 1. Criar uma Nova Conta

1. Clique em "➕ Criar Conta com Passkey"
2. Digite um nome de usuário
3. Confirme a criação da passkey no seu dispositivo
4. Sua smart wallet será criada automaticamente

### 2. Conectar com Conta Existente

1. Clique em "🔑 Conectar com Passkey"
2. Confirme a autenticação no seu dispositivo
3. Você será conectado à sua carteira existente

### 3. Obter Tokens de Teste

1. Copie o endereço da sua carteira
2. Acesse o [Faucet da Sonic](https://testnet.soniclabs.com/account)
3. Cole seu endereço e solicite tokens

### 4. Enviar Transações

1. Preencha o endereço de destino
2. Digite a quantidade a enviar
3. Clique em "🚀 Enviar Transação"
4. Confirme com sua passkey

## 🏗️ Arquitetura

### Frontend
- **HTML/CSS/JavaScript**: Interface moderna e responsiva
- **WebAuthn API**: Gerenciamento de passkeys
- **Account Abstraction**: Simulação do EIP-4337

### Backend
- **Node.js + Express**: Servidor API
- **Ethers.js**: Interação com a blockchain
- **CORS**: Suporte para requisições cross-origin

### Smart Wallet Features
- **Deterministic Address**: Endereço gerado baseado na passkey
- **Gas Abstraction**: Estimativa automática de gas
- **Transaction History**: Histórico local de transações
- **Network Status**: Monitoramento da conexão com a rede

## 🔐 Segurança

### Passkeys (WebAuthn)
- Autenticação biométrica segura
- Chaves criptográficas armazenadas no hardware
- Resistente a phishing e ataques de replay

### Account Abstraction
- Não requer gerenciamento manual de chaves privadas
- Transações assinadas via passkey
- Recuperação de conta simplificada

## 📁 Estrutura do Projeto

```
sena/
├── package.json          # Dependências e scripts
├── server.js            # Servidor Express
├── README.md           # Este arquivo
└── public/
    ├── index.html      # Interface principal
    ├── styles.css      # Estilos CSS
    └── wallet.js       # Lógica da smart wallet
```

## 🌐 APIs Disponíveis

### GET /api/network
Retorna informações da rede Sonic Testnet

### GET /api/network/status
Verifica status da conexão com a rede

### POST /api/balance
Consulta saldo de um endereço
```json
{
  "address": "0x..."
}
```

### POST /api/estimate-gas
Estima gas para uma transação
```json
{
  "to": "0x...",
  "amount": "0.001"
}
```

### POST /api/send-transaction
Envia uma transação (para testing)
```json
{
  "to": "0x...",
  "amount": "0.001",
  "privateKey": "0x..."
}
```

## 🔬 Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Backend**: Node.js, Express.js
- **Blockchain**: Ethers.js, EIP-4337
- **Autenticação**: WebAuthn (Passkeys)
- **Rede**: Sonic Testnet
- **UI/UX**: Design responsivo, gradientes modernos

## 🐛 Troubleshooting

### Passkey não funciona
- Verifique se seu navegador suporta WebAuthn
- Certifique-se de que está usando HTTPS (ou localhost)
- Verifique se seu dispositivo tem biometria configurada

### Erro de conexão com a rede
- Verifique sua conexão com a internet
- Confirme se a RPC da Sonic Testnet está funcionando
- Tente recarregar a página

### Transação falha
- Verifique se tem saldo suficiente
- Confirme se o endereço de destino está correto
- Tente com uma quantidade menor

## 📝 Notas Importantes

- **Testnet**: Esta é uma aplicação para a rede de teste da Sonic
- **Simulação**: O EIP-4337 está simulado para fins demonstrativos
- **Desenvolvimento**: Não use em produção sem implementação completa do AA
- **Passkeys**: Funciona melhor em dispositivos com biometria

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir melhorias
- Enviar pull requests
- Compartilhar feedback

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes.

---

**Desenvolvido com ❤️ para a Sonic Testnet**
