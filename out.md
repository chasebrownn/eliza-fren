# Table of Contents
- packages/client-frenfi/.npmignore
- packages/client-frenfi/package.json
- packages/client-frenfi/tsup.config.ts
- packages/client-frenfi/tsconfig.json
- packages/client-frenfi/eslint.config.mjs
- packages/client-frenfi/src/base.ts
- packages/client-frenfi/src/environment.ts
- packages/client-frenfi/src/index.ts
- packages/client-frenfi/src/post.ts

## File: packages/client-frenfi/.npmignore

- Extension: 
- Language: unknown
- Size: 52 bytes
- Created: 2024-12-30 19:04:20
- Modified: 2024-12-30 19:04:20

### Code

```unknown
*

!dist/**
!package.json
!readme.md
!tsup.config.ts
```

## File: packages/client-frenfi/package.json

- Extension: .json
- Language: json
- Size: 519 bytes
- Created: 2024-12-30 19:09:57
- Modified: 2024-12-30 19:09:57

### Code

```json
{
  "name": "@chasebrownn/client-frenfi",
  "version": "0.1.0",
  "main": "dist/index.js",
  "type": "module",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@ai16z/eliza": "workspace:*",
    "axios": "^1.6.2",
    "ethers": "^6.9.0",
    "motokultivator": "^0.0.3",
    "zod": "3.22.4"
  },
  "devDependencies": {
    "tsup": "8.0.2",
    "typescript": "^5.3.3"
  },
  "scripts": {
    "build": "tsup --format esm --dts",
    "dev": "tsup --format esm --dts --watch",
    "lint": "eslint --fix --cache ."
  }
}
```

## File: packages/client-frenfi/tsup.config.ts

- Extension: .ts
- Language: typescript
- Size: 674 bytes
- Created: 2024-12-30 19:04:20
- Modified: 2024-12-30 19:04:20

### Code

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"], // Ensure you're targeting CommonJS
    external: [
        "dotenv", // Externalize dotenv to prevent bundling
        "fs", // Externalize fs to use Node.js built-in module
        "path", // Externalize other built-ins if necessary
        "@reflink/reflink",
        "@node-llama-cpp",
        "https",
        "http",
        "agentkeepalive",
        "ipfs-http-client",
        "ethers",
        "zod",
        "@ai16z/eliza",
        // Add other modules you want to externalize
    ],
});

```

## File: packages/client-frenfi/tsconfig.json

- Extension: .json
- Language: json
- Size: 171 bytes
- Created: 2024-12-30 19:04:20
- Modified: 2024-12-30 19:04:20

### Code

```json
{
    "extends": "../core/tsconfig.json",
    "compilerOptions": {
        "outDir": "dist",
        "rootDir": "src"
    },
    "include": [
        "src/**/*.ts"
    ]
}
```

## File: packages/client-frenfi/eslint.config.mjs

- Extension: .mjs
- Language: unknown
- Size: 99 bytes
- Created: 2024-12-30 19:04:20
- Modified: 2024-12-30 19:04:20

### Code

```unknown
import eslintGlobalConfig from "../../eslint.config.mjs";

export default [...eslintGlobalConfig];

```

## File: packages/client-frenfi/src/base.ts

- Extension: .ts
- Language: typescript
- Size: 4569 bytes
- Created: 2024-12-30 19:04:20
- Modified: 2024-12-30 19:04:20

### Code

```typescript
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
```

## File: packages/client-frenfi/src/environment.ts

- Extension: .ts
- Language: typescript
- Size: 1457 bytes
- Created: 2024-12-30 19:04:20
- Modified: 2024-12-30 19:04:20

### Code

```typescript
import { IAgentRuntime } from "@ai16z/eliza";
import { z } from "zod";

export const frenfiEnvSchema = z.object({
    PINATA_API_KEY: z.string().min(1, "Pinata API key is required"),
    PINATA_SECRET_KEY: z.string().min(1, "Pinata secret key is required"),
    UNREAL_RPC_URL: z.string().url("Valid Unreal RPC URL is required"),
    UNREAL_CONTENT_FACTORY: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Valid Ethereum address required"),
    PRIVATE_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "Valid private key required"),
});

export type FrenFiConfig = z.infer<typeof frenfiEnvSchema>;

export async function validateFrenFiConfig(runtime: IAgentRuntime): Promise<FrenFiConfig> {
    try {
        const config = {
            PINATA_API_KEY: runtime.getSetting("PINATA_API_KEY"),
            PINATA_SECRET_KEY: runtime.getSetting("PINATA_SECRET_KEY"),
            UNREAL_RPC_URL: runtime.getSetting("UNREAL_RPC_URL"),
            UNREAL_CONTENT_FACTORY: runtime.getSetting("UNREAL_CONTENT_FACTORY"),
            PRIVATE_KEY: runtime.getSetting("PRIVATE_KEY"),
        };

        return frenfiEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(`FrenFi configuration validation failed:\n${errorMessages}`);
        }
        throw error;
    }
}
```

## File: packages/client-frenfi/src/index.ts

- Extension: .ts
- Language: typescript
- Size: 659 bytes
- Created: 2024-12-30 19:04:20
- Modified: 2024-12-30 19:04:20

### Code

```typescript
import { IPFSPostClient } from "./post";
import { IAgentRuntime, Client, elizaLogger } from "@ai16z/eliza";
import { ClientBase } from "./base";

