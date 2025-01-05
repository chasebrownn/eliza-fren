import { EventEmitter } from "events";
import {
    Content,
    IAgentRuntime,
    elizaLogger,
} from "@ai16z/eliza";
import axios from 'axios';
import { FrenFiSDK } from "motokultivator";
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the equivalent of __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRENFI_FACTORY_ABI = [
    "function isToken(address token) view returns (bool)"
];

export class ClientBase extends EventEmitter {
    runtime: IAgentRuntime;
    provider: ethers.JsonRpcProvider;
    signer: ethers.Signer;
    sdk: FrenFiSDK;
    frenfifactory: ethers.Contract;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.provider = new ethers.JsonRpcProvider(runtime.getSetting("UNREAL_RPC_URL"));
        this.signer = new ethers.Wallet(runtime.getSetting("PRIVATE_KEY"), this.provider);

        this.frenfifactory = new ethers.Contract(
            runtime.getSetting("UNREAL_FRENFI_FACTORY"),
            FRENFI_FACTORY_ABI,
            this.signer
        );
    }

    async init() {
        try {
            await this.provider.getNetwork();
            this.sdk = await FrenFiSDK.create('dev', this.signer);
            elizaLogger.log("Frenfi SDK initialized");

            const isToken = await this.frenfifactory.isToken(this.signer);
            if (!isToken) {
                elizaLogger.log("Generating creator token...");
                const name = "Frey";
                const symbol = "Frey";
                const description="Frey is a nordic goddess reincarnated as a sentient AI. She is here to bring life to a new generation of powerful agents.";

                // Read the file
                const filePath = path.resolve(__dirname, '../images/frey.jpeg');
                const buffer = fs.readFileSync(filePath);

                // Convert to File object
                const file = new File(
                    [buffer],
                    'frey.jpeg',
                    { type: 'image/jpeg' }
                );

                await this.sdk.createCreatorToken(file, name, symbol, description);
                elizaLogger.log("Creator token generated"); // TODO: Return?
            }

        } catch (error) {
            elizaLogger.error(`Full error:`, error);
            throw new Error(`Failed to initialize FrenFi SDK: ${error.message}`);
        }
    }
}