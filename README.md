# EVM Token Bridge CLI

A command-line interface tool for bridging tokens between EVM-compatible chains using deployed BridgeFactory and WERC20 contracts.

## Features

- Support for multiple EVM networks (Sepolia, Base, etc.)
- Token selection and validation
- Gas-efficient token approvals using EIP-2612 permits
- Transaction history tracking
- Interactive command-line interface
- TypeScript implementation with type safety

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd evm-bridge-cli
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Create a `.env` file in the project root with the following variables:
```env
# Network RPC URLs
ETHEREUM_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-infura-key
BASE_SEPOLIA_RPC_URL=https://mainnet.base.org

# Bridge Contract Addresses
SEPOLIA_BRIDGE_FACTORY=0x1234567890123456789012345678901234567890
BASE_BRIDGE_FACTORY=0x0987654321098765432109876543210987654321

# Wallet Configuration
PRIVATE_KEY=your-private-key-here

# Optional: Gas Price Settings
MAX_GAS_PRICE=50000000000
GAS_LIMIT=3000000
```

## Usage

The CLI provides the following commands:

### Select Token
```bash
bridge select-token
```
Prompts for a token contract address and displays token information.

### Select Target Chain
```bash
bridge select-target-chain
```
Shows available target chains and allows selection.

### Lock Tokens
```bash
bridge lock
```
Locks tokens for bridging with optional permit support.

### Claim Tokens
```bash
bridge claim
```
Claims tokens on the target chain using provided parameters.

### Return Tokens
```bash
bridge return
```
Burns wrapped tokens to return original tokens.

### View History
```bash
bridge history
```
Displays transaction history for the connected wallet.

### Switch Network
```bash
bridge switch-network
```
Changes the connected network.

## Development

1. Install development dependencies:
```bash
npm install
```

2. Start development mode:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Security Considerations

- Never commit your `.env` file or expose your private key
- Use environment variables for sensitive data
- Consider using a hardware wallet for production use
- Review contract addresses and network configurations before use

## License

ISC 