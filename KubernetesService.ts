import { ApisApi, CoreV1Api, CustomObjectsApi, KubeConfig } from "@kubernetes/client-node";
import type { Agent } from "@tokenring-ai/agent";

import type { TokenRingService } from "@tokenring-ai/app/types";
import type { ParsedKubernetesServiceConfig } from "./schema.ts";

/**
 * Information about a discovered Kubernetes resource.
 */
export interface K8sResourceInfo {
  /** API group, e.g., "apps" or "" for core resources */
  group?: string | undefined;
  /** API version, e.g., "v1" */
  version?: string | undefined;
  /** Kind of the resource, e.g., "Pod" */
  kind?: string | undefined;
  /** Namespace for namespaced resources */
  namespace?: string | undefined;
  /** Name of the resource */
  name?: string | undefined;
  /** Optional error message if the resource could not be listed */
  error?: string | undefined;
}

/** Configuration object for a cluster entry in KubeConfig. */
interface ClusterConfig {
  name: string;
  server: string;
  caData?: string | undefined;
}

/** Configuration object for a user entry in KubeConfig. */
interface UserConfig {
  name: string;
  token?: string | undefined;
  clientCertificateData?: string | undefined;
  clientKeyData?: string | undefined;
}

export default class KubernetesService implements TokenRingService {
  readonly name = "KubernetesService";
  description = "Provides Kubernetes functionality";

  constructor(readonly options: ParsedKubernetesServiceConfig) {}

