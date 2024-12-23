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
                template: this.runtime.character.templates?.ipfsPostTemplate || ipfsPostTemplate,
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