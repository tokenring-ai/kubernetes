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