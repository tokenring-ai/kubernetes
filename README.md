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

This package uses the official Kubernetes Node.js client library (@kubernetes/client-node) to connect to clusters via API server URLs, tokens, or certificates.

## Installation/Setup

This package is part of the TokenRing AI monorepo. To use it:

1. Ensure your project has Node.js (v18+) installed
2. The package is automatically available in the TokenRing ecosystem
3. Configure Kubernetes access through the plugin configuration

For standalone usage:
```bash
bun install @tokenring-ai/kubernetes
```

## Package Structure

```
pkg/kubernetes/
├── index.ts                          # Entry point
├── KubernetesService.ts              # Core service implementation
├── tools.ts                          # Tool exports
├── tools/
│   └── listKubernetesApiResources.ts # Resource listing tool
├── plugin.ts                         # TokenRing plugin integration
├── vitest.config.ts                  # Vitest configuration
├── test/
│   └── listKubernetesApiResources.test.js # Unit tests
├── LICENSE                           # MIT License
├── package.json                      # Package metadata and dependencies
└── README.md                         # This documentation
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
const schema = z.object({
  kubernetes: z.object({
    clusterName: z.string(),
    apiServerUrl: z.string(),
    namespace: z.string().optional(),
    token: z.string().optional(),
    clientCertificate: z.string().optional(),
    clientKey: z.string().optional(),
    caCertificate: z.string().optional(),
  }).optional()
});
```

## Tools

This package provides the following tools for agent interaction with Kubernetes clusters:

### listKubernetesApiResources

Lists all instances of all accessible API resource types in the configured Kubernetes cluster.

**Tool Definition:**
- **Name:** `kubernetes_listKubernetesApiResources` (internal name)
- **Public Name:** `kubernetes/listKubernetesApiResources` (when registered)
- **Input Schema:** `z.object({})` (no inputs required)
- **Description:** "Lists all instances of all accessible API resource types in the configured Kubernetes cluster. Fetches resources from all discoverable namespaces if the service is configured to do so, or from the default/specified namespace."

**Usage:**

```typescript
import { Agent } from '@tokenring-ai/agent';
import KubernetesService from '@tokenring-ai/kubernetes';
import listKubernetesApiResources from '@tokenring-ai/kubernetes/tools/listKubernetesApiResources';

const agent = new Agent({
  services: [new KubernetesService({
    clusterName: 'my-cluster',
    apiServerUrl: 'https://api.example.com:6443',
    namespace: 'default',
    token: 'your-token-here',
  })],
  tools: [listKubernetesApiResources],
});

// Execute the tool through the agent
const result = await agent.executeTool('kubernetes/listKubernetesApiResources', {});
const resources = JSON.parse(result.output);
console.log(resources);
```

## Services

### KubernetesService

The main service class implementing `TokenRingService` for Kubernetes integration.

```typescript
class KubernetesService implements TokenRingService {
  name: string = "KubernetesService";
  description: string = "Provides Kubernetes functionality";
}
```

#### Constructor

```typescript
constructor(params: KubernetesServiceParams)
```

**Parameters:**
- `clusterName: string` (required): Name of the cluster
- `apiServerUrl: string` (required): Kubernetes API server URL (e.g., "https://localhost:6443")
- `namespace?: string`: Target namespace (defaults to "default")
- `token?: string`: Bearer token for authentication
- `clientCertificate?: string`: Client certificate (PEM/Base64)
- `clientKey?: string`: Client private key (PEM/Base64)
- `caCertificate?: string`: CA certificate for server verification

**Throws:** Error if `clusterName` or `apiServerUrl` are missing

#### Key Methods

**Getters:**
- `getClusterName(): string` - Returns cluster name
- `getApiServerUrl(): string` - Returns API server URL
- `getNamespace(): string` - Returns target namespace
- `getToken(): string | undefined` - Returns authentication token
- `getClientCertificate(): string | undefined` - Returns client certificate
- `getClientKey(): string | undefined` - Returns client private key
- `getCaCertificate(): string | undefined` - Returns CA certificate

**Core Method:**
- `listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]>` - Discovers and lists all API resources

**Response Format:**
```typescript
interface K8sResourceInfo {
  group?: string;      // API group (e.g., "apps" or "" for core)
  version?: string;    // API version (e.g., "v1")
  kind?: string;       // Resource kind (e.g., "Pod")
  namespace?: string;  // Namespace for namespaced resources
  name?: string;       // Resource name
  error?: string;      // Error message if listing failed
}
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
```

