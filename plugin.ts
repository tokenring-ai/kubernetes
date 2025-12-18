import TokenRingApp from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {TokenRingPlugin} from "@tokenring-ai/app";
import KubernetesService, {KubernetesServiceParamsSchema} from "./KubernetesService.ts";
import packageJSON from './package.json' with {type: 'json'};
import tools from "./tools.ts";


export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app: TokenRingApp) {
    const config = app.getConfigSlice('kubernetes', KubernetesServiceParamsSchema.optional());
    if (config) {
      app.waitForService(ChatService, chatService =>
        chatService.addTools(packageJSON.name, tools)
      );
      app.addServices(new KubernetesService(config));
    }
  }
} satisfies TokenRingPlugin;
