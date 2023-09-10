import {CommandType} from "../types";
import {logger} from "@/config";
import process from "process";

import {
  CacheType,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";

const googleModule: CommandType = {
  data: new SlashCommandBuilder()
    .setName("google")
    .setDescription("Google something and return the top 10 results.")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("What you want to google.")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("to")
        .setDescription("The user you want to direct this to.")
    ),
  execute: async (interaction: ChatInputCommandInteraction<CacheType>) => {
    const query = interaction.options.getString("query");
    const toWhom = interaction.options.getUser("to");
    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setAuthor({
        name: `Requested by ${interaction.user.displayName}`,
        iconURL: `${interaction.user?.avatarURL()}`,
      })
      .setTimestamp();

    const search_key = process.env.GOOGLE_SEARCH_API_KEY;
    const search_id = process.env.GOOGLE_SEARCH_ID;
    const url = `https://www.googleapis.com/customsearch/v1?key=${search_key}&cx=${search_id}&q=${query}`;

    let links: string[] = [];

    await fetch(url, {
      method: "GET",
      headers: {Accept: "*/*"},
    })
      .then((response) => {
        if (!response.ok) {
          logger.info("No response.");
          interaction.reply({
            content: "Unable to return any queries.",
            ephemeral: true,
          });
        }

        return response.json();
      })
      .then((data) => {
        let i: number = 0;
        data.items.forEach((element: any) => {
          links.push(`${++i}. [${element.title}](${element.link})`);
        });
      });

    embed.setDescription(`**Query: ${query}**\n${links.join("\n")}`);

    if (!toWhom) {
      interaction.reply({embeds: [embed]});
    } else {
      interaction.reply({content: `${toWhom}`, embeds: [embed]});
    }
  },
};

export {googleModule as command};
