import Agent from "@tokenring-ai/agent/Agent";
import z from "zod";
import KubernetesService from "../KubernetesService.ts";

/**
 * Tool to list all Kubernetes API resources.
 * Returns output without tool name prefix for agent consumption.
 */
export const name = "kubernetes/listKubernetesApiResources";

export async function execute(
  {},
  agent: Agent,
): Promise<{ output: string }> {
  const kubernetesService = agent.requireServiceByType(KubernetesService);
  const resources = await kubernetesService.listAllApiResourceTypes(agent);
  // Return the successful output without tool name prefix.
  const output = JSON.stringify(resources);
  return {output};
}

export const description =
  "Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace.";

export const inputSchema = z.object({});
