# Kubernetes Package Documentation

## Overview

The `@tokenring-ai/kubernetes` package provides Kubernetes integration for TokenRing AI agents. It enables AI agents to
discover and interact with Kubernetes clusters by listing all accessible API resources, including core and custom
resources across namespaces. This package is designed to work within the TokenRing AI framework, allowing agents to
query cluster state without direct kubectl access. The primary functionality focuses on resource discovery, supporting
both namespaced and cluster-scoped resources, with fallback handling for authentication and namespace listing.

This package uses the official Kubernetes Node.js client library to connect to clusters via API server URLs, tokens, or
certificates. It is suitable for scenarios where agents need to inspect cluster resources, such as monitoring
deployments, pods, or custom objects in AI-driven operations.

## Installation/Setup

This package is part of a larger monorepo or project using the TokenRing AI framework. To use it:

1. Ensure your project has Node.js (v18+) and npm/yarn installed.
2. Install dependencies via the root project's package manager, or for standalone use:
   ```
   npm install @tokenring-ai/kubernetes @tokenring-ai/agent @kubernetes/client-node
   ```
3. Configure Kubernetes access: Provide cluster details (API server URL, token/certificates) when instantiating the
   service.
4. In a TokenRing AI agent setup, register the `KubernetesService` and tools for agent use.

Build and test with:

```
npm run test  # Runs Vitest tests
```

No additional build step is required as it's an ES module (type: "module").

## Package Structure

The package is organized as follows:

- **index.ts**: Entry point. Exports `KubernetesService` and package metadata (`TokenRingPackage`) including tools.
- **KubernetesService.ts**: Core service class implementing `TokenRingService`. Handles cluster connection and resource
  discovery.
- **tools.ts**: Exports available tools (e.g., `listKubernetesApiResources`).
- **tools/listKubernetesApiResources.ts**: Tool implementation for listing Kubernetes resources.
- **package.json**: Package metadata, dependencies, and scripts.
- **test/**: Unit tests (e.g., `listKubernetesApiResources.test.js`).
- **README.md**: This documentation file.
- **LICENSE**: MIT license.

Directories like `tools/` contain modular tool definitions for agent integration.

## Core Components

### KubernetesService

The main class for Kubernetes integration. It connects to a cluster using provided credentials and provides methods to
discover resources.

#### Description

Implements `TokenRingService` for use in TokenRing AI agents. Supports authentication via token or client certificates.
Discovers API groups, versions, and lists resource instances, handling core (v1) and custom resources. If no namespace
is specified, it attempts to list all namespaces; falls back to "default".

#### Key Methods

- **Constructor** (`KubernetesServiceParams`):
  ```typescript
  constructor(params: KubernetesServiceParams)
  ```
  Parameters:
 - `clusterName: string` (required): Name of the cluster.
 - `apiServerUrl: string` (required): Kubernetes API server URL (e.g., "https://localhost:6443").
 - `namespace?: string`: Target namespace (defaults to "default").
 - `token?: string`: Bearer token for authentication.
 - `clientCertificate?: string`: Client certificate (PEM/Base64).
 - `clientKey?: string`: Client private key (PEM/Base64).
 - `caCertificate?: string`: CA certificate for server verification.

  Throws errors if `clusterName` or `apiServerUrl` are missing.

- **Getters**:
 - `getClusterName(): string`
 - `getApiServerUrl(): string`
 - `getNamespace(): string`
 - `getToken(): string | undefined`
 - `getClientCertificate(): string | undefined`
 - `getClientKey(): string | undefined`
 - `getCaCertificate(): string | undefined`

  These expose configuration for logging or further use.

- **listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]>**
  Discovers and lists all API resources. Processes core v1 and other API groups via discovery API. For namespaced
  resources, scans specified or all namespaces. Returns an array of `K8sResourceInfo` objects with details or errors.

  Example output structure:
  ```typescript
  interface K8sResourceInfo {
    group?: string;      // e.g., "apps" or empty for core
    version?: string;    // e.g., "v1"
    kind?: string;       // e.g., "Pod"
    namespace?: string;  // For namespaced resources
    name?: string;       // Resource name
    error?: string;      // If listing failed
  }
  ```

  Internals: Uses `KubeConfig` to build client configs, `DiscoveryApi` for groups, `CoreV1Api` for namespaces, and
  `CustomObjectsApi` for listing. Logs progress and handles errors per resource/group.

#### Interactions

The service is instantiated in an agent context. Tools like `listKubernetesApiResources` require this service via
`agent.requireFirstServiceByType(KubernetesService)` and call its methods.

### Tools: listKubernetesApiResources

A TokenRing AI tool for agents to list resources without direct service access.

- **execute({}, agent: Agent): Promise<{ output: string }>`
  Calls `kubernetesService.listAllApiResourceTypes(agent)` and returns JSON-stringified results.

- **inputSchema**: `z.object({})` (no inputs required).
- **description**: "Lists all instances of all accessible API resource types in the configured Kubernetes cluster..."

Tools are exported via `tools.ts` and included in the package's `TokenRingPackage`.

## Usage Examples

### 1. Instantiating KubernetesService

```typescript
import KubernetesService from '@tokenring-ai/kubernetes';

const service = new KubernetesService({
  clusterName: 'my-cluster',
  apiServerUrl: 'https://api.example.com:6443',
  namespace: 'default',
  token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',  // Or use certificates
});

console.log(service.getClusterName());  // "my-cluster"
```

### 2. Using in a TokenRing AI Agent (Resource Listing)

```typescript
import { Agent } from '@tokenring-ai/agent';
import KubernetesService from '@tokenring-ai/kubernetes';
import { listKubernetesApiResources } from '@tokenring-ai/kubernetes/tools/listKubernetesApiResources.ts';

const agent = new Agent({
  services: [new KubernetesService({ /* params */ })],
  tools: [listKubernetesApiResources],
});

