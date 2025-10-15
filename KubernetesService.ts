import {ApisApi, CoreV1Api, CustomObjectsApi, KubeConfig,} from "@kubernetes/client-node";
import {Agent} from "@tokenring-ai/agent";
import {TokenRingService} from "@tokenring-ai/agent/types";
import {z} from "zod";

export const KubernetesServiceParamsSchema = z.object({
  clusterName: z.string(),
  apiServerUrl: z.string(),
  namespace: z.string().optional(),
  token: z.string().optional(),
  clientCertificate: z.string().optional(),
  clientKey: z.string().optional(),
  caCertificate: z.string().optional(),
});

export type KubernetesServiceParams = z.infer<typeof KubernetesServiceParamsSchema>;

/**
 * Information about a discovered Kubernetes resource.
 */
export interface K8sResourceInfo {
  /** API group, e.g., "apps" or "" for core resources */
  group?: string;
  /** API version, e.g., "v1" */
  version?: string;
  /** Kind of the resource, e.g., "Pod" */
  kind?: string;
  /** Namespace for namespaced resources */
  namespace?: string;
  /** Name of the resource */
  name?: string;
  /** Optional error message if the resource could not be listed */
  error?: string;
}

/** Configuration object for a cluster entry in KubeConfig. */
interface ClusterConfig {
  name: string;
  server: string;
  caData?: string;
}

/** Configuration object for a user entry in KubeConfig. */
interface UserConfig {
  name: string;
  token?: string;
  clientCertificateData?: string;
  clientKeyData?: string;
}

export default class KubernetesService implements TokenRingService {
  name = "KubernetesService";
  description = "Provides Kubernetes functionality";
  private readonly clusterName!: string;
  private readonly apiServerUrl!: string;
  private readonly namespace?: string;
  private readonly token?: string;
  private readonly clientCertificate?: string;
  private readonly clientKey?: string;
  private readonly caCertificate?: string;

  constructor({
                clusterName,
                apiServerUrl,
                namespace,
                token,
                clientCertificate,
                clientKey,
                caCertificate,
              }: KubernetesServiceParams) {
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
  /**
   * Discover all API resource types across the cluster.
   */
  async listAllApiResourceTypes(_agent: Agent): Promise<K8sResourceInfo[]> {
    const kc = new KubeConfig();

    // Prepare cluster configuration
    const clusterConfig: ClusterConfig = {
      name: this.clusterName,
      server: this.apiServerUrl,
    };
    if (this.caCertificate) {
      clusterConfig.caData = this.caCertificate;
    }

    // Prepare user configuration
    const userConfig: UserConfig = {name: "service-user"};
    if (this.token) {
      userConfig.token = this.token;
    } else if (this.clientCertificate && this.clientKey) {
      userConfig.clientCertificateData = this.clientCertificate;
      userConfig.clientKeyData = this.clientKey;
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
          namespace: this.namespace || "default",
        },
      ],
      currentContext: `${this.clusterName}-context`,
    });

    const apisApi = kc.makeApiClient(ApisApi);
    const coreV1Api = kc.makeApiClient(CoreV1Api);
    const customObjectsApi = kc.makeApiClient(CustomObjectsApi);
    const allResources: K8sResourceInfo[] = [];

    // Determine which namespaces to scan
    let namespacesToScan: string[] = [];
    if (this.namespace) {
      namespacesToScan.push(this.namespace);
    } else {
      try {
        console.log("Attempting to list all namespaces...");
        const nsList = await coreV1Api.listNamespace();
        if (nsList && nsList.items) {
          namespacesToScan = nsList.items.map((ns) => (ns.metadata?.name ?? ""));
          console.log(`Found namespaces: ${namespacesToScan.join(", ")}`);
        } else {
          console.log("No namespaces found or items array is missing.");
          namespacesToScan = ["default"];
        }
      } catch (nsError: any) {
        console.warn(`Could not list all namespaces: ${nsError.message}. Falling back to 'default' namespace.`);
        allResources.push({error: `Namespace discovery failed (fallback to 'default'): ${nsError.message}`});
        namespacesToScan = ["default"];
      }
    }
    if (namespacesToScan.length === 0) {
      console.warn("No namespaces specified or discovered, defaulting to 'default'.");
      namespacesToScan = ["default"];
    }

    const processApiGroupVersion = async (groupVersion: string, _groupNameForLog?: string) => {
      try {
        console.log(`Discovering resources for API group version: ${groupVersion}`);
        const apiResourceList = await coreV1Api.getAPIResources();

        for (const resource of apiResourceList.resources) {
          if (!resource.verbs || !resource.verbs.includes("list")) {
            continue;
          }

          const group = resource.group || groupVersion.split("/")[0] || "";
          const version = resource.version || groupVersion.split("/")[1];
          const kind = resource.kind;
          const pluralName = resource.name;

          if (resource.namespaced) {
            for (const ns of namespacesToScan) {
              try {
                const {body: result} = await customObjectsApi.listNamespacedCustomObject({
                  group,
                  version,
                  namespace: ns,
                  plural: pluralName
                });
                if (result?.items) {
                  result.items.forEach((item: any) =>
                    allResources.push({
                      group,
                      version,
                      kind,
                      namespace: item.metadata?.namespace,
                      name: item.metadata?.name,
                    })
                  );
                }
              } catch (err: any) {
                allResources.push({
                  group,
                  version,
                  kind,
                  namespace: ns,
                  error: `Failed to list instances: ${err.message}`,
                });
              }
            }
          } else {
            try {
              const {body: result} = await customObjectsApi.listClusterCustomObject(
                {
                  group,
                  version,
                  plural: pluralName
                }
              );
              if (result?.items) {
                result.items.forEach((item: any) =>
                  allResources.push({
                    group,
                    version,
                    kind,
                    name: item.metadata?.name,
                  })
                );
              }
            } catch (err: any) {
              allResources.push({
                group,
                version,
                kind,
                error: `Failed to list instances: ${err.message}`,
              });
            }
          }
        }
      } catch (groupError: any) {
        console.warn(`Failed to discover or process resources for API group version ${groupVersion}: ${groupError.message}`);
        allResources.push({error: `Resource discovery failed for groupVersion ${groupVersion}: ${groupError.message}`});
      }
    };

    // Process core v1 API group
    console.log("Processing core v1 API group...");
    await processApiGroupVersion("v1", "core");

    // Discover and process other API groups
    console.log("Discovering other API groups...");
    try {
      const apiGroups = await apisApi.getAPIVersions();
      if (apiGroups && apiGroups.groups) {
        for (const group of apiGroups.groups) {
          if (group.preferredVersion && group.preferredVersion.groupVersion) {
            console.log(`Processing preferred version ${group.preferredVersion.groupVersion} for group ${group.name}`);
            await processApiGroupVersion(group.preferredVersion.groupVersion, group.name);
          } else {
            console.log(`Skipping API group ${group.name} as it has no preferred version listed.`);
          }
        }
      } else {
        console.log("No additional API groups found or groups array is missing.");
      }
    } catch (apiGroupsError: any) {
      console.error(`Failed to get API group list: ${apiGroupsError.message}`);
      allResources.push({error: `Failed to get API group list: ${apiGroupsError.message}`});
    }

    console.log("Finished processing all resources.");
    return allResources;
  }
}
