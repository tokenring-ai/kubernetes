# @tokenring-ai/kubernetes

Kubernetes integration for TokenRing AI agents, enabling AI agents to discover and interact with Kubernetes clusters by listing all accessible API resources, including core and custom resources across namespaces.

## Overview

The `@tokenring-ai/kubernetes` package provides comprehensive Kubernetes cluster integration for TokenRing AI agents. It enables agents to discover and interact with Kubernetes clusters by listing all accessible API resources, including core and custom resources across namespaces. This package is designed to work within the TokenRing AI framework, allowing agents to query cluster state without direct kubectl access.

Key features:
- **Resource Discovery**: Lists all accessible API resources across core and custom resource groups
- **Multi-Namespace Support**: Discovers resources across all namespaces or specified namespace
- **Authentication Support**: Token-based and client certificate authentication
- **Plugin Integration**: Automatic integration with TokenRing applications
- **Error Handling**: Graceful error handling with detailed error messages
- **Service Architecture**: Built on TokenRing service architecture for seamless agent integration

This package uses the official Kubernetes Node.js client library (`@kubernetes/client-node`) to connect to clusters via API server URLs, tokens, or certificates.

## Installation/Setup

This package is part of the TokenRing AI monorepo. To use it:

1. Ensure your project has Node.js (v18+) installed
2. The package is available as a dependency
3. Configure Kubernetes access through the plugin configuration

For standalone usage:
```bash
bun install @tokenring-ai/kubernetes
```

## Package Structure

```
pkg/kubernetes/
├── index.ts                      # Entry point - exports KubernetesService
├── KubernetesService.ts          # Core service implementation
├── plugin.ts                     # TokenRing plugin integration
├── tools.ts                      # Tool exports
├── tools/
│   └── listKubernetesApiResources.ts # Resource listing tool
├── vitest.config.ts              # Vitest configuration
├── package.json                  # Package metadata and dependencies
└── README.md                     # This documentation
```

## Chat Commands

This package does not define chat commands. Instead, it provides tools that can be used by agents to interact with Kubernetes clusters.

## Plugin Configuration

The plugin accepts configuration through the `kubernetes` key in your application config.

```typescript
import TokenRingApp from '@tokenring-ai/app';

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
```

### Configuration Schema

```typescript
import {KubernetesServiceParamsSchema} from '@tokenring-ai/kubernetes';

const schema = z.object({
  kubernetes: KubernetesServiceParamsSchema.optional()
});
```

## Tools

This package provides the following tool for agent interaction with Kubernetes clusters:

### Kubernetes/listKubernetesApiResources

Lists all instances of all accessible API resource types in the configured Kubernetes cluster.

**Tool Definition:**
- **Internal Name:** `kubernetes_listKubernetesApiResources`
- **Display Name:** `Kubernetes/listKubernetesApiResources`
- **Input Schema:** `z.object({})` (no inputs required)
- **Description:** "Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace."

**Tool Execution:**

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
const resources = JSON.parse(result.output);
console.log(resources);
```

**Service Side Tool Executer:**

The tool retrieves the KubernetesService from the agent's service registry and calls `listAllApiResourceTypes()` method:

```typescript
import { Agent } from '@tokenring-ai/agent';
import { TokenRingToolDefinition } from '@tokenring-ai/chat/schema';
import KubernetesService from './KubernetesService.ts';

async function execute(
  {}: any,
  agent: Agent,
): Promise<{ output: string }> {
  const kubernetesService = agent.requireServiceByType(KubernetesService);
  const resources = await kubernetesService.listAllApiResourceTypes(agent);
  const output = JSON.stringify(resources);
  return {output};
}

