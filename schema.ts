import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import z from "zod";

export const KubernetesServiceConfigSchema = z
  .object({
    clusterName: z.string().meta({ description: "Name of the Kubernetes cluster" } satisfies ConfigFieldMeta),
    apiServerUrl: z.string().meta({ restartRequired: true, description: "Kubernetes API server URL" } satisfies ConfigFieldMeta),
    namespace: z
      .string()
      .default("default")
      .meta({ description: "Default namespace for cluster operations" } satisfies ConfigFieldMeta),
    token: z
      .string()
      .exactOptional()
      .meta({ sensitive: true, description: "Service account bearer token" } satisfies ConfigFieldMeta),
    clientCertificate: z
      .string()
      .exactOptional()
      .meta({ description: "Client certificate (PEM)", uiType: "multilineText" } satisfies ConfigFieldMeta),
    clientKey: z
      .string()
      .exactOptional()
      .meta({ sensitive: true, description: "Client private key (PEM)" } satisfies ConfigFieldMeta),
    caCertificate: z
      .string()
      .exactOptional()
      .meta({ description: "Cluster CA certificate (PEM)", uiType: "multilineText" } satisfies ConfigFieldMeta),
  })
  .meta({ label: "Kubernetes", description: "Kubernetes cluster connection settings" } satisfies ConfigFieldMeta);
export type ParsedKubernetesServiceConfig = z.output<typeof KubernetesServiceConfigSchema>;
