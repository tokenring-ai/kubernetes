import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/types";
import z from "zod";
import KubernetesService from "../KubernetesService.ts";

/**
 * Tool to list all Kubernetes API resources.
 * Returns output without tool name prefix for agent consumption.
 */
const name = "kubernetes/listKubernetesApiResources";

async function execute(
  {},
  agent: Agent,
): Promise<{ output: string }> {
  const kubernetesService = agent.requireServiceByType(KubernetesService);
  const resources = await kubernetesService.listAllApiResourceTypes(agent);
  // Return the successful output without tool name prefix.
  const output = JSON.stringify(resources);
  return {output};
}

const description =
  "Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace.";

const inputSchema = z.object({});

export default {
  name, description, inputSchema, execute,
} as TokenRingToolDefinition<typeof inputSchema>;
