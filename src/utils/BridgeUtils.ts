import { ethers, Signature } from "ethers";
import { cliConfigManager } from "../config/cliConfig";
import { USER_PRIVATE_KEY } from "../config/configLoader";
import werc20Abi from "../contracts/abis/WERC20.json";
import { ERROR_MESSAGES } from "../errors/messages/errorMessages";

export class BridgeUtils {
    static validateAddress(input: string): boolean | string {
        return ethers.isAddress(input) ? true : 'Please enter a valid WERC20 address';
    }

    static validateAmount(input: string): boolean | string {
        const val = Number(input);
        return val > 0 && !isNaN(val) ? true : 'Please enter a valid positive number';
    }

    static async verifyContractExists(provider: ethers.Provider, address: string): Promise<void> {
        if (!ethers.isAddress(address)) {
            throw new Error(ERROR_MESSAGES.INVALID_ADDRESS);
        }

        const code = await provider.getCode(address);
        if (code === '0x' || code === '0x0') {
            throw new Error(ERROR_MESSAGES.CONTRACT_NOT_FOUND);
        }
    }

    static validateBurnTokenConfig(config: ReturnType<typeof cliConfigManager.getCliConfig>): void {
        if (!config.originalToken) {
            throw new Error(ERROR_MESSAGES.ORIGINAL_TOKEN_NOT_FOUND);
        }
        if (!config.currentNetwork || !config.currentNetwork.chainId) {
            throw new Error(ERROR_MESSAGES.CURRENT_NETWORK_CONFIG_INVALID);
        }
        if (!config.targetChainId) {
            throw new Error(ERROR_MESSAGES.TARGET_CHAIN_NOT_SELECTED);
        }
    }

    static validateClaimOriginConfig(config: ReturnType<typeof cliConfigManager.getCliConfig>): void {
        if (!config.originalToken) {
            throw new Error(ERROR_MESSAGES.ORIGINAL_TOKEN_NOT_FOUND);
        }
        if (!config.currentNetwork || !config.currentNetwork.chainId) {
            throw new Error(ERROR_MESSAGES.CURRENT_NETWORK_CONFIG_INVALID);
        }
    }

    static validateLockTokenConfig(config: ReturnType<typeof cliConfigManager.getCliConfig>): void {
        if (!config.originalToken) {
            throw new Error(ERROR_MESSAGES.ORIGINAL_TOKEN_NOT_FOUND);
        }
        if (!config.currentNetwork || !config.currentNetwork.chainId) {
            throw new Error(ERROR_MESSAGES.CURRENT_NETWORK_CONFIG_INVALID);
        }
        if (!config.targetChainId) {
            throw new Error(ERROR_MESSAGES.TARGET_CHAIN_NOT_SELECTED);
        }
    }

    static validateSelectTargetChainConfig(config: ReturnType<typeof cliConfigManager.getCliConfig>): void {
        if (!config.currentNetwork || !config.currentNetwork.chainId) {
            throw new Error(ERROR_MESSAGES.CURRENT_NETWORK_CONFIG_INVALID);
        }
    }

    static validateSwitchNetworkConfig(config: ReturnType<typeof cliConfigManager.getCliConfig>): void {
        if (!config.currentNetwork || !config.currentNetwork.chainId) {
            throw new Error(ERROR_MESSAGES.CURRENT_NETWORK_CONFIG_INVALID);
        }
    }

    static getProviderAndWallet() {
        const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
        const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
        const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
        return { provider, wallet, currentNetwork };
    }

    static normalizeAddress(address: string): string {
        try {
            return ethers.getAddress(address);
        } catch {
            throw new Error(ERROR_MESSAGES.INVALID_ADDRESS);
        }
    }

    static async generatePermitSignature(
        tokenAddress: string,
        wallet: ethers.Wallet,
        spender: string,
        amount: ethers.BigNumberish,
        deadline: ethers.BigNumberish
    ) {
        const tokenContract = new ethers.Contract(tokenAddress, werc20Abi.abi, wallet);

        const onChainDomainSeparator = await tokenContract.DOMAIN_SEPARATOR();
        const name = await tokenContract.name();
        const nonce = await tokenContract.nonces(wallet.address);
        const chainId = (await wallet.provider!.getNetwork()).chainId;

        const domain = {
            name,
            version: "2",
            chainId,
            verifyingContract: tokenAddress,
        };

        const offChainDomainSeparator = ethers.TypedDataEncoder.hashDomain(domain);

        if (onChainDomainSeparator !== offChainDomainSeparator) {
            throw new Error(ERROR_MESSAGES.DOMAIN_SEPARATOR_MISMATCH);
        }

        const types = {
            Permit: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        };

        const value = {
            owner: wallet.address,
            spender,
            value: amount.toString(),
            nonce: nonce.toString(),
            deadline: deadline.toString(),
        };

        const signature = await wallet.signTypedData(domain, types, value);
        const sig = Signature.from(signature);
        const { v, r, s } = sig;

        const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
        if (recoveredAddress.toLowerCase() !== wallet.address.toLowerCase()) {
            throw new Error(ERROR_MESSAGES.SIGNATURE_VERIFICATION_FAILED);
        }

        return { v, r, s };
    }
}