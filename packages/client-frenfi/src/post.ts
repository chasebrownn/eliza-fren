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
    private openai: OpenAI | null = null;

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

    private async generateImage(prompt: string): Promise<Blob | null> {
        if (!this.openai) {
            const apiKey = this.runtime.getSetting("OPENAI_API_KEY");
            if (!apiKey) {
                elizaLogger.error("OpenAI API key not found in runtime settings");
                return null;
            }
            this.openai = new OpenAI({ apiKey });
        }

        try {
            elizaLogger.log("Generating image for prompt:", prompt);

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

            const imageResponse = await axios.get(response.data[0].url, {
                responseType: 'arraybuffer'
            });

            const blob = new Blob([Buffer.from(imageResponse.data)], { type: 'image/webp' });
            elizaLogger.log("Image generated successfully");
            return blob;

        } catch (error) {
            elizaLogger.error("Error generating image:", error);
            return null;
        }
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
            //elizaLogger.log(context);

            const newPostContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

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

            const image = await this.generateImage(cleanedContent);

            await this.client.sdk.createPost(
                image,
                `${this.runtime.character.name}'s Post`,
                "POST",
                cleanedContent
            );

            await this.runtime.cacheManager.set("ipfs/lastPost", {
                timestamp: Date.now(),
                content: cleanedContent,
            });

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
}