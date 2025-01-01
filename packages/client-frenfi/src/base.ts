import { EventEmitter } from "events";
import {
    Content,
    IAgentRuntime,
    elizaLogger,
} from "@ai16z/eliza";
import axios from 'axios';
import { FrenFiSDK } from "motokultivator";
import { ethers } from 'ethers';

export class ClientBase extends EventEmitter {
    runtime: IAgentRuntime;
    provider: ethers.JsonRpcProvider;
    signer: ethers.Signer;
    sdk: FrenFiSDK;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.provider = new ethers.JsonRpcProvider(runtime.getSetting("UNREAL_RPC_URL"));
        this.signer = new ethers.Wallet(runtime.getSetting("PRIVATE_KEY"), this.provider);
    }

    async init() {
        try {
            await this.provider.getNetwork();
            // Initialize SDK properly - store the returned instance
            const sdk = new FrenFiSDK();
            // create() returns a new instance, so we need to store that one
            this.sdk = await sdk.create('dev', this.signer);
            elizaLogger.log("Frenfi SDK initialized");

            // Explicitly try to get JWT token (for debug - delete later) TODO
            try {
                const address = await this.signer.getAddress();
                elizaLogger.log(`Getting signature for address: ${address}`);
                const response = await this.sdk.fetchToSign(address, true); // true for dev environment
                elizaLogger.log(`Signing message...`);
                const signature = await this.signer.signMessage(response.data.message);
                elizaLogger.log(`Logging in with signature...`);
                const loginResponse = await this.sdk.login(address, signature, true);
                elizaLogger.log(`SDK fully initialized with JWT token`);
            } catch (authError) {
                elizaLogger.error(`Authentication error:`, authError);
                throw new Error(`Failed to authenticate with FrenFi: ${authError.message}`);
            }

        } catch (error) {
            elizaLogger.error(`Full error:`, error);
            throw new Error(`Failed to initialize FrenFi SDK: ${error.message}`);
        }
    }
}