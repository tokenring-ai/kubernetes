// Import vitest or your testing library's functions
// For example, if using vitest:
import { describe, it, expect, vi } from "vitest";

// Import the tool execute function
import { execute } from "../../tools/listKubernetesApiResources.ts";

describe("listKubernetesApiResources tool", () => {
	it("should call KubernetesService.listAllApiResourceTypes and return its result", async () => {
		const mockResources = [
			{ kind: "Pod", name: "test-pod", namespace: "default" },
		];
		const mockKubernetesService = {
			listAllApiResourceTypes: vi.fn().mockResolvedValue(mockResources),
		};
		const mockRegistry = {
			get: vi.fn().mockImplementation((serviceName) => {
				if (serviceName === "KubernetesService") {
					return mockKubernetesService;
				}
				return null;
			}),
		};

		const result = await execute({}, mockRegistry);

		expect(mockRegistry.get).toHaveBeenCalledWith("KubernetesService");
		expect(mockKubernetesService.listAllApiResourceTypes).toHaveBeenCalledTimes(
			1,
		);
		expect(result).toEqual({ resources: mockResources });
	});

	it("should return an error if KubernetesService is not found", async () => {
		const mockRegistry = {
			get: vi.fn().mockReturnValue(null),
		};

		const result = await execute({}, mockRegistry);

		expect(mockRegistry.get).toHaveBeenCalledWith("KubernetesService");
		expect(result).toEqual({
			error: "KubernetesService not found in registry.",
		});
	});

	it("should return an error if listAllApiResourceTypes throws an error", async () => {
		const mockError = new Error("Kube API error");
		const mockKubernetesService = {
			listAllApiResourceTypes: vi.fn().mockRejectedValue(mockError),
		};
		const mockRegistry = {
			get: vi.fn().mockReturnValue(mockKubernetesService),
		};

		const result = await execute({}, mockRegistry);

		expect(mockKubernetesService.listAllApiResourceTypes).toHaveBeenCalledTimes(
			1,
		);
		expect(result).toEqual({
			error: `Failed to list Kubernetes resources: ${mockError.message}`,
		});
	});

	// Optional: Test with arguments if the spec is updated in the future
	// it('should pass arguments to listAllApiResourceTypes if spec allows', async () => { ... });
});
