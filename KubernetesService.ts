import { Service } from "@token-ring/registry";
import {
	KubeConfig,
	CoreV1Api,
	DiscoveryApi,
	CustomObjectsApi,
} from "@kubernetes/client-node";

export interface KubernetesServiceParams {
	clusterName: string;
	apiServerUrl: string;
	namespace?: string;
	token?: string;
	clientCertificate?: string;
	clientKey?: string;
	caCertificate?: string;
}

export default class KubernetesService extends Service {
	name = "KubernetesService";
	description = "Provides Kubernetes functionality";
	static constructorProperties = {
		clusterName: {
			type: "string",
			required: true,
			description: "Name of the Kubernetes cluster",
		},
		apiServerUrl: {
			type: "string",
			required: true,
			description: "API server URL of the Kubernetes cluster",
		},
		namespace: {
			type: "string",
			required: false,
			description: "Namespace to operate in (default: 'default')",
		},
		token: {
			type: "string",
			required: false,
			description: "Bearer token for authentication",
		},
		clientCertificate: {
			type: "string",
			required: false,
			description: "Client certificate for TLS authentication",
		},
		clientKey: {
			type: "string",
			required: false,
			description: "Client key for TLS authentication",
		},
		caCertificate: {
			type: "string",
			required: false,
			description: "CA certificate for TLS verification",
		},
	} as const;

	private clusterName!: string;
	private apiServerUrl!: string;
	private namespace?: string;
	private token?: string;
	private clientCertificate?: string;
	private clientKey?: string;
	private caCertificate?: string;

	constructor({
		clusterName,
		apiServerUrl,
		namespace,
		token,
		clientCertificate,
		clientKey,
		caCertificate,
	}: KubernetesServiceParams) {
		super();
		if (!clusterName) {
			throw new Error("KubernetesService requires a clusterName.");
		}
		if (!apiServerUrl) {
			throw new Error("KubernetesService requires an apiServerUrl.");
		}

		this.clusterName = clusterName;
		this.apiServerUrl = apiServerUrl;
		this.namespace = namespace || "default";
		this.token = token;
		this.clientCertificate = clientCertificate;
		this.clientKey = clientKey;
		this.caCertificate = caCertificate;
	}

	getClusterName() {
		return this.clusterName;
	}

	getApiServerUrl() {
		return this.apiServerUrl;
	}

	getNamespace() {
		return this.namespace;
	}

	getToken() {
		return this.token;
	}

	getClientCertificate() {
		return this.clientCertificate;
	}

	getClientKey() {
		return this.clientKey;
	}

	getCaCertificate() {
		return this.caCertificate;
	}

	async start(_registry: any) {
		// Initialize service
		console.log("KubernetesService starting");
	}

	async stop(_registry: any) {
		// Clean up service
		console.log("KubernetesService stopping");
	}

	/**
	 * Reports the status of the service.
	 * @param {TokenRingRegistry} registry - The package registry
	 * @returns {Object} Status information.
	 */
	async status(_registry: any) {
		return {
			active: true,
			service: "KubernetesService",
		};
	}

