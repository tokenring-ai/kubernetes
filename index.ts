import {AgentTeam, TokenRingPackage} from "@tokenring-ai/agent";
import KubernetesService, {KubernetesServiceParamsSchema} from "./KubernetesService.ts";
import packageJSON from './package.json' with {type: 'json'};
import * as tools from "./tools.ts";

export const packageInfo: TokenRingPackage = {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(agentTeam: AgentTeam) {
    const config = agentTeam.getConfigSlice('kubernetes', KubernetesServiceParamsSchema.optional());
    if (config) {
      agentTeam.addTools(packageInfo, tools);
      agentTeam.addServices(new KubernetesService(config));
    }
  }
};

export {default as KubernetesService} from "./KubernetesService.ts";