// Agent calls the tool
const result = await agent.executeTool('kubernetes/listKubernetesApiResources', {});
console.log(result.output);  // JSON array of K8sResourceInfo
```

### 3. Direct Resource Discovery

```typescript
// In an async context with agent
const resources = await service.listAllApiResourceTypes(agent);
resources.forEach(resource => {
  if (resource.error) {
    console.warn(`Error for ${resource.kind}: ${resource.error}`);
  } else {
    console.log(`${resource.kind} in ${resource.namespace || 'cluster'}: ${resource.name}`);
  }
});
```

## Configuration Options

- **KubernetesServiceParams**: As detailed in constructor. Environment variables aren't directly used; pass via code.
- **Namespace Handling**: If omitted, auto-discovers all namespaces using `CoreV1Api.listNamespace()`. Falls back to "
  default" on failure.
- **Authentication**: Supports token (preferred) or client cert/key. CA cert optional for insecure setups (not
  recommended).
- **Logging**: Console logs during discovery for debugging (e.g., namespaces found, API groups processed).

No additional config files; all via constructor params.

## API Reference

- **KubernetesService**
 - `new KubernetesService(params: KubernetesServiceParams)`
 - `getClusterName(): string`
 - `getApiServerUrl(): string`
 - `getNamespace(): string`
 - `getToken(): string | undefined`
 - `getClientCertificate(): string | undefined`
 - `getClientKey(): string | undefined`
 - `getCaCertificate(): string | undefined`
 - `listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]>`

- **Tools**
 - `execute({}, agent: Agent): Promise<{ output: string }>` for `listKubernetesApiResources`
 - `inputSchema: z.object({})`
 - `name: "kubernetes/listKubernetesApiResources"`

- **Interfaces**
 - `KubernetesServiceParams`
 - `K8sResourceInfo`

Exports: `KubernetesService` (default), tools via `packageInfo.tools`.

## Dependencies

- `@kubernetes/client-node` (^1.3.0): Kubernetes client library for API interactions.
- `@tokenring-ai/agent` (0.1.0): TokenRing AI framework for services and tools.
- `zod`: For schema validation in tools.
- Dev: `vitest` (^3.2.4) for testing.
- Others (unused in core): `glob-gitignore`, `next-auth`, `react-syntax-highlighter`, `vite` (likely project-level).

## Contributing/Notes

- **Testing**: Run `npm run test` with Vitest. Tests cover tool execution (e.g., `listKubernetesApiResources.test.js`).
- **Building**: No build step; uses ES modules. Ensure TypeScript support in your project.
- **Limitations**:
 - Focuses on read-only listing/discovery; no create/update/delete yet.
 - Requires valid cluster access; errors are captured in `K8sResourceInfo.error`.
 - Namespace discovery may fail in restricted clusters—specify namespace explicitly.
 - Binary/large responses: Output is JSON; large clusters may produce verbose results (no pagination implemented).
- **Security**: Handle credentials securely (e.g., via env vars in production). Avoid logging sensitive data.
- Contributions: Follow TypeScript best practices. Add tests for new features. Update package version on changes.

For issues or extensions (e.g., adding CRUD tools), refer to the TokenRing AI repo guidelines.