	async listAllApiResourceTypes(_registry: any): Promise<any[]> {
		const kc = new KubeConfig();

		// Prepare cluster configuration
		const clusterConfig: any = {
			name: this.clusterName,
			server: this.apiServerUrl,
		};
		if (this.caCertificate) {
			clusterConfig.caData = this.caCertificate; // Assumed to be base64 encoded PEM
		}

		// Prepare user configuration
		const userConfig: any = { name: "service-user" };
		if (this.token) {
			userConfig.token = this.token;
		} else if (this.clientCertificate && this.clientKey) {
			userConfig.clientCertificateData = this.clientCertificate; // Assumed to be base64 encoded PEM
			userConfig.clientKeyData = this.clientKey; // Assumed to be base64 encoded PEM
		}

		// Load KubeConfig from options
		kc.loadFromOptions({
			clusters: [clusterConfig],
			users: [userConfig],
			contexts: [
				{
					name: `${this.clusterName}-context`,
					cluster: this.clusterName,
					user: userConfig.name,
					namespace: this.namespace || "default", // Use service's namespace or 'default'
				},
			],
			currentContext: `${this.clusterName}-context`,
		});

		const discoveryApi: any = kc.makeApiClient(DiscoveryApi);
		const coreV1Api: any = kc.makeApiClient(CoreV1Api);
		const customObjectsApi: any = kc.makeApiClient(CustomObjectsApi);
		const allResources: any[] = [];

		let namespacesToScan: string[] = [];
		if (this.namespace) {
			namespacesToScan.push(this.namespace);
		} else {
			try {
				console.log("Attempting to list all namespaces...");
				const { body: nsList } = await coreV1Api.listNamespace();
				if (nsList && nsList.items) {
					namespacesToScan = nsList.items.map((ns: any) => ns.metadata.name);
					console.log(`Found namespaces: ${namespacesToScan.join(", ")}`);
				} else {
					console.log("No namespaces found or items array is missing.");
					namespacesToScan = ["default"]; // Fallback if no items
				}
			} catch (nsError: any) {
				console.warn(
					`Could not list all namespaces: ${nsError.message}. Falling back to 'default' namespace.`,
				);
				allResources.push({
					error: `Namespace discovery failed (falling back to 'default'): ${nsError.message}`,
				});
				namespacesToScan = ["default"]; // Fallback namespace
			}
		}
		if (namespacesToScan.length === 0) {
			console.warn(
				"No namespaces specified or discovered, defaulting to 'default'.",
			);
			namespacesToScan = ["default"];
		}

		const processApiGroupVersion = async (
			groupVersion: string,
			_groupNameForLog?: string,
		) => {
			try {
				console.log(
					`Discovering resources for API group version: ${groupVersion}`,
				);
				const { body: apiResourceList } =
					await discoveryApi.getAPIResources(groupVersion);

				for (const resource of apiResourceList.resources) {
					if (!resource.verbs || !resource.verbs.includes("list")) {
						// console.log(`Skipping resource ${resource.kind} in ${groupVersion} as it does not support 'list' verb.`);
						continue;
					}

					const group = (resource as any).group || groupVersion.split("/")[0] || ""; // Prefer explicit group, fallback for core v1
					const version = (resource as any).version || groupVersion.split("/")[1]; // Prefer explicit version
					const kind = resource.kind as string;
					const pluralName = resource.name as string;

					// console.log(`Processing ${kind} (plural: ${pluralName}) in group: ${group}, version: ${version}`);

					if (resource.namespaced) {
						for (const ns of namespacesToScan) {
							try {
								// console.log(`Listing ${pluralName} in namespace ${ns}...`);
								const { body: result } =
									await customObjectsApi.listNamespacedCustomObject(
										group,
										version,
										ns,
										pluralName,
									);
								if (result && (result as any).items) {
									(result as any).items.forEach((item: any) =>
										allResources.push({
											group: group,
											version: version,
											kind: kind,
											namespace: item.metadata.namespace,
											name: item.metadata.name,
										}),
									);
								}
							} catch (err: any) {
								// console.warn(`Failed to list ${pluralName} in namespace ${ns}: ${err.message}`);
								allResources.push({
									group: group,
									version: version,
									kind: kind,
									namespace: ns,
									error: `Failed to list instances: ${err.message}`,
								});
							}
						}
					} else {
						// Cluster-scoped
						try {
							// console.log(`Listing cluster-scoped ${pluralName}...`);
							const { body: result } =
								await customObjectsApi.listClusterCustomObject(
									group,
									version,
									pluralName,
								);
							if (result && (result as any).items) {
								(result as any).items.forEach((item: any) =>
									allResources.push({
										group: group,
										version: version,
										kind: kind,
										name: item.metadata.name,
									}),
								);
							}
						} catch (err: any) {
							// console.warn(`Failed to list cluster-scoped ${pluralName}: ${err.message}`);
							allResources.push({
								group: group,
								version: version,
								kind: kind,
								error: `Failed to list instances: ${err.message}`,
							});
						}
					}
				}
			} catch (groupError: any) {
				console.warn(
					`Failed to discover or process resources for API group version ${groupVersion}: ${groupError.message}`,
				);
				allResources.push({
					error: `Resource discovery failed for groupVersion ${groupVersion}: ${groupError.message}`,
				});
			}
		};

		// 1. Process the core "v1" API group (e.g., pods, services)
		console.log("Processing core v1 API group...");
		await processApiGroupVersion("v1", "core");

		// 2. Discover and process all other API groups (e.g., apps/v1, batch/v1)
		console.log("Discovering other API groups...");
		try {
			const { body: apiGroups } = await discoveryApi.getAPIGroupList();
			if (apiGroups && apiGroups.groups) {
				for (const group of apiGroups.groups) {
					if (group.preferredVersion && group.preferredVersion.groupVersion) {
						console.log(
							`Processing preferred version ${group.preferredVersion.groupVersion} for group ${group.name}`,
						);
						await processApiGroupVersion(
							group.preferredVersion.groupVersion,
							group.name,
						);
					} else {
						// Fallback or skip if no preferred version, or log
						console.log(
							`Skipping API group ${group.name} as it has no preferred version listed.`,
						);
					}
				}
			} else {
				console.log(
					"No additional API groups found or groups array is missing.",
				);
			}
		} catch (apiGroupsError: any) {
			console.error(`Failed to get API group list: ${apiGroupsError.message}`);
			allResources.push({
				error: `Failed to get API group list: ${apiGroupsError.message}`,
			});
		}

		console.log("Finished processing all resources.");
		return allResources;
	}
}
