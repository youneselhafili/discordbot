const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make the bot join your current voice channel'),
    async execute(interaction) {
        const channel = interaction.member.voice.channel;
        
        if (!channel) {
            return interaction.reply({ content: '❌ You must be in a voice channel first!', ephemeral: true });
        }

        try {
            await QueueManager.joinChannel(channel);
            return interaction.reply('Hahowa ja 😏');
        } catch (error) {
            console.error('Error joining channel:', error);
            return interaction.reply({ content: '❌ Failed to join the voice channel.', ephemeral: true });
        }
    },
};
