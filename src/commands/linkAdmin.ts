import {logger, prisma} from "@/config";
import {
  inlineCode,
  SlashCommandBuilder,
  SlashCommandStringOption,
  type CacheType,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  Colors,
} from "discord.js";
import type {Link} from "@prisma/client";
import {createEmbed, handleEmbedResponse, standardizeLinkName} from "@/helpers";

const linkAdminModule: CommandType = {
  data: new SlashCommandBuilder()
    .setName("link-admin")
    .setDescription("Manage the links")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Add a new link")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("What is the name of the link?")
            .setMaxLength(20)
            .setMinLength(3)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("What's this link for?")
            .setMaxLength(100)
            .setMinLength(3)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("url")
            .setDescription("What is the url of the link?")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete a link")
        .addStringOption((option: SlashCommandStringOption) =>
          option
            .setName("link")
            .setDescription("Select a link to delete")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  execute: async (interaction: ChatInputCommandInteraction<CacheType>) => {
    try {
      if (!interaction.isCommand()) return;
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "create") {
        const name = interaction.options.getString("name", true);
        const description = interaction.options.getString("description", true);
        const url = interaction.options.getString("url", true);

        const asciiRegex = new RegExp(/^[\x00-\x7F]*$/);
        if (!asciiRegex.test(name)) {
          return await handleEmbedResponse(interaction, true, {
            message: `**${name}** is not a valid name, please use only ASCII characters.`,
          });
        }

        const id = standardizeLinkName(name);

        //check if the link already exists in the database
        const link = await prisma.link.findUnique({
          where: {
            id,
          },
        });

        // check if the link already exists
        if (link !== null) {
          return await handleEmbedResponse(interaction, true, {
            message: `${inlineCode(
              name
            )} already exists, please try another name.`,
          });
        }

        //URL validation
        const urlRegex = new RegExp(
          /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/
        );
        if (!urlRegex.test(url)) {
          return await handleEmbedResponse(interaction, true, {
            message: `${inlineCode(
              url
            )} is not a valid URL, please make sure it starts with http:// or https:// and ends with a domain.`,
          });
        }

        //create the link
        const createdLink = await prisma.link.create({
          data: {
            id,
            name,
            description,
            url,
            authorID: interaction.user.id,
            authorUsername: interaction.user.username,
            authorDisplayName: interaction.user.displayName,
          },
        });

        //check if the link was created successfully
        if (createdLink === undefined) {
          return await handleEmbedResponse(interaction, true, {
            message: `**${name}** could not be created, please try again.`,
          });
        }

        //send the response
        return await handleEmbedResponse(interaction, false, {
          message: `Link ${inlineCode(name)} created successfully.`,
          ephemeral: false,
        });
      } else if (subcommand === "delete") {
        const searchString = interaction.options.getString("link", true);
        const id = standardizeLinkName(searchString);

        //Get the link
        const link = await prisma.link.findUnique({
          where: {
            id,
          },
        });

        //check if the link exists
        if (link === undefined || link === null) {
          return await handleEmbedResponse(interaction, true, {
            message: "I couldn't find that link, please try another one.",
          });
        }

        const deleteBtn = new ButtonBuilder()
          .setCustomId("delete")
          .setLabel("Delete")
          .setStyle(ButtonStyle.Danger);

        const cancelBtn = new ButtonBuilder()
          .setCustomId("cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary);

        const response = await interaction.reply({
          embeds: [
            createEmbed(
              ":bangbang: Confirm Deletion",
              `Are you sure you want to delete the following link?\n
              **name:** ${link.name}\n
              **description:** ${link.description}\n
              **url:** ${inlineCode(link.url)}\n
            `,
              Colors.Red
            ),
          ],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              cancelBtn,
              deleteBtn
            ),
          ],
        });

        const buttonFilter = (i: any) => {
          if (i.user.id !== interaction.user.id) {
            i.reply({
              content: "You are not allowed to interact with this message!",
              ephemeral: true,
            });
            return false;
          }
          return true;
        };

        try {
          const confirmation = await response.awaitMessageComponent({
            filter: buttonFilter,
            time: 30000,
          });

          if (confirmation.customId === "delete") {
            await prisma.link.delete({
              where: {
                id,
              },
            });
            await confirmation.update({
              embeds: [
                createEmbed(
                  ":white_check_mark: Link Deleted",
                  `Link **${searchString}** was deleted successfully.`,
                  Colors.Green
                ),
              ],
              components: [],
            });
          } else if (confirmation.customId === "cancel") {
            await confirmation.update({
              embeds: [
                createEmbed(
                  "Deletion Cancelled",
                  `Link **${searchString}** was not deleted.`,
                  Colors.Grey
                ),
              ],
              components: [],
            });
          }
        } catch (e) {
          await interaction.editReply({
            embeds: [
              createEmbed(
                ":x: Deletion Cancelled",
                "Confirmation not received within 30 seconds, cancelling.",
                Colors.Red
              ),
            ],
            components: [],
          });
        }
      }
    } catch (error: any) {
      // Don't log if the message is not being found due to being deleted
      if (error.code === 10008) return;
      logger.error(`Link command failed: ${error}`);
    }
  },
  autoComplete: async (interaction: AutocompleteInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "delete") {
      const searchString =
        interaction.options.getString("link", true).toLowerCase() ?? "";

      let res: Link[];
      if (searchString.length == 0) {
        res = await prisma.link.findMany();
      } else {
        res = await prisma.link.findMany({
          where: {
            name: {
              contains: searchString,
            },
          },
        });
      }
      interaction.respond(
        res.map((link) => ({
          name: link.name,
          value: link.name,
        }))
      );
    }
  },
};

export {linkAdminModule as command};
