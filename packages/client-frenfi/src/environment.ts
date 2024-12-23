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