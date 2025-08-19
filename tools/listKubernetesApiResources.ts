import {Registry} from "@token-ring/registry";
import z from "zod";
import KubernetesService from "../KubernetesService.ts";

/**
 * Tool to list all Kubernetes API resources.
 * Returns output without tool name prefix for chatService consumption.
 */
export const name = "kubernetes/listKubernetesApiResources";

export async function execute(
  {},
  registry: Registry,
): Promise<{ output: string }> {
  // Resolve the KubernetesService from the registry.
  let kubernetesService: any = undefined;
  try {
    const maybeGet = (registry as any)?.get;
    if (typeof maybeGet === "function") {
      kubernetesService = maybeGet.call(registry, "KubernetesService");
    }
    if (!kubernetesService && typeof (registry as any)?.requireFirstServiceByType === "function") {
      kubernetesService = (registry as any).requireFirstServiceByType(KubernetesService);
    }
    if (!kubernetesService) {
      throw new Error(`[${name}] KubernetesService not available in registry`);
    }

    const resources = await kubernetesService.listAllApiResourceTypes(registry);
    // Return the successful output without tool name prefix.
    const output = JSON.stringify(resources);
    return {output};
  } catch (error: any) {
    // Throw errors instead of returning them.
    throw new Error(`[${name}] Failed to list Kubernetes resources: ${error.message}`);
  }
}

export const description =
  "Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace.";

export const inputSchema = z.object({});