export default {
  name: 'kubernetes_listKubernetesApiResources',
  displayName: 'Kubernetes/listKubernetesApiResources',
  description: 'Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace.',
  inputSchema: z.object({}),
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
```

## Services

### KubernetesService

The main service class implementing `TokenRingService` for Kubernetes integration.

```typescript
import KubernetesService from '@tokenring-ai/kubernetes';

const service = new KubernetesService({
  clusterName: 'my-cluster',
  apiServerUrl: 'https://api.example.com:6443',
  namespace: 'production',
  token: process.env.K8S_TOKEN,
});
```

#### Constructor Parameters

**KubernetesServiceParams Schema:**
```typescript
{
  clusterName: string;        // Required: Name of the cluster
  apiServerUrl: string;       // Required: Kubernetes API server URL (e.g., "https://localhost:6443")
  namespace?: string;         // Optional: Target namespace (defaults to "default")
  token?: string;             // Optional: Bearer token for authentication
  clientCertificate?: string; // Optional: Client certificate (PEM/Base64)
  clientKey?: string;         // Optional: Client private key (PEM/Base64)
  caCertificate?: string;     // Optional: CA certificate for server verification
}
```

**Constructor Throws:**
- `Error` if `clusterName` is missing
- `Error` if `apiServerUrl` is missing

#### Properties

**Read-only properties:**
- `clusterName: string` - Returns cluster name
- `apiServerUrl: string` - Returns API server URL
- `namespace: string` (readonly) - Returns target namespace (defaults to "default")
- `token: string | undefined` - Returns authentication token
- `clientCertificate: string | undefined` - Returns client certificate
- `clientKey: string | undefined` - Returns client private key
- `caCertificate: string | undefined` - Returns CA certificate

#### Key Methods

**Core Methods:**

- `listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]>`
  - Discovers and lists all API resources in the cluster
  - Scans core resources (v1 API group) and custom resources
  - Handles multiple namespaces based on configuration
  - Returns a promise resolving to an array of resource information

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

**Method Parameters:**
- `agent: Agent` - The agent instance (required for service registry access)

#### Usage Example

```typescript
import KubernetesService from '@tokenring-ai/kubernetes';

const service = new KubernetesService({
  clusterName: 'monitoring-cluster',
  apiServerUrl: 'https://api.monitoring.internal:6443',
  namespace: 'monitoring',
});

console.log(service.getClusterName());  // "monitoring-cluster"
console.log(service.getNamespace());    // "monitoring"
```

## Providers

This package does not define providers.

## RPC Endpoints

This package does not define RPC endpoints.

## State Management

This package does not implement state management or persistence.

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

console.log(service.getClusterName());  // "my-cluster"
console.log(service.getNamespace());    // "default"
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
const resources = JSON.parse(result.output);
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

## Configuration Options

### KubernetesServiceParams Schema

```typescript
import {KubernetesServiceParamsSchema} from '@tokenring-ai/kubernetes';

const schema = KubernetesServiceParamsSchema;
```

The schema is defined as:
```typescript
z.object({
  clusterName: z.string(),
  apiServerUrl: z.string(),
  namespace: z.string().optional(),
  token: z.string().optional(),
  clientCertificate: z.string().optional(),
  clientKey: z.string().optional(),
  caCertificate: z.string().optional(),
});
```

### Configuration Options

- **clusterName**: Unique identifier for the cluster (required)
- **apiServerUrl**: Full URL to the Kubernetes API server (required)
- **namespace**: Target namespace (optional - defaults to "default", discovers all if not specified)
- **token**: Bearer token for authentication (optional, preferred over certificates)
- **clientCertificate**: Client certificate in PEM format (optional)
- **clientKey**: Client private key in PEM format (optional)
- **caCertificate**: CA certificate for server verification (optional)

### Authentication Methods

1. **Token Authentication** (Recommended):
   ```typescript
   {
     clusterName: 'cluster',
     apiServerUrl: 'https://api.example.com:6443',
     token: 'your-bearer-token',
   }
   ```

2. **Certificate Authentication**:
   ```typescript
   {
     clusterName: 'cluster',
     apiServerUrl: 'https://api.example.com:6443',
     clientCertificate: 'cert-data',
     clientKey: 'key-data',
     caCertificate: 'ca-cert-data', // optional
   }
   ```

### Namespace Handling

- **Specified namespace**: Service scans only the specified namespace
- **No namespace**: Service attempts to discover all namespaces using `CoreV1Api.listNamespace()`
- **Fallback**: If namespace discovery fails or returns no namespaces, defaults to "default" namespace

## API Reference

### KubernetesService

```typescript
class KubernetesService implements TokenRingService {
  name: string = "KubernetesService";
  description: string = "Provides Kubernetes functionality";

  constructor(params: KubernetesServiceParams)

  // Properties
  readonly clusterName: string
  readonly apiServerUrl: string
  readonly namespace: string
  token: string | undefined
  clientCertificate: string | undefined
  clientKey: string | undefined
  caCertificate: string | undefined

