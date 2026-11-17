import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import KubernetesService from "../KubernetesService.ts";
import { KubernetesServiceConfigSchema } from "../schema.ts";

const coreResources = {
  kind: "APIResourceList",
  groupVersion: "v1",
  resources: [
    { name: "pods", singularName: "pod", namespaced: true, kind: "Pod", verbs: ["get", "list"] },
    { name: "pods/log", singularName: "", namespaced: true, kind: "Pod", verbs: ["get"] },
    { name: "nodes", singularName: "node", namespaced: false, kind: "Node", verbs: ["get", "list"] },
  ],
};
const list = (...names: [string, string | undefined][]) => ({
  kind: "List",
  apiVersion: "v1",
  items: names.map(([name, namespace]) => ({ metadata: { name, namespace } })),
});

/** A throwaway self-signed certificate: the client refuses plain HTTP. */
function selfSignedCertificate(): { cert: string; key: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "k8s-cert-"));
  try {
    const result = Bun.spawnSync(
      [
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        "key.pem",
        "-out",
        "cert.pem",
        "-subj",
        "/CN=127.0.0.1",
        "-addext",
        "subjectAltName=IP:127.0.0.1",
        "-days",
        "1",
      ],
      { cwd: dir, stdout: "ignore", stderr: "ignore" },
    );
    if (result.exitCode !== 0) throw new Error("openssl failed");
    return { cert: readFileSync(path.join(dir, "cert.pem"), "utf8"), key: readFileSync(path.join(dir, "key.pem"), "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A minimal Kubernetes API server: answers only the paths a correct client asks for. */
function fakeApiServer(tls: { cert: string; key: string }) {
  const requested: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1": coreResources,
    "/apis": { kind: "APIGroupList", apiVersion: "v1", groups: [] },
    "/api/v1/namespaces": list(["default", undefined], ["team", undefined]),
    "/api/v1/namespaces/default/pods": list(["web", "default"]),
    "/api/v1/namespaces/team/pods": list(["worker", "team"]),
    "/api/v1/nodes": list(["node-1", undefined]),
  };
  const server = Bun.serve({
    port: 0,
    tls,
    fetch(request) {
      const { pathname } = new URL(request.url);
      requested.push(pathname);
      const body = routes[pathname];
      return body ? Response.json(body) : Response.json({ kind: "Status", code: 404, message: `no route ${pathname}` }, { status: 404 });
    },
  });
  return { server, requested };
}

describe("KubernetesService.listAllApiResourceTypes", () => {
  let stop: (() => void) | undefined;
  afterEach(() => stop?.());

  it("lists core resources from /api/v1, namespaced ones per namespace and cluster-wide ones once", async () => {
    const tls = selfSignedCertificate();
    const { server, requested } = fakeApiServer(tls);
    stop = () => server.stop(true);
    const app = createTestingApp();
    const service = new KubernetesService(
      KubernetesServiceConfigSchema.parse({ clusterName: "test", apiServerUrl: `https://127.0.0.1:${server.port}`, token: "t", caCertificate: tls.cert }),
    );
    app.addService(KubernetesService, service);
    const agent = createTestingAgent(app);

    // The kube client's undici dispatcher ignores a custom CA under Bun, so trust the throwaway
    // certificate process-wide for this call. This test is about the request paths.
    const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    let resources: Awaited<ReturnType<KubernetesService["listAllApiResourceTypes"]>>;
    try {
      resources = await service.listAllApiResourceTypes(agent);
    } finally {
      if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
    }

    expect(resources.filter(resource => "error" in resource && resource.error)).toEqual([]);
    expect(resources.map(resource => ("name" in resource ? `${resource.kind}/${resource.namespace ?? "-"}/${resource.name}` : "")).sort()).toEqual([
      "Node/-/node-1",
      "Pod/default/web",
      "Pod/team/worker",
    ]);
    expect(requested.filter(path => path === "/api/v1/nodes")).toHaveLength(1);
    expect(requested.some(path => path.startsWith("/apis//"))).toBe(false);
  });
});
