import { ApisApi, CoreV1Api, CustomObjectsApi, KubeConfig } from "@kubernetes/client-node";
import type { Agent } from "@tokenring-ai/agent";

import type { TokenRingService } from "@tokenring-ai/app/types";
import formatError from "@tokenring-ai/utility/error/formatError";
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

interface K8sResourceListItem {
  metadata?: {
    namespace?: string | undefined;
    name?: string | undefined;
  };
}

interface K8sResourceListResult {
  items?: K8sResourceListItem[] | undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function unwrapResourceList(result: unknown): K8sResourceListResult {
  if (!result || typeof result !== "object") {
    return {};
  }
  const record = result as { items?: K8sResourceListItem[]; body?: K8sResourceListResult };
  if (Array.isArray(record.items)) {
    return record;
  }
  if (record.body && typeof record.body === "object") {
    return record.body;
  }
  return {};
}

export default class KubernetesService implements TokenRingService {
  readonly name = "KubernetesService";
  description = "Provides Kubernetes functionality";

  private options: ParsedKubernetesServiceConfig | undefined;

  constructor(options?: ParsedKubernetesServiceConfig) {
    if (options) this.options = options;
  }

  reconfigure(options: ParsedKubernetesServiceConfig): void {
    this.options = options;
  }

  /**
   * Discover all API resource types across the cluster.
   */
  async listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]> {
    const options = this.options;
    if (!options) {
      throw new Error("Kubernetes service has not been configured");
    }

    const kc = new KubeConfig();

    // Prepare cluster configuration
    const clusterConfig: ClusterConfig = {
      name: options.clusterName,
      server: options.apiServerUrl,
    };
    if (options.caCertificate) {
      clusterConfig.caData = options.caCertificate;
    }

    // Prepare user configuration
    const globalConfig: UserConfig = { name: "service-user" };
    if (options.token) {
      globalConfig.token = options.token;
    } else if (options.clientCertificate && options.clientKey) {
      globalConfig.clientCertificateData = options.clientCertificate;
      globalConfig.clientKeyData = options.clientKey;
    }

    // Load KubeConfig from options
    kc.loadFromOptions({
      clusters: [clusterConfig],
      users: [globalConfig],
      contexts: [
        {
          name: `${options.clusterName}-context`,
          cluster: options.clusterName,
          user: globalConfig.name,
          namespace: options.namespace || "default",
        },
      ],
      currentContext: `${options.clusterName}-context`,
    });

    const apisApi = kc.makeApiClient(ApisApi);
    const coreV1Api = kc.makeApiClient(CoreV1Api);
    const customObjectsApi = kc.makeApiClient(CustomObjectsApi);
    const allResources: K8sResourceInfo[] = [];
    const signal = agent.getAbortSignal();

    // Determine which namespaces to scan
    let namespacesToScan: string[] = [];
    if (options.namespace) {
      namespacesToScan.push(options.namespace);
      agent.infoMessage(`Using configured namespace: ${options.namespace}`);
    } else {
      try {
        agent.infoMessage("Attempting to list all namespaces...");
        const nsList = await coreV1Api.listNamespace();
        if (nsList.items.length > 0) {
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
      } catch (nsError: unknown) {
        const message = errorMessage(nsError);
        agent.infoMessage(`Could not list all namespaces: ${message}. Falling back to 'default' namespace.`);
        allResources.push({
          error: `Namespace discovery failed (fallback to 'default'): ${message}`,
        });
        namespacesToScan = ["default"];
      }
    }

    const processApiGroupVersion = async (groupVersion: string, _groupNameForLog?: string) => {
      try {
        if (isAborted(signal)) {
          agent.infoMessage("Resource discovery was aborted.");
          return;
        }

        agent.infoMessage(`Discovering resources for API group version: ${groupVersion}`);

        const parts = groupVersion.split("/");
        const fallbackGroup = parts.length > 1 ? (parts[0] ?? "") : "";
        const fallbackVersion = (parts.length > 1 ? parts[1] : parts[0]) ?? "";

        if (!fallbackVersion) {
          agent.infoMessage(`Skipping API group version ${groupVersion} due to missing version`);
          return;
        }

        // Core v1 lives at /api/v1; all other groups use /apis/{group}/{version}
        const apiResourceList = fallbackGroup
          ? await customObjectsApi.getAPIResources({ group: fallbackGroup, version: fallbackVersion })
          : await coreV1Api.getAPIResources();

        for (const resource of apiResourceList.resources) {
          if (isAborted(signal)) {
            agent.infoMessage("Resource discovery was aborted.");
            return;
          }
          if (!resource.verbs.includes("list")) {
            continue;
          }

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
              if (isAborted(signal)) {
                agent.infoMessage("Resource discovery was aborted.");
                return;
              }
              try {
                let listed: unknown;
                if (resource.namespaced) {
                  // For namespaced core resources, use listNamespacedCustomObject with core group
                  listed = await customObjectsApi.listNamespacedCustomObject({
                    group: "",
                    version,
                    namespace: ns,
                    plural: pluralName,
                  });
                } else {
                  // For cluster-scoped core resources
                  listed = await customObjectsApi.listClusterCustomObject({
                    group: "",
                    version,
                    plural: pluralName,
                  });
                }
                const result = unwrapResourceList(listed);
                if (result.items) {
                  result.items.forEach(item => {
                    allResources.push({
                      group: "",
                      version,
                      kind,
                      namespace: item.metadata?.namespace,
                      name: item.metadata?.name,
                    });
                  });
                }
              } catch (err) {
                allResources.push({
                  group: "",
                  version,
                  kind,
                  namespace: resource.namespaced ? namespacesToScan[0] : undefined,
                  error: `Failed to list ${kind} instances: ${formatError(err)}`,
                });
              }
            }
          } else {
            // Custom resources - use CustomObjectsApi with the actual group
            for (const ns of namespacesToScan) {
              if (isAborted(signal)) {
                agent.infoMessage("Resource discovery was aborted.");
                return;
              }
              try {
                let listed: unknown;
                if (resource.namespaced) {
                  listed = await customObjectsApi.listNamespacedCustomObject({
                    group,
                    version,
                    namespace: ns,
                    plural: pluralName,
                  });
                } else {
                  listed = await customObjectsApi.listClusterCustomObject({
                    group,
                    version,
                    plural: pluralName,
                  });
                }
                const result = unwrapResourceList(listed);
                if (result.items) {
                  result.items.forEach(item => {
                    allResources.push({
                      group,
                      version,
                      kind,
                      namespace: item.metadata?.namespace,
                      name: item.metadata?.name,
                    });
                  });
                }
              } catch (err) {
                allResources.push({
                  group,
                  version,
                  kind,
                  namespace: resource.namespaced ? ns : undefined,
                  error: `Failed to list ${kind} instances: ${formatError(err)}`,
                });
              }
            }
          }
        }
      } catch (groupError: unknown) {
        const message = errorMessage(groupError);
        agent.infoMessage(`Failed to discover or process resources for API group version ${groupVersion}: ${message}`);
        allResources.push({
          error: `Resource discovery failed for groupVersion ${groupVersion}: ${message}`,
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
      for (const group of apiGroups.groups) {
        if (isAborted(signal)) {
          agent.infoMessage("Resource discovery was aborted.");
          break;
        }
        if (group.preferredVersion?.groupVersion) {
          agent.infoMessage(`Processing preferred version ${group.preferredVersion.groupVersion} for group ${group.name}`);
          await processApiGroupVersion(group.preferredVersion.groupVersion, group.name);
        } else {
          agent.infoMessage(`Skipping API group ${group.name} as it has no preferred version listed.`);
        }
      }
    } catch (apiGroupsError: unknown) {
      const message = errorMessage(apiGroupsError);
      agent.errorMessage(`Failed to get API group list: ${message}`);
      allResources.push({
        error: `Failed to get API group list: ${message}`,
      });
    }

    agent.infoMessage("Finished processing all resources.");
    return allResources;
  }
}
