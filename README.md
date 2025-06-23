# EVM Token Bridge CLI

A TypeScript command-line tool for bridging tokens between EVM-compatible blockchains using deployed BridgeFactory and WERC20 contracts.

---

## Features
- **Multi-chain support:** Easily bridge tokens between EVM networks (e.g., Sepolia, Base)
- **Interactive CLI:** Guided prompts for all actions
- **Token selection & validation:** Choose and verify tokens before bridging
- **Gas-efficient approvals:** EIP-2612 permit support
- **Transaction history:** Track all bridge operations
- **Automated relayer:** Listen for and process bridge events
- **Type-safe codebase:** Written in modern TypeScript

---

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hMitov/evm-bridge-cli.git
   cd evm-bridge-cli
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Build the project:**
   ```bash
   npm run build
   ```

---

## Configuration

1. **Environment Variables**
   
   Create a `.env` file in the project root. Below is a template with the required variables:
   ```env
   # --- Ethereum Sepolia Network ---
   ETHEREUM_SEPOLIA_WS_URL=<your_ethereum_sepolia_ws_url>
   ETHEREUM_SEPOLIA_BRIDGE_FACTORY=<your_sepolia_bridge_factory_address>
   ETHEREUM_SEPOLIA_NAME="Ethereum Sepolia"
   ETHEREUM_SEPOLIA_CHAIN_ID=11155111
   ETHEREUM_SEPOLIA_EXPLORER_URL=https://sepolia.etherscan.io

   # --- Base Sepolia Network ---
   BASE_SEPOLIA_WS_URL=<your_base_sepolia_ws_url>
   BASE_SEPOLIA_BRIDGE_FACTORY=<your_base_bridge_factory_address>
   BASE_SEPOLIA_NAME="Base Sepolia"
   BASE_SEPOLIA_CHAIN_ID=84532
   BASE_SEPOLIA_EXPLORER_URL=https://sepolia.basescan.org

   # --- Wallets ---
   USER_PRIVATE_KEY=<your_primary_wallet_private_key>
   RELAYER_PRIVATE_KEY=<your_relayer_wallet_private_key>
   ```
   **Important:** Never commit your `.env` file or expose your private keys.

2. **CLI Config**
   - The CLI stores session state in `.cli-config.json` (auto-generated).

---

## Usage

After building, use the CLI via:
```bash
npx bridge <command>
```

### Main Commands

- `select-token` — Select a token to bridge
- `select-target-chain` — Choose the destination chain
- `lock-token` — Lock ERC20 tokens for bridging
- `lock-native` — Lock native tokens (e.g., ETH)
- `claim-wrapped` — Claim wrapped tokens on the target chain
- `claim-origin` — Claim original tokens on the source chain
- `burn-token` — Burn wrapped tokens to return to the origin chain
- `history` — View transaction history
- `switch-network` — Change the active network
- `relayer` — Start the relayer to listen for bridge events

### Example Flows

**Lock and Claim:**
```bash
npx bridge select-token
npx bridge select-target-chain
npx bridge lock-token
# ...wait for relayer to process...
npx bridge claim-wrapped
```

**Return Tokens:**
```bash
npx bridge burn-token
# ...wait for relayer to process...
npx bridge claim-origin
```

**Start Relayer:**
```bash
npx bridge relayer
# Add -d or --detach to run in background
```

---

## Relayer Automation

The relayer listens for bridge events (lock, burn) and automatically signs and manages claims. It supports multiple networks and logs activity to `relayer-<chainId>.log`.

- **Start:** `npx bridge relayer`
- **Stop:** Use Ctrl+C or send SIGINT/SIGTERM
- **Logs:** Check `relayer-logs/` or `relayer-<chainId>.log`

---

## Development & Contribution

- **Start in dev mode:**
  ```bash
  npm run dev
  ```
- **Build for production:**
  ```bash
  npm run build
  ```
- **Type checking:**
  ```bash
  npx tsc --noEmit
  ```
- **Project structure:**
  - `src/commands/` — CLI command implementations
  - `src/relayer/` — Relayer and claims management
  - `src/utils/` — Utility functions and helpers
  - `src/config/` — Network and config management
  - `src/types/` — Shared types/interfaces
  - `src/contracts/abis/` — Contract ABIs (WERC20, BridgeFactory)
  - `src/errors/` — Custom error classes