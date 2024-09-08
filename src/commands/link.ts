import {logger, prisma} from "@/config";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandStringOption,
  type CacheType,
  AutocompleteInteraction,
  inlineCode,
  Colors,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  ButtonInteraction,
} from "discord.js";
import type {Link} from "@prisma/client";
import {handleEmbedResponse, standardizeLinkName} from "@/helpers";

const linkModule: CommandType = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Get a link")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("get")
        .setDescription("Get a link")
        .addStringOption((option: SlashCommandStringOption) =>
          option
            .setName("link")
            .setDescription("Select a link to get")
            .setRequired(true)
            .setMaxLength(20)
            .setMinLength(3)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all links")
        .addIntegerOption((option) =>
          option
            .setName("page")
            .setDescription("Which page of links would you like to see?")
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false)
        )
    ),
  execute: async (interaction: ChatInputCommandInteraction<CacheType>) => {
    try {
      const subCommand = interaction.options.getSubcommand(true);

      if (subCommand === "get") {
        const choice = interaction.options.getString("link", true);
        const id = standardizeLinkName(choice);
        const res = await prisma.link.findFirst({
          where: {
            id: {
              contains: id,
            }
          },
        });
        if (res) {
          await interaction.reply({
            content: res.url,
          });
        } else {
          return await handleEmbedResponse(interaction, true, {
            message: `I couldn't find a link with the name ${inlineCode(
              choice
            )}. Please try again.`,
          });
        }
      } else if (subCommand === "list") {
        const n = await prisma.link.count();
        if (n == 0)
          return await handleEmbedResponse(interaction, true, {
            message: "There are no links yet.",
          });

        const linksPerPage = 5;
        const pages = Math.ceil(n / linksPerPage);
        let page = interaction.options.getInteger("page") ?? 1;

        if (page < 1 || page > pages)
          return await handleEmbedResponse(interaction, true, {
            message: `Invalid page number. Please enter a number between 1 and ${pages}.`,
          });

        let pageContent = await prisma.link.findMany({
          skip: (page - 1) * linksPerPage,
          take: linksPerPage,
        });

        const backId = "back";
        const forwardId = "forward";
        const backButton = new ButtonBuilder({
          style: ButtonStyle.Secondary,
          label: "Back",
          emoji: "⬅️",
          customId: backId,
        });
        const forwardButton = new ButtonBuilder({
          style: ButtonStyle.Secondary,
          label: "Forward",
          emoji: "➡️",
          customId: forwardId,
        });

        const handleButtonsUpdate = () => {
          backButton.setDisabled(page === 1);
          forwardButton.setDisabled(page === pages);
        };

        const linkListEmbed = () => {
          return new EmbedBuilder()
            .setTitle(":link: Links List")
            .setTimestamp()
            .addFields(
              pageContent.map((link, i) => ({
                name: `${(page - 1) * linksPerPage + i + 1}. ${link.name}`,
                value: `► [Link](${link.url})\n**description**: ${link.description}\n‎ `,
              }))
            )
            .setColor(Colors.Blue)
            .setFooter({
              text: `Page ${page} of ${pages}`,
            });
        };

        const row = new ActionRowBuilder<ButtonBuilder>().setComponents([
          backButton,
          forwardButton,
        ]);

        handleButtonsUpdate();
        const response = await interaction.reply({
          embeds: [linkListEmbed()],
          components: [row],
        });

        const buttonFilter = (i: ButtonInteraction) => {
          if (i.user.id !== interaction.user.id) {
            i.reply({
              content: "You are not allowed to interact with this message!",
              ephemeral: true,
            });
            return false;
          }
          return true;
        };

        const collector = response.createMessageComponentCollector({
          filter: buttonFilter,
          componentType: ComponentType.Button,
          time: 120000,
        });
        collector.on("collect", async (i) => {
          i.customId === backId ? (page -= 1) : (page += 1);
          pageContent = await prisma.link.findMany({
            skip: (page - 1) * linksPerPage,
            take: linksPerPage,
          });
          handleButtonsUpdate();
          await i.update({
            embeds: [linkListEmbed()],
            components: [row],
          });
        });

        collector.once("end", async () => {
          try {
            await response.edit({
              embeds: [linkListEmbed()],
              components: [],
            });
          } catch (error) {}
        });
      }
    } catch (error) {
      logger.error(`Link command failed: ${error}`);
    }
  },
  autoComplete: async (interaction: AutocompleteInteraction) => {
    let searchString = interaction.options.getString("link", true).toLowerCase() ?? "";
    let res: Link[];
    if (searchString.length == 0) {
      res = await prisma.link.findMany({
        take: 25,
      });
    } else {
      res = await prisma.link.findMany({
        where: {
          name: {
            contains: searchString
          },
        },
        take: 25,
      });
    }
    interaction.respond(
      res.map((link) => ({
        name: link.name,
        value: link.name,
      }))
    );
  },
};

export {linkModule as command};
