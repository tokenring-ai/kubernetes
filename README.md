# @token-ring/kubernetes

Kubernetes integration for the Token Ring ecosystem. This package exposes a Service that configures a Kubernetes client and a set of tools that operate on your cluster through that service.

Current focus: discover API groups/resources and list instances of accessible resource types, either cluster-scoped or namespace-scoped.

## What it provides

- KubernetesService (Service)
  - Manages connection details to a Kubernetes cluster (server URL, auth, namespace)
  - Exposes helper methods and high-level operations, notably listAllApiResourceTypes()
- Tools namespace
  - tools.listKubernetesApiResources: a tool wrapper that invokes KubernetesService.listAllApiResourceTypes and returns a normalized result for agent/workflow consumption
- Package metadata exports (name, description, version)

## Installation and workspace

This package is part of the Token Ring monorepo and referenced as:
- Name: `@token-ring/kubernetes`
- Version: `0.1.0`

It expects a Service registry from `@token-ring/registry` and uses the official Kubernetes JavaScript client `@kubernetes/client-node` under the hood.

## KubernetesService

Class: `KubernetesService extends Service`

Purpose: configure a client using explicit connection parameters and provide discovery/list functionality across API groups.

Constructor parameters (also exposed in static constructorProperties):
- clusterName (string, required): logical name of the cluster
- apiServerUrl (string, required): full URL to the Kubernetes API server
- namespace (string, optional): default namespace; if omitted, the service will attempt to enumerate all namespaces, falling back to "default" if listing fails
- token (string, optional): bearer token authentication
- clientCertificate (string, optional): base64-encoded PEM for TLS client cert
- clientKey (string, optional): base64-encoded PEM for TLS client key
- caCertificate (string, optional): base64-encoded PEM for cluster CA

Key methods:
- start(registry): initialize the service (log-oriented bootstrap)
- stop(registry): shutdown hooks
- status(registry): returns basic status information
- listAllApiResourceTypes(registry):
  - Builds a KubeConfig from the provided parameters
  - Uses DiscoveryApi to enumerate API groups and resources (including core v1)
  - For each resource supporting the "list" verb, attempts to list instances
    - Namespace-scoped: lists per namespace (either the configured namespace or discovered namespaces)
    - Cluster-scoped: lists once at the cluster level
  - Aggregates results into a flat array; on failures, appends best-effort error entries rather than throwing, to maximize coverage

Notes on authentication:
- If token is provided, it is used for auth
- Else, if clientCertificate and clientKey are provided, mTLS is used
- caCertificate can be provided to validate the API server certificate

## Tools

All tools are exported via `@token-ring/kubernetes/tools` and also re-exported from the package root under `tools`.

### tools.listKubernetesApiResources
- Description: "Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace."
- Parameters: none (Zod schema is an empty object)
- Behavior:
  - Looks up KubernetesService from the registry (supports name-based `get("KubernetesService")` and type-based `requireFirstServiceByType(KubernetesService)`) to be compatible with different run-times/tests
  - Calls `kubernetesService.listAllApiResourceTypes(registry)`
  - Returns `{ resources }` on success, or `{ error }` with a friendly message on failure

Example (pseudo usage with a registry):

```ts
import { ServiceRegistry } from "@token-ring/registry";
import { KubernetesService, tools as k8sTools } from "@token-ring/kubernetes";

const registry = new ServiceRegistry();

// Register your KubernetesService with connection details
registry.services.addServices(
  new KubernetesService({
    clusterName: "my-cluster",
    apiServerUrl: "https://your-apiserver:6443",
    namespace: "default",          // optional
    token: process.env.K8S_TOKEN,   // or use clientCertificate/clientKey
    caCertificate: process.env.K8S_CA_CERT_BASE64,
  })
);

// Later, execute the tool (from an agent, workflow, or direct call)
const result = await k8sTools.listKubernetesApiResources.execute({}, registry);
if (result.error) {
  console.error("Error:", result.error);
} else {
  console.log("Discovered resources:", result.resources);
}
```

Example resource item (shape may vary by API group):

```json
{
  "group": "apps",
  "version": "v1",
  "kind": "Deployment",
  "namespace": "default",
  "name": "web"
}
```

On errors while listing certain resources or namespaces, the tool may include entries like:

```json
{ "group": "batch", "version": "v1", "kind": "Job", "namespace": "ns-a", "error": "Failed to list instances: <message>" }
```

## Programmatic service setup

If you prefer using the service directly without the tool wrapper:

```ts
import { KubernetesService } from "@token-ring/kubernetes";
import { Registry } from "@token-ring/registry";

const svc = new KubernetesService({
  clusterName: "dev",
  apiServerUrl: "https://api.dev.local:6443",
});
const registry = new Registry();
const resources = await svc.listAllApiResourceTypes(registry);
```

## Testing

This package uses Vitest. A unit test exists for the tool wrapper:
- pkg/kubernetes/test/listKubernetesApiResources.test.js

Run tests:
- From repo root: `cd pkg/kubernetes && bun run test`
- Or use your workspace test runner to target this package

## Dependencies

Directly uses:
- `@kubernetes/client-node` for Kubernetes API interactions (DiscoveryApi, CoreV1Api, CustomObjectsApi)
- `@token-ring/registry` for service registration and lookup

## License

MIT
