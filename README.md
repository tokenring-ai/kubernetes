# @tokenring-ai/kubernetes

Kubernetes integration for TokenRing AI agents, enabling AI agents to discover and interact with Kubernetes clusters by listing all accessible API resources, including core and custom resources across namespaces.

## Overview

The `@tokenring-ai/kubernetes` package provides comprehensive Kubernetes cluster integration for TokenRing AI agents. It enables agents to discover and interact with Kubernetes clusters by listing all accessible API resources, including core and custom resources across namespaces. This package is designed to work within the TokenRing AI framework, allowing agents to query cluster state without direct kubectl access.

### Key Features

- **Resource Discovery**: Lists all accessible API resources across core and custom resource groups
- **Multi-Namespace Support**: Discovers resources across all namespaces or specified namespace
- **Authentication Support**: Token-based and client certificate authentication
- **Plugin Integration**: Automatic integration with TokenRing applications
- **Error Handling**: Graceful error handling with detailed error messages
- **Service Architecture**: Built on TokenRing service architecture for seamless agent integration

### Integration Points

- **@tokenring-ai/agent**: Integrates with agent system for tool execution and service access
- **@tokenring-ai/app**: Plugin registration and service management
- **@tokenring-ai/chat**: Tool registration for chat-based interaction

### Tech Stack

- **Runtime**: Bun
- **Testing**: Vitest
- **Language**: TypeScript
- **Kubernetes Client**: `@kubernetes/client-node` (^1.4.0)

## Installation

This package is part of the TokenRing AI monorepo. To use it:

1. Ensure your project has Bun installed
2. The package is available as a dependency
3. Configure Kubernetes access through the plugin configuration

For standalone usage:

```bash
bun install @tokenring-ai/kubernetes
```

## Package Structure

```
pkg/kubernetes/
├── index.ts                          # Entry point - exports KubernetesService
├── KubernetesService.ts              # Core service implementation
├── plugin.ts                         # TokenRing plugin integration
├── tools.ts                          # Tool exports
├── tools/
│   └── listKubernetesApiResources.ts # Resource listing tool
├── schema.ts                         # Configuration schema
├── vitest.config.ts                  # Vitest configuration
├── package.json                      # Package metadata and dependencies
└── README.md                         # This documentation
```

## Core Components

### KubernetesService

The main service class implementing `TokenRingService` for Kubernetes integration.

#### Class Definition

```typescript
import KubernetesService from '@tokenring-ai/kubernetes';

const service = new KubernetesService({
  clusterName: 'my-cluster',
  apiServerUrl: 'https://api.example.com:6443',
  namespace: 'production',
  token: process.env.K8S_TOKEN,
});
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Service name: `"KubernetesService"` |
| `description` | `string` | Service description: `"Provides Kubernetes functionality"` |
| `options` | `ParsedKubernetesServiceConfig` | Configuration object |

#### Constructor Parameters

The constructor accepts a `ParsedKubernetesServiceConfig` object:

```typescript
interface ParsedKubernetesServiceConfig {
  clusterName: string;        // Required: Name of the cluster
  apiServerUrl: string;       // Required: Kubernetes API server URL
  namespace?: string;         // Optional: Target namespace (defaults to "default")
  token?: string;             // Optional: Bearer token for authentication
  clientCertificate?: string; // Optional: Client certificate (PEM/Base64)
  clientKey?: string;         // Optional: Client private key (PEM/Base64)
  caCertificate?: string;     // Optional: CA certificate for server verification
}
```

#### Methods

##### `listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]>`

Discovers and lists all API resources in the cluster.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agent` | `Agent` | The agent instance for service registry access and logging |

**Returns:** `Promise<K8sResourceInfo[]>` - Array of discovered Kubernetes resources

**Behavior:**

1. Creates a `KubeConfig` from the service options
2. Determines which namespaces to scan (all namespaces or specified namespace)
3. Discovers all API groups and their preferred versions
4. For each API group version, retrieves available resources
5. Filters resources that support the `list` verb
6. Lists all instances of each resource across the configured namespaces
7. Returns an array of `K8sResourceInfo` objects

**Response Format:**

```typescript
interface K8sResourceInfo {
  group?: string;      // API group (e.g., "apps" or "" for core resources)
  version?: string;    // API version (e.g., "v1")
  kind?: string;       // Resource kind (e.g., "Pod")
  namespace?: string;  // Namespace for namespaced resources
  name?: string;       // Resource name
  error?: string;      // Error message if listing failed
}
```

**Example:**

