import { logger, Config } from "@/config";
import { readFile } from 'fs';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "@discordjs/builders";

import {
  CacheType,
  SlashCommandBuilder,
  GuildMember,
  ChatInputCommandInteraction,
  Message,
  Colors,
  ComponentType,
  Collection,
} from "discord.js";

// game config
const WORDBOMB_TURN_TIME = 10_000 // in ms
const JOIN_TIME = 8_000
const REQUIRED_PLAYERS = 2

// hello

function validateWord(word: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        readFile("data/words.txt", (error, text) => {
            if (error) {
                logger.debug(error);
                reject(error);
                return;
            }
    
            const words = text.toString().split("\n").map((dWord) => dWord.trim());

            let low: number = 0;
            let high: number = words.length - 1;
            while (low <= high) {
                let mid: number = Math.floor((low + high) / 2);
                let currentWord = words[mid];
                if (currentWord === word) {
                    logger.info("found word: " + currentWord)
                    resolve(true);
                    return;
                }
    
                if (currentWord < word) {
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
                
            }

            resolve(false);
        });
    });
}

const minigameModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("minigame")
        .setDescription("Play a minigame in the channel")
        .addSubcommand((game : any) =>
            game
            .setName("wordbomb")
            .setDescription("Find as much words as possible before time is up!")
        ),
    execute: async (interaction: ChatInputCommandInteraction<CacheType>) => {
        if (interaction.channel?.id !== Config.discord.bot_channel) {
            return await interaction.reply(
                {content: `You can only use this command in <#${Config.discord.bot_channel}>`, 
                ephemeral: true}
            );
        }

        const subcommand = interaction.options.getSubcommand();
        const {channel} = interaction

        console.log(subcommand);

        const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle(`${"Word Bomb! 💣"}`)
        .setDescription(`${"Click to join the Word-Bomb game!"}`)

        const response = await interaction.reply({
            embeds: [embed],
            fetchReply: true,
          });

        if (subcommand === "wordbomb") {

            type Player = {
                Member: GuildMember,
                Chances: number, // # number of chances until eliminated
                CorrectGuess: Boolean,
            }

            let players: Array<Player> = []
            let previousMessage: Message;

            // Test Case Sigma
            let sigmaValid = validateWord("sigma")
                .then(async (valid) => {
                    if (valid) {
                        await interaction.reply("sigma is a word");
                    } else {
                        await interaction.reply("sigma is not a word");
                    }
                })
                .catch((error) => {
                    logger.debug(error);
                })
            
            const collector = interaction.channel.createMessageComponentCollector(
                { 
                componentType: ComponentType.Button,
                //filter: (i) => i.user,
                time: JOIN_TIME,    
                }
            )

            collector.on("collect", async (i : ChatInputCommandInteraction) => {

                if (players.find(p => p.Member.id === i.member.id)) {
                    return await i.reply({ content: "You are already in the game!", ephemeral: true});
                }

                players.push({
                    Member: i.member as GuildMember,
                    Chances: 2,
                    CorrectGuess: false
                } as Player);

                await i.reply({ content: "You have joined the game!", ephemeral: true});
            })

            const joinButton = new ButtonBuilder()
                .setCustomId("join-minigame")
                .setLabel("Join")
                .setStyle(3);



            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                joinButton
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

            var resolveTurn : any
            var currentPlayer : Player;
            var refreshId : number; 

            async function wait(ms : number) : Promise<void> {
                return new Promise(resolve => {
                    resolveTurn = resolve
                    setTimeout(resolve, ms)
                })
            }

            setTimeout(async () => {

                // checks for atleast two palyers
                if (players.length < REQUIRED_PLAYERS){
                    interaction.channel.send(`Atleast 2 people are required for this game 😔`)
                    return
                }
                
                while (players.length > 1){
                    for (let i in players){

                        currentPlayer = players[i]
                        channel.send(`**its ${players[i].Member.user} turn!**`)
                        
                        let guessedCorrectly : Boolean = false

                        const filter = (msg : Message) => (msg.member.id === players[i].Member.id );
                        const collector = channel.createMessageCollector({filter, time: WORDBOMB_TURN_TIME});
                        collector.on('collect', async (msg : Message) => {   
                            let wordIsValid : Boolean = await validateWord(msg.content)
                            console.log(`${msg.content} is a valid word? : ${wordIsValid}` )
                            
                            if (wordIsValid){
                                console.log("VALID WORD!")
                                collector.stop()
                                resolveTurn()
                                guessedCorrectly = true
                                channel.send(`**Correct! 👍**`)
                            }
                        });
                        
                        await wait(WORDBOMB_TURN_TIME)
                        if (!guessedCorrectly){
                            currentPlayer.Chances -= 1
                            
                            if (currentPlayer.Chances <= 0) {
                                const index = players.findIndex(p => p.Member.id == currentPlayer.Member.id)

                                if (index > -1){
                                    players.splice(index, 1)
                                }else{
                                    logger.info("could not find player")
                                }

                                channel.send(`**No more chances left, you have been Elimnated ❌**`)
                            
                            } else{
                                channel.send(`Times up! 😕\n-1 Chance 👎`)
                            }

                        }

                    }
                }
                interaction.channel.send(`The Winner is: ${players[0].Member.user} 🥳🏆`)
            }, JOIN_TIME);


        } else {
            await interaction.editReply({ content: "Invalid game", embeds: [embed] });

        }

    }
}

export {minigameModule as command}