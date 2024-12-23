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