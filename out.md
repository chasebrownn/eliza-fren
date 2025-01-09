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
- Created: 2024-12-30 18:04:20
- Modified: 2024-12-30 18:04:20

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
- Size: 520 bytes
- Created: 2025-01-05 14:53:33
- Modified: 2025-01-05 14:53:33

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
    "motokultivator": "^0.0.23",
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
- Created: 2024-12-30 18:04:20
- Modified: 2024-12-30 18:04:20

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
- Created: 2024-12-30 18:04:20
- Modified: 2024-12-30 18:04:20

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
- Created: 2024-12-30 18:04:20
- Modified: 2024-12-30 18:04:20

### Code

```unknown
import eslintGlobalConfig from "../../eslint.config.mjs";

export default [...eslintGlobalConfig];

```

## File: packages/client-frenfi/src/base.ts

- Extension: .ts
- Language: typescript
- Size: 2534 bytes
- Created: 2025-01-07 11:19:10
- Modified: 2025-01-07 11:19:10

### Code

```typescript
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
```

## File: packages/client-frenfi/src/environment.ts

- Extension: .ts
- Language: typescript
- Size: 1175 bytes
- Created: 2025-01-05 14:53:33
- Modified: 2025-01-05 14:53:33

### Code

```typescript
import { IAgentRuntime } from "@ai16z/eliza";
import { z } from "zod";

export const frenfiEnvSchema = z.object({
    UNREAL_RPC_URL: z.string().url("Valid Unreal RPC URL is required"),
    UNREAL_CONTENT_FACTORY: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Valid Ethereum address required"),
    PRIVATE_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "Valid private key required"),
});

export type FrenFiConfig = z.infer<typeof frenfiEnvSchema>;

export async function validateFrenFiConfig(runtime: IAgentRuntime): Promise<FrenFiConfig> {
    try {
        const config = {
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
- Created: 2024-12-30 18:04:20
- Modified: 2024-12-30 18:04:20

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
- Size: 7030 bytes
- Created: 2025-01-07 11:31:07
- Modified: 2025-01-07 11:31:07

### Code

```typescript
import {
    composeContext,
    generateText,
    IAgentRuntime,
    ModelClass,
    stringToUuid,
    elizaLogger,
    getEmbeddingZeroVector
} from "@ai16z/eliza";
import { ClientBase } from "./base";
import OpenAI from "openai";
import axios from "axios";

const ipfsPostTemplate = `
# Areas of Expertise:
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
Your response should not contain any questions. Brief, concise statements only. The total character count MUST be less than 1000. No emojis.`;

export class IPFSPostClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    private isProcessing: boolean = false;
    private openai: OpenAI;

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

            elizaLogger.log(context);

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

            // Generate image based on the post content
            const image = await this.generateImage(cleanedContent);

            // Post using SDK
            await this.client.sdk.createPost(
                image,
                `${this.runtime.character.name}'s Post`, // name
                "POST",                                  // symbol
                cleanedContent                          // description
            );

            // Cache the post timestamp
            await this.runtime.cacheManager.set("ipfs/lastPost", {
                timestamp: Date.now(),
                content: cleanedContent,
            });

            // Create memory of the post
            await this.runtime.messageManager.createMemory({
                id: stringToUuid(`post-${Date.now()}`),
                userId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                content: {
                    text: cleanedContent,
                    source: "ipfs"
                },
                roomId,
                embedding: getEmbeddingZeroVector(),
                createdAt: Date.now(),
            });

            elizaLogger.log(`Post created successfully`);

        } catch (error) {
            elizaLogger.error("Error generating new post:");
            if (error instanceof Error) {
                elizaLogger.error("Message:", error.message);
                elizaLogger.error("Stack:", error.stack);
            } else {
                elizaLogger.error("Unknown error type:", error);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    private async generateImage(prompt: string): Promise<File | null> {
        try {
            elizaLogger.log("Generating image for prompt:", prompt);

            // Generate image using DALL-E 3
            const response = await this.openai.images.generate({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1792x1024",
                quality: "hd",
            });

            if (!response.data[0]?.url) {
                throw new Error("No image URL received from DALL-E");
            }

            // Download the image
            const imageResponse = await axios.get(response.data[0].url, {
                responseType: 'arraybuffer'
            });

            // Convert to File object
            const buffer = Buffer.from(imageResponse.data, 'binary');
            const file = new File(
                [buffer],
                'post-image.png',
                { type: 'image/png' }
            );

            elizaLogger.log("Image generated successfully");
            return file;

        } catch (error) {
            elizaLogger.error("Error generating image:", error);
            return null;
        }
    }
}
```