```typescript
import { Agent } from '@tokenring-ai/agent';
import KubernetesService from '@tokenring-ai/kubernetes';

const service = new KubernetesService({
  clusterName: 'my-cluster',
  apiServerUrl: 'https://api.example.com:6443',
  namespace: 'default',
  token: 'your-token-here',
});

const agent = new Agent({ services: [service] });
const resources = await service.listAllApiResourceTypes(agent);

console.log(`Found ${resources.length} resources`);
resources.forEach(resource => {
  if (resource.error) {
    console.error(`Error: ${resource.error}`);
  } else {
    console.log(`${resource.kind} ${resource.name} in ${resource.namespace}`);
  }
});
```

### Interfaces

#### `ParsedKubernetesServiceConfig`

Configuration interface for the KubernetesService.

```typescript
interface ParsedKubernetesServiceConfig {
  clusterName: string;
  apiServerUrl: string;
  namespace?: string;
  token?: string;
  clientCertificate?: string;
  clientKey?: string;
  caCertificate?: string;
}
```

#### `K8sResourceInfo`

Information about a discovered Kubernetes resource.

```typescript
interface K8sResourceInfo {
  group?: string;
  version?: string;
  kind?: string;
  namespace?: string;
  name?: string;
  error?: string;
}
```

## Services

### KubernetesService

The main service implementing `TokenRingService` for Kubernetes integration.

**Service Name:** `KubernetesService`

**Service Description:** `Provides Kubernetes functionality`

**Registration:**

```typescript
import TokenRingApp from '@tokenring-ai/app';
import KubernetesService from '@tokenring-ai/kubernetes';

const app = new TokenRingApp({
  config: {
    kubernetes: {
      clusterName: 'my-cluster',
      apiServerUrl: 'https://api.example.com:6443',
      namespace: 'production',
      token: process.env.K8S_TOKEN,
    }
  }
});

// Service is automatically registered via plugin
```

**Manual Registration:**

```typescript
import { Agent } from '@tokenring-ai/agent';
import KubernetesService from '@tokenring-ai/kubernetes';

const service = new KubernetesService({
  clusterName: 'my-cluster',
  apiServerUrl: 'https://api.example.com:6443',
  namespace: 'default',
  token: 'your-token-here',
});

const agent = new Agent({
  services: [service],
});
```

## Providers

This package does not define providers.

## RPC Endpoints

This package does not define RPC endpoints.

## Chat Commands

This package does not define chat commands. Instead, it provides tools that can be used by agents to interact with Kubernetes clusters.

## Configuration

### Configuration Schema

The package uses Zod for configuration validation:

```typescript
import { KubernetesServiceConfigSchema } from '@tokenring-ai/kubernetes';

const schema = KubernetesServiceConfigSchema;
```

**Schema Definition:**

```typescript
import z from "zod";

export const KubernetesServiceConfigSchema = z.object({
  clusterName: z.string(),
  apiServerUrl: z.string(),
  namespace: z.string().default("default"),
  token: z.string().optional(),
  clientCertificate: z.string().optional(),
  clientKey: z.string().optional(),
  caCertificate: z.string().optional(),
});

export type ParsedKubernetesServiceConfig = z.output<typeof KubernetesServiceConfigSchema>;
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `clusterName` | `string` | Yes | - | Unique identifier for the cluster |
| `apiServerUrl` | `string` | Yes | - | Full URL to the Kubernetes API server |
| `namespace` | `string` | No | `"default"` | Target namespace (discovers all if not specified) |
| `token` | `string` | No | - | Bearer token for authentication |
| `clientCertificate` | `string` | No | - | Client certificate in PEM format |
| `clientKey` | `string` | No | - | Client private key in PEM format |
| `caCertificate` | `string` | No | - | CA certificate for server verification |

### Authentication Methods

#### Token Authentication (Recommended)

```typescript
{
  clusterName: 'cluster',
  apiServerUrl: 'https://api.example.com:6443',
  token: 'your-bearer-token',
}
```

#### Certificate Authentication

```typescript
{
  clusterName: 'cluster',
  apiServerUrl: 'https://api.example.com:6443',
  clientCertificate: 'cert-data',
  clientKey: 'key-data',
  caCertificate: 'ca-cert-data',
}
```

### Namespace Handling

- **Specified namespace**: Service scans only the specified namespace
- **No namespace**: Service attempts to discover all namespaces using `CoreV1Api.listNamespace()`
- **Fallback**: If namespace discovery fails or returns no namespaces, defaults to `"default"` namespace

## Tools

This package provides the following tool for agent interaction with Kubernetes clusters:

### Kubernetes/listKubernetesApiResources

Lists all instances of all accessible API resource types in the configured Kubernetes cluster.

**Tool Definition:**

| Property | Value |
|----------|-------|
| **Internal Name** | `kubernetes_listKubernetesApiResources` |
| **Display Name** | `Kubernetes/listKubernetesApiResources` |
| **Input Schema** | `z.object({})` (no inputs required) |
| **Description** | Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace. |

**Tool Execution Example:**

```typescript
import { Agent } from '@tokenring-ai/agent';
import KubernetesService from '@tokenring-ai/kubernetes';
import tools from '@tokenring-ai/kubernetes/tools';