export const FrenFiClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        elizaLogger.log("IPFS client starting");

        const client = new ClientBase(runtime);
        const postClient = new IPFSPostClient(client, runtime);

        await postClient.start();

        return {
            client,
            post: postClient,
        };
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("IPFS client stopping");
    },
};

export default FrenFiClientInterface;
```

## File: packages/client-frenfi/src/post.ts

- Extension: .ts
- Language: typescript
- Size: 6462 bytes
- Created: 2024-12-30 19:11:23
- Modified: 2024-12-30 19:11:23

### Code

```typescript
import {
    composeContext,
    generateText,
    IAgentRuntime,
    ModelClass,
    stringToUuid,
    parseBooleanFromText,
} from "@ai16z/eliza";
import { elizaLogger, getEmbeddingZeroVector } from "@ai16z/eliza";
import { ClientBase } from "./base";
import { FrenFiSDK } from "motokultivator";

const ipfsPostTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}}:
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

# Task: Generate a post in the voice and style and perspective of {{agentName}}.
Write a 1-3 sentence post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Do not add commentary or acknowledge this request, just write the post.
Your response should not contain any questions. Brief, concise statements only. The total character count MUST be less than 1000. No emojis. Use \\n\\n (double spaces) between statements.`;

export class IPFSPostClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    private isProcessing: boolean = false;
    private lastProcessTime: number = 0;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
    }

    async start(postImmediately: boolean = true) {
        await this.client.init();

        const generateNewPostLoop = async () => {
            const lastPost = await this.runtime.cacheManager.get<{
                timestamp: number;
            }>("ipfs/lastPost");

            const lastPostTimestamp = lastPost?.timestamp ?? 0;
            const minMinutes = parseInt(this.runtime.getSetting("POST_INTERVAL_MIN")) || 90;
            const maxMinutes = parseInt(this.runtime.getSetting("POST_INTERVAL_MAX")) || 180;
            const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
            const delay = randomMinutes * 60 * 1000;

            if (Date.now() > lastPostTimestamp + delay) {
                await this.generateNewPost();
            }

            setTimeout(() => {
                generateNewPostLoop();
            }, delay);

            elizaLogger.log(`Next post scheduled in ${randomMinutes} minutes`);
        };

        if (postImmediately) {
            await this.generateNewPost();
        }
        generateNewPostLoop();
    }

    private async generateNewPost() {
        if (this.isProcessing) {
            elizaLogger.log('Already processing post, skipping');
            return;
        }

        try {
            this.isProcessing = true;
            elizaLogger.log("Generating new post");

            const roomId = stringToUuid("ipfs_generate_room-" + this.runtime.agentId);
            const topics = this.runtime.character.topics.join(", ");

            const state = await this.runtime.composeState(
                {
                    userId: this.runtime.agentId,
                    roomId: roomId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: topics || '',
                        action: "POST",
                    },
                },
                {}
            );

            const context = composeContext({
                state,
                template: ipfsPostTemplate,
            });

            const newPostContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            // Clean up the generated content
            let cleanedContent = '';
            try {
                const parsedResponse = JSON.parse(newPostContent);
                cleanedContent = parsedResponse.text || parsedResponse;
            } catch {
                cleanedContent = newPostContent
                    .replace(/^\s*{?\s*"text":\s*"|"\s*}?\s*$/g, '')
                    .replace(/^['"](.*)['"]$/g, '$1')
                    .replace(/\\"/g, '"')
                    .replace(/\\n/g, '\n')
                    .trim();
            }

            if (!cleanedContent) {
                elizaLogger.error('Failed to extract valid content from response');
                return;
            }

            // Upload to IPFS
            const ipfsUrl = await this.client.uploadToPinata({
                text: cleanedContent,
                source: "ipfs",
            });

            // Post to blockchain
            const txHash = await this.client.postToChain(
                ipfsUrl
            );

            // Cache the post
            await this.runtime.cacheManager.set("ipfs/lastPost", {
                timestamp: Date.now(),
                ipfsUrl,
                txHash,
            });

            // Create memory of the post
            await this.runtime.messageManager.createMemory({
                id: stringToUuid(txHash),
                userId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                content: {
                    text: cleanedContent,
                    url: ipfsUrl,
                    source: "ipfs",
                    metadata: {
                        txHash,
                        ipfsUrl,
                    },
                },
                roomId,
                embedding: getEmbeddingZeroVector(),
                createdAt: Date.now(),
            });

            elizaLogger.log(`Post created - IPFS: ${ipfsUrl}, Transaction: ${txHash}`);

        } catch (error) {
            // More detailed error logging
            elizaLogger.error("Error generating new post:");
            if (error instanceof Error) {
                elizaLogger.error("Message:", error.message);
                elizaLogger.error("Stack:", error.stack);
            } else {
                elizaLogger.error("Unknown error type:", error);
            }

            // Log runtime state for debugging
            elizaLogger.debug("Runtime configuration:", {
                settings: {
                    pinataApiKey: !!this.runtime.getSetting("PINATA_API_KEY"),
                    pinataSecretKey: !!this.runtime.getSetting("PINATA_SECRET_KEY"),
                    unrealRpcUrl: !!this.runtime.getSetting("UNREAL_RPC_URL"),
                    unrealContentFactory: this.runtime.getSetting("UNREAL_CONTENT_FACTORY"),
                }
            });
        } finally {
            this.isProcessing = false;
        }
    }
}
```

