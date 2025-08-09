import z from "zod";
import type KubernetesService from "../KubernetesService.ts";

/**
 * @param {object} args - The arguments for the tool. (Currently no arguments are defined)
 * @param {object} registry - The service registry.
 * @param {KubernetesService} registry.KubernetesService - The Kubernetes service.
 * @returns {Promise<object>} A promise that resolves to an object containing the list of resources or an error.
 */
export async function execute(
	_args: Record<string, unknown>,
	registry: { get: (name: string) => KubernetesService | null },
): Promise<{ resources?: any[]; error?: string }> {
	const kubernetesService = registry.get("KubernetesService");
	if (!kubernetesService) {
		return { error: "KubernetesService not found in registry." };
	}

	try {
		const resources = await (kubernetesService as any).listAllApiResourceTypes(
			registry,
		);
		return { resources };
	} catch (error: any) {
		console.error("Error listing Kubernetes API resource types:", error);
		return { error: `Failed to list Kubernetes resources: ${error.message}` };
	}
}

export const description =
	"Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace.";

export const parameters = z.object({});