const agent = new Agent({
  services: [new KubernetesService({
    clusterName: 'my-cluster',
    apiServerUrl: 'https://api.example.com:6443',
    namespace: 'default',
    token: 'your-token-here',
  })],
  tools: [tools.listKubernetesApiResources],
});

// Execute the tool through the agent
const result = await agent.executeTool('Kubernetes/listKubernetesApiResources', {});
const resources = JSON.parse(result.data.output);
console.log(resources);
```

**Tool Implementation:**

The tool is defined in `tools/listKubernetesApiResources.ts`:

```typescript
import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolJSONResult} from "@tokenring-ai/chat/schema";
import z from "zod";
import KubernetesService from "../KubernetesService.ts";

const name = "kubernetes_listKubernetesApiResources";
const displayName = "Kubernetes/listKubernetesApiResources";

async function execute(
  {},
  agent: Agent,
): Promise<TokenRingToolJSONResult<{ output: string }>> {
  const kubernetesService = agent.requireServiceByType(KubernetesService);
  const resources = await kubernetesService.listAllApiResourceTypes(agent);
  const output = JSON.stringify(resources);
  return {
    type: "json",
    data: {output}
  };
}

const description =
  "Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace.";

const inputSchema = z.object({});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
```

## Plugin Integration

The plugin is automatically installed with TokenRing applications when configured:

```typescript
import TokenRingPlugin from '@tokenring-ai/kubernetes';

