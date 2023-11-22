import {logger} from "@/config";
import {initMathJax} from "@/helpers/LatexHelpers";
import {Client, Events} from "discord.js";

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    if (!client.user || !client.application) {
      return;
    }

    await initMathJax();
    client.user.setActivity({
      name: "status",
      type: 4,
      state: ":lock: locked in",
    });
    client.user.setStatus("dnd");
    logger.info(`${client.user.username} is online.`);
  },
};