  /**
   * Discover all API resource types across the cluster.
   */
  async listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]> {
    const kc = new KubeConfig();

    // Prepare cluster configuration
    const clusterConfig: ClusterConfig = {
      name: this.options.clusterName,
      server: this.options.apiServerUrl,
    };
    if (this.options.caCertificate) {
      clusterConfig.caData = this.options.caCertificate;
    }

    // Prepare user configuration
    const userConfig: UserConfig = { name: "service-user" };
    if (this.options.token) {
      userConfig.token = this.options.token;
    } else if (this.options.clientCertificate && this.options.clientKey) {
      userConfig.clientCertificateData = this.options.clientCertificate;
      userConfig.clientKeyData = this.options.clientKey;
    }

    // Load KubeConfig from options
    kc.loadFromOptions({
      clusters: [clusterConfig],
      users: [userConfig],
      contexts: [
        {
          name: `${this.options.clusterName}-context`,
          cluster: this.options.clusterName,
          user: userConfig.name,
          namespace: this.options.namespace || "default",
        },
      ],
      currentContext: `${this.options.clusterName}-context`,
    });

    const apisApi = kc.makeApiClient(ApisApi);
    const coreV1Api = kc.makeApiClient(CoreV1Api);
    const customObjectsApi = kc.makeApiClient(CustomObjectsApi);
    const allResources: K8sResourceInfo[] = [];

    // Determine which namespaces to scan
    let namespacesToScan: string[] = [];
    if (this.options.namespace) {
      namespacesToScan.push(this.options.namespace);
      agent.infoMessage(`Using configured namespace: ${this.options.namespace}`);
    } else {
      try {
        agent.infoMessage("Attempting to list all namespaces...");
        const nsList = await coreV1Api.listNamespace();
        if (nsList?.items && nsList.items.length > 0) {
          namespacesToScan = nsList.items.map(ns => ns.metadata?.name ?? "").filter(name => name);
          if (namespacesToScan.length > 0) {
            agent.infoMessage(`Found namespaces: ${namespacesToScan.join(", ")}`);
          } else {
            agent.infoMessage("No valid namespaces found, falling back to 'default'");
            namespacesToScan = ["default"];
          }
        } else {
          agent.infoMessage("No namespaces found or items array is empty, falling back to 'default'");
          namespacesToScan = ["default"];
        }
      } catch (nsError: any) {
        agent.infoMessage(`Could not list all namespaces: ${nsError.message}. Falling back to 'default' namespace.`);
        allResources.push({
          error: `Namespace discovery failed (fallback to 'default'): ${nsError.message}`,
        });
        namespacesToScan = ["default"];
      }
    }
    if (namespacesToScan.length === 0) {
      agent.infoMessage("No namespaces specified or discovered, defaulting to 'default'");
      namespacesToScan = ["default"];
    }

    const processApiGroupVersion = async (groupVersion: string, _groupNameForLog?: string) => {
      try {
        agent.infoMessage(`Discovering resources for API group version: ${groupVersion}`);
        const apiResourceList = await coreV1Api.getAPIResources();

        for (const resource of apiResourceList.resources) {
          if (!resource.verbs?.includes("list")) {
            continue;
          }

          const parts = groupVersion.split("/");
          const fallbackGroup = parts.length > 1 ? parts[0] : "";
          const fallbackVersion = parts.length > 1 ? parts[1] : parts[0];

          const group = resource.group || fallbackGroup;
          const version = resource.version || fallbackVersion;
          const kind = resource.kind;
          const pluralName = resource.name;

          if (!version) {
            agent.infoMessage(`Skipping resource ${resource.name} due to missing version`);
            continue;
          }

          // For core v1 resources (group is empty), use CoreV1Api
          // For custom resources (non-empty group), use CustomObjectsApi
          if (!group) {
            // Core resources like pods, services, configmaps, etc.
            // Note: These are listed via CoreV1Api methods
            for (const ns of namespacesToScan) {
              try {
                let result: any;
                if (resource.namespaced) {
                  // For namespaced core resources, use listNamespacedCustomObject with core group
                  const { body: coreResult } = await customObjectsApi.listNamespacedCustomObject({
                    group: "",
                    version,
                    namespace: ns,
                    plural: pluralName,
                  });
                  result = coreResult;
                } else {
                  // For cluster-scoped core resources
                  const { body: coreResult } = await customObjectsApi.listClusterCustomObject({
                    group: "",
                    version,
                    plural: pluralName,
                  });
                  result = coreResult;
                }
                if (result?.items) {
                  result.items.forEach((item: any) => {
                    allResources.push({
                      group: "v1",
                      version,
                      kind,
                      namespace: item.metadata?.namespace,
                      name: item.metadata?.name,
                    });
                  });
                }
              } catch (err: any) {
                allResources.push({
                  group: "v1",
                  version,
                  kind,
                  namespace: resource.namespaced ? namespacesToScan[0] : undefined,
                  error: `Failed to list ${kind} instances: ${err.message}`,
                });
              }
            }
          } else {
            // Custom resources - use CustomObjectsApi with the actual group
            for (const ns of namespacesToScan) {
              try {
                let result: any;
                if (resource.namespaced) {
                  const { body: customResult } = await customObjectsApi.listNamespacedCustomObject({
                    group,
                    version,
                    namespace: ns,
                    plural: pluralName,
                  });
                  result = customResult;
                } else {
                  const { body: customResult } = await customObjectsApi.listClusterCustomObject({
                    group,
                    version,
                    plural: pluralName,
                  });
                  result = customResult;
                }
                if (result?.items) {
                  result.items.forEach((item: any) => {
                    allResources.push({
                      group,
                      version,
                      kind,
                      namespace: item.metadata?.namespace,
                      name: item.metadata?.name,
                    });
                  });
                }
              } catch (err: any) {
                allResources.push({
                  group,
                  version,
                  kind,
                  namespace: resource.namespaced ? ns : undefined,
                  error: `Failed to list ${kind} instances: ${err.message}`,
                });
              }
            }
          }
        }
      } catch (groupError: any) {
        agent.infoMessage(`Failed to discover or process resources for API group version ${groupVersion}: ${groupError.message}`);
        allResources.push({
          error: `Resource discovery failed for groupVersion ${groupVersion}: ${groupError.message}`,
        });
      }
    };

    // Process core v1 API group
    agent.infoMessage("Processing core v1 API group...");
    await processApiGroupVersion("v1", "core");

    // Discover and process other API groups
    agent.infoMessage("Discovering other API groups...");
    try {
      const apiGroups = await apisApi.getAPIVersions();
      if (apiGroups?.groups) {
        for (const group of apiGroups.groups) {
          if (group.preferredVersion?.groupVersion) {
            agent.infoMessage(`Processing preferred version ${group.preferredVersion.groupVersion} for group ${group.name}`);
            await processApiGroupVersion(group.preferredVersion.groupVersion, group.name);
          } else {
            agent.infoMessage(`Skipping API group ${group.name} as it has no preferred version listed.`);
          }
        }
      } else {
        agent.infoMessage("No additional API groups found or groups array is missing.");
      }
    } catch (apiGroupsError: any) {
      agent.errorMessage(`Failed to get API group list: ${apiGroupsError.message}`);
      allResources.push({
        error: `Failed to get API group list: ${apiGroupsError.message}`,
      });
    }

    agent.infoMessage("Finished processing all resources.");
    return allResources;
  }
}
