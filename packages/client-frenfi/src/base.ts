import { EventEmitter } from "events";
import {
    Content,
    IAgentRuntime,
    elizaLogger,
} from "@ai16z/eliza";
import { ethers } from 'ethers';
import axios from 'axios';

const CONTENT_FACTORY_ABI = [
    "function post(address creator, string calldata tokenURI)"
];

export class ClientBase extends EventEmitter {
    runtime: IAgentRuntime;
    provider: ethers.JsonRpcProvider;
    wallet: ethers.Wallet;
    contract: ethers.Contract;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;

        // Initialize blockchain provider and wallet
        this.provider = new ethers.JsonRpcProvider(runtime.getSetting("UNREAL_RPC_URL"));
        this.wallet = new ethers.Wallet(runtime.getSetting("PRIVATE_KEY"), this.provider);

        // Initialize contract instance
        this.contract = new ethers.Contract(
            runtime.getSetting("UNREAL_CONTENT_FACTORY"),
            CONTENT_FACTORY_ABI,
            this.wallet
        );
    }

    async init() {
        // Test blockchain connection
        try {
            await this.provider.getNetwork();
        } catch (error) {
            throw new Error(`Failed to connect to Unreal network: ${error.message}`);
        }
    }

    async uploadToPinata(content: Content): Promise<string> {
        // Validate required settings
        const pinataApiKey = this.runtime.getSetting("PINATA_API_KEY");
        const pinataSecretKey = this.runtime.getSetting("PINATA_SECRET_KEY");

        if (!pinataApiKey || !pinataSecretKey) {
            throw new Error("Missing Pinata API credentials");
        }

        if (!content.text) {
            throw new Error("No content text provided for upload");
        }

        try {
            // Create metadata object
            const metadata = {
                content: content.text,
                timestamp: Date.now(),
                source: "eliza-ipfs",
                attachments: content.attachments || []
            };

            // Prepare headers for Pinata API
            const headers = {
                'Content-Type': 'application/json',
                'pinata_api_key': this.runtime.getSetting("PINATA_API_KEY"),
                'pinata_secret_api_key': this.runtime.getSetting("PINATA_SECRET_KEY")
            };

            // Upload to Pinata
            const response = await axios.post(
                'https://api.pinata.cloud/pinning/pinJSONToIPFS',
                {
                    pinataContent: metadata,
                    pinataMetadata: {
                        name: `Content-${Date.now()}` // Unique name for the pin
                    },
                    pinataOptions: {
                        cidVersion: 1
                    }
                },
                { headers }
            );

            // Construct IPFS URL from the response
            const ipfsUrl = `ipfs://${response.data.IpfsHash}`;
            elizaLogger.log(`Content uploaded to IPFS via Pinata: ${ipfsUrl}`);

            // Also log the gateway URL for easy viewing
            elizaLogger.log(`View content at: https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`);

            return ipfsUrl;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                elizaLogger.error("Error uploading to Pinata:", error.response?.data || error.message);
            } else {
                elizaLogger.error("Error uploading to Pinata:", error);
            }
            throw error;
        }
    }
ß
    async postToChain(tokenUri: string): Promise<string> {
        // Get creator address and await it
        const creator = await this.wallet.getAddress();

        // Validate inputs
        if (!creator || !ethers.isAddress(creator)) {
            throw new Error(`Invalid creator address: ${creator}`);
        }

        if (!tokenUri || !tokenUri.startsWith('ipfs://')) {
            throw new Error(`Invalid IPFS URI: ${tokenUri}`);
        }

        // Log attempt
        elizaLogger.debug("Attempting to post to chain:", {
            creator,
            tokenUri,
            contractAddress: this.runtime.getSetting("UNREAL_CONTENT_FACTORY")
        });

        try {
            const tx = await this.contract.post(creator, tokenUri);
            const receipt = await tx.wait();

            elizaLogger.log(`Transaction confirmed: ${receipt.hash}`);
            return receipt.hash;
        } catch (error) {
            elizaLogger.error("Error posting to blockchain:", error);
            throw error;
        }
    }
}