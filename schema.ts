import z from "zod";

export const KubernetesServiceConfigSchema = z.object({
  clusterName: z.string(),
  apiServerUrl: z.string(),
  namespace: z.string().default("default"),
  token: z.string().exactOptional(),
  clientCertificate: z.string().exactOptional(),
  clientKey: z.string().exactOptional(),
  caCertificate: z.string().exactOptional(),
});
export type ParsedKubernetesServiceConfig = z.output<typeof KubernetesServiceConfigSchema>;
