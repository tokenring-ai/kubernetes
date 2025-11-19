import {AgentTeam, TokenRingPackage} from "@tokenring-ai/agent";
import {ChatService} from "@tokenring-ai/chat";
import KubernetesService, {KubernetesServiceParamsSchema} from "./KubernetesService.ts";
import packageJSON from './package.json' with {type: 'json'};
import * as tools from "./tools.ts";

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(agentTeam: AgentTeam) {
    const config = agentTeam.getConfigSlice('kubernetes', KubernetesServiceParamsSchema.optional());
    if (config) {
      agentTeam.waitForService(ChatService, chatService =>
        chatService.addTools(packageJSON.name, tools)
      );
      agentTeam.addServices(new KubernetesService(config));
    }
  }
} as TokenRingPackage;

export {default as KubernetesService} from "./KubernetesService.ts";
