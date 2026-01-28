import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolJSONResult} from "@tokenring-ai/chat/schema";
import z from "zod";
import KubernetesService from "../KubernetesService.ts";

/**
 * Tool to list all Kubernetes API resources.
 * Returns output without tool name prefix for agent consumption.
 */
const name = "kubernetes_listKubernetesApiResources";
const displayName = "Kubernetes/listKubernetesApiResources";

async function execute(
  {},
  agent: Agent,
): Promise<TokenRingToolJSONResult<{ output: string }>> {
  const kubernetesService = agent.requireServiceByType(KubernetesService);
  const resources = await kubernetesService.listAllApiResourceTypes(agent);
  const output = JSON.stringify(resources);
  return {
    type: "json",
    data: {output}
  };
}

const description =
  "Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace.";

const inputSchema = z.object({});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