const plugin = TokenRingPlugin;
```

**Plugin Properties:**

| Property | Value |
|----------|-------|
| **Name** | `@tokenring-ai/kubernetes` |
| **Version** | `0.2.0` |
| **Description** | `Kubernetes resources integration` |

**Plugin Lifecycle:**

1. **Installation**: When `install()` is called with valid configuration
2. **Configuration**: Validates using `packageConfigSchema`
3. **Service Registration**: Creates and registers `KubernetesService` with the app
4. **Tool Registration**: Registers tools via `ChatService.addTools()`
5. **Waiting**: Uses `app.waitForService()` to ensure chat service is ready

**Plugin Implementation:**

```typescript
import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {z} from "zod";
import KubernetesService from "./KubernetesService.ts";
import packageJSON from './package.json' with {type: 'json'};
import {KubernetesServiceConfigSchema} from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  kubernetes: KubernetesServiceConfigSchema.optional()
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (config.kubernetes) {
      app.waitForService(ChatService, chatService =>
        chatService.addTools(tools)
      );
      app.addServices(new KubernetesService(config.kubernetes));
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

## Usage Examples

### 1. Direct Service Usage

```typescript
import KubernetesService from '@tokenring-ai/kubernetes';

const service = new KubernetesService({
  clusterName: 'my-cluster',
  apiServerUrl: 'https://api.example.com:6443',
  namespace: 'default',
  token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
});

console.log(service.name);  // "KubernetesService"
console.log(service.description);  // "Provides Kubernetes functionality"
console.log(service.options.clusterName);  // "my-cluster"
console.log(service.options.namespace);    // "default"
```

### 2. TokenRing Agent Integration with Tools

```typescript
import { Agent } from '@tokenring-ai/agent';
import KubernetesService from '@tokenring-ai/kubernetes';
import tools from '@tokenring-ai/kubernetes/tools';

const agent = new Agent({
  services: [new KubernetesService({
    clusterName: 'my-cluster',
    apiServerUrl: 'https://api.example.com:6443',
    namespace: 'default',
    token: process.env.K8S_TOKEN,
  })],
  tools: [tools.listKubernetesApiResources],
});

// Execute the tool through the agent
const result = await agent.executeTool('Kubernetes/listKubernetesApiResources', {});
const resources = JSON.parse(result.data.output);
console.log(resources);
```

### 3. TokenRing App Plugin Configuration

```typescript
import TokenRingApp from '@tokenring-ai/app';

const app = new TokenRingApp({
  config: {
    kubernetes: {
      clusterName: 'production-cluster',
      apiServerUrl: 'https://api.production.example.com:6443',
      namespace: 'production',
      token: process.env.K8S_TOKEN,
    }
  }
});

// Plugin automatically registers service and tools
```

### 4. Certificate-Based Authentication

```typescript
const service = new KubernetesService({
  clusterName: 'secure-cluster',
  apiServerUrl: 'https://secure-api.example.com:6443',
  namespace: 'default',
  clientCertificate: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t...',
  clientKey: 'LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQo=',
  caCertificate: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t...',
});
```

### 5. Multi-Namespace Discovery

```typescript
const service = new KubernetesService({
  clusterName: 'multi-ns-cluster',
  apiServerUrl: 'https://api.example.com:6443',
  // No namespace specified - will discover all namespaces
  token: 'your-token',
});

const agent = new Agent({ services: [service] });
const resources = await service.listAllApiResourceTypes(agent);
console.log(`Found ${resources.length} resources across all namespaces`);
```

## Best Practices

### Security

- **Credential Management**: Handle credentials securely using environment variables in production
- **Token Security**: Avoid logging authentication tokens
- **Certificate Handling**: Store certificates securely and rotate regularly
- **Network Security**: Use HTTPS URLs for API server connections
- **Namespace Access**: Respect Kubernetes RBAC permissions for namespace and resource access

### Error Handling

- **Graceful Degradation**: The service handles errors gracefully and includes error information in the response
- **Namespace Discovery Fallback**: If namespace discovery fails, the service falls back to the "default" namespace
- **Resource-Specific Errors**: Individual resource listing errors are captured in the `error` field of `K8sResourceInfo`

### Performance

- **Lazy Discovery**: Resources are discovered on-demand when the tool is executed
- **Namespace Scanning**: When no namespace is specified, the service scans all available namespaces which may be resource-intensive for large clusters

### Configuration

- **Token Authentication**: Prefer token authentication over certificates for simpler credential management
- **Namespace Specification**: Specify a namespace when possible to reduce discovery time and resource usage
- **Cluster Naming**: Use descriptive cluster names to easily identify different environments

## Testing and Development

### Testing

The package uses vitest for unit testing. Run tests with:

```bash
bun run test
```

Watch mode:

```bash
bun run test:watch
```

Coverage:

```bash
bun run test:coverage
```

### Building

Type check the package:

```bash
bun run build
```

Note: Type checking only (`tsc --noEmit`) is required as this is an ES module-based package with no bundling.

### Package Structure

- **Service Layer**: `KubernetesService` handles cluster connection, configuration, and resource discovery
- **Tool Layer**: `listKubernetesApiResources` tool retrieves the service and executes listing
- **Plugin Layer**: Automatic registration with TokenRing applications via `plugin.ts`
- **Entry Point**: `index.ts` exports the service class for direct import

### Package Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "build": "tsc --noEmit",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Vitest Configuration

```typescript
import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    environment: "node",
    globals: true,
    isolate: true,
  },
});
```

## Dependencies

### Runtime Dependencies

| Package | Version | Description |
|---------|---------|-------------|
| `@tokenring-ai/app` | `0.2.0` | Base application framework |
| `@tokenring-ai/chat` | `0.2.0` | Chat service and tool definitions |
| `@tokenring-ai/agent` | `0.2.0` | Agent orchestration |
| `@kubernetes/client-node` | `^1.4.0` | Kubernetes Node.js client |
| `zod` | `^4.3.6` | Schema validation |

### Development Dependencies

| Package | Version | Description |
|---------|---------|-------------|
| `vitest` | `^4.1.0` | Testing framework |
| `typescript` | `^5.9.3` | TypeScript compiler |

### Note on Unused Dependencies

The package.json includes additional dependencies (`glob-gitignore`, `next-auth`, `react-syntax-highlighter`, `vite`) that are not currently used by the core Kubernetes functionality. These may be legacy dependencies from the monorepo setup.

## Limitations

- **Read-only Operations**: Currently focused on resource discovery and listing only
- **No CRUD Operations**: Create, update, delete operations are not yet implemented
- **No Pagination**: Large clusters may produce verbose results without pagination features
- **Authentication**: Only token and client certificate authentication supported
- **KubeConfig Support**: No Kubernetes config file load support (uses constructor parameters only)
- **Core Resource Listing**: Currently uses `CustomObjectsApi` for all resource listing, including core resources

## Integration with TokenRing

The package integrates with TokenRing through:

1. **Service Registration**: `KubernetesService` is automatically registered with TokenRing applications when configured
2. **Tool Registration**: Tools are automatically added to chat services with proper naming and display names
3. **Configuration**: Plugin validates configuration using Zod schemas before registration
4. **Lifecycle**: Service lifecycle and tool registration are managed by the plugin's `install()` function
5. **Agent Integration**: Agents request the service via `agent.requireServiceByType()` and execute tools to interact with the cluster

## State Management

This package does not implement state management or persistence.

## License

MIT License - see [LICENSE](./LICENSE) file for details.