### 2. TokenRing Agent Integration

```typescript
import { Agent } from '@tokenring-ai/agent';
import KubernetesService from '@tokenring-ai/kubernetes';
import listKubernetesApiResources from '@tokenring-ai/kubernetes/tools/listKubernetesApiResources';

const agent = new Agent({
  services: [new KubernetesService({
    clusterName: 'my-cluster',
    apiServerUrl: 'https://api.example.com:6443',
    namespace: 'default',
    token: 'your-token-here',
  })],
  tools: [listKubernetesApiResources],
});

// Execute the tool through the agent
const result = await agent.executeTool('kubernetes/listKubernetesApiResources', {});
const resources = JSON.parse(result.output);
console.log(resources);
```

### 3. Plugin Configuration (TokenRing App)

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
const schema = z.object({
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

- **clusterName**: Unique identifier for the cluster
- **apiServerUrl**: Full URL to the Kubernetes API server
- **namespace**: Target namespace (optional - defaults to "default", discovers all if not specified)
- **token**: Bearer token for authentication (preferred over certificates)
- **clientCertificate**: Client certificate in PEM format
- **clientKey**: Client private key in PEM format
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
- **Fallback**: If namespace discovery fails, defaults to "default" namespace

## API Reference

### KubernetesService

```typescript
class KubernetesService implements TokenRingService {
  name: string = "KubernetesService";
  description: string = "Provides Kubernetes functionality";
  
  constructor(params: KubernetesServiceParams)
  
  // Getters
  getClusterName(): string
  getApiServerUrl(): string
  getNamespace(): string
  getToken(): string | undefined
  getClientCertificate(): string | undefined
  getClientKey(): string | undefined
  getCaCertificate(): string | undefined
  
  // Core method
  listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]>
}
```

### Tools

```typescript
const listKubernetesApiResources = {
  name: "kubernetes_listKubernetesApiResources", // internal name
  description: string,
  inputSchema: z.object({}),
  execute: ({}: {}, agent: Agent) => Promise<{ output: string }>
};
```

### Plugin Integration

```typescript
const kubernetesPlugin = {
  name: "@tokenring-ai/kubernetes",
  version: "0.2.0",
  description: "Kubernetes resources integration",
  install: (app: TokenRingApp) => void
};
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

## Development

### Testing

Run tests with:
```bash
bun run test
```

Tests cover:
- Tool execution functionality
- Service method calls
- Error handling scenarios
- Registry integration

### Building

No build step required - uses ES modules (type: "module").

### Code Structure

- **Service Layer**: `KubernetesService` handles cluster connection and resource discovery
- **Tool Layer**: `listKubernetesApiResources` provides agent-accessible tooling
- **Plugin Layer**: Automatic registration with TokenRing applications
- **Test Layer**: Comprehensive unit tests for all functionality

## Limitations

- **Read-only Operations**: Currently focused on resource discovery and listing
- **No CRUD Operations**: Create, update, delete operations not yet implemented
- **Pagination**: Large clusters may produce verbose results (no pagination implemented)
- **Authentication**: Only token and client certificate authentication supported
- **Error Handling**: Resource-specific errors are captured in individual `K8sResourceInfo.error` fields

## Security Considerations

- **Credential Management**: Handle credentials securely (use environment variables in production)
- **Token Security**: Avoid logging authentication tokens
- **Certificate Handling**: Store certificates securely and rotate regularly
- **Network Security**: Use HTTPS URLs for API server connections
- **Namespace Access**: Respect Kubernetes RBAC permissions for namespace and resource access

## Integration with TokenRing

The package integrates with TokenRing through:

1. **Service Registration**: `KubernetesService` automatically registers with TokenRing applications
2. **Tool Registration**: Tools are automatically added to chat services
3. **Configuration**: Plugin validates configuration using Zod schemas
4. **Lifecycle**: Service lifecycle managed by TokenRing application framework

## Contributing

- Follow TypeScript best practices
- Add comprehensive tests for new features
- Update documentation alongside code changes
- Maintain compatibility with TokenRing plugin architecture
- Use semantic versioning for releases

## License

MIT License - see [LICENSE](./LICENSE) file for details.