  // Methods
  listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]>
}
```

### Tool Definition

```typescript
interface ToolDefinition {
  name: string;           // Internal tool name: "kubernetes_listKubernetesApiResources"
  displayName: string;    // Display name: "Kubernetes/listKubernetesApiResources"
  description: string;    // Tool description
  inputSchema: z.ZodType; // Input validation schema
  execute: (input: any, agent: Agent) => Promise<{ output: string }>;
}
```

### Interfaces

```typescript
interface KubernetesServiceParams {
  clusterName: string;
  apiServerUrl: string;
  namespace?: string;
  token?: string;
  clientCertificate?: string;
  clientKey?: string;
  caCertificate?: string;
}

interface K8sResourceInfo {
  group?: string;
  version?: string;
  kind?: string;
  namespace?: string;
  name?: string;
  error?: string;
}
```

## Plugin Integration

The plugin is automatically installed with TokenRing applications when configured:

```typescript
import TokenRingPlugin from '@tokenring-ai/kubernetes';

const plugin = TokenRingPlugin;

// Plugin manages:
// 1. Service registration with TokenRing applications
// 2. Tool registration with chat services
// 3. Configuration validation using Zod
// 4. Service lifecycle management
```

Plugin lifecycle:
- **Installation**: When `install()` is called with valid configuration
- **Configuration**: Validates using `packageConfigSchema`
- **Service Registration**: Creates and registers `KubernetesService` with the app
- **Tool Registration**: Registers tools via `ChatService.addTools()`
- **Waiting**: Uses `app.waitForService()` to ensure chat service is ready

## Development

### Testing

The package uses vitest for unit testing. Run tests with:

```bash
bun run test
```

### Building

Type check the package:

```bash
bun run build
```

Note: Type checking only (`tsc --noEmit`) is required as this is an ES module-based package with no bundling.

### Code Structure

- **Service Layer**: `KubernetesService` handles cluster connection, configuration, and resource discovery
- **Tool Layer**: `listKubernetesApiResources` tool retrieves the service and executes listing
- **Plugin Layer**: Automatic registration with TokenRing applications via `plugin.ts`
- **Entry Point**: `index.ts` exports the service class for direct import

### Package Dependencies

**Production Dependencies:**
- `@tokenring-ai/app`: TokenRing service and plugin framework
- `@tokenring-ai/agent`: Agent orchestration
- `@tokenring-ai/chat`: Chat service and tool definitions
- `@kubernetes/client-node`: Official Kubernetes Node.js client
- `next-auth`: Authentication framework
- `react-syntax-highlighter`: Code syntax highlighting
- `glob-gitignore`: Git ignore pattern matching
- `zod`: Schema validation

**Development Dependencies:**
- `vitest`: Unit testing framework
- `typescript`: TypeScript compiler

## Limitations

- **Read-only Operations**: Currently focused on resource discovery and listing
- **No CRUD Operations**: Create, update, delete operations not yet implemented
- **Pagination**: Large clusters may produce verbose results (no pagination features)
- **Authentication**: Only token and client certificate authentication supported
- **Error Handling**: Resource-specific errors are captured in individual `K8sResourceInfo.error` fields
- **KubeConfig Support**: No Kubernetes config file load support (uses constructor parameters only)

## Security Considerations

- **Credential Management**: Handle credentials securely (use environment variables in production)
- **Token Security**: Avoid logging authentication tokens
- **Certificate Handling**: Store certificates securely and rotate regularly
- **Network Security**: Use HTTPS URLs for API server connections
- **Namespace Access**: Respect Kubernetes RBAC permissions for namespace and resource access

## Integration with TokenRing

The package integrates with TokenRing through:

1. **Service Registration**: `KubernetesService` is automatically registered with TokenRing applications when configured
2. **Tool Registration**: Tools are automatically added to chat services with proper naming and display names
3. **Configuration**: Plugin validates configuration using Zod schemas before registration
4. **Lifecycle**: Service lifecycle and tool registration are managed by the plugin's `install()` function
5. **Agent Integration**: Agents request the service via `agent.requireServiceByType()` and execute tools to interact with the cluster

## Dependencies

**Runtime Dependencies:**
- `@tokenring-ai/app` (0.2.0)
- `@tokenring-ai/agent` (0.2.0)
- `@tokenring-ai/chat` (0.2.0)
- `@kubernetes/client-node` (^1.4.0)
- `next-auth` (^4.24.13)
- `react-syntax-highlighter` (^16.1.0)
- `glob-gitignore` (^1.0.15)
- `zod` (catalog)

**Development Dependencies:**
- `vitest` (catalog)
- `typescript` (catalog)

## License

MIT License - see [LICENSE](./LICENSE) file for details.
