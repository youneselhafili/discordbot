const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave the voice channel'),
    async execute(interaction) {
        const queue = QueueManager.getQueue(interaction.guild.id);
        
        if (queue && queue.connection) {
            await interaction.reply('👋 **Leaving...**');
            queue.connection.destroy();
            // resetQueue is triggered automatically by the Destroyed event
            return interaction.deleteReply().catch(() => {});
        } else {
            return interaction.reply({ content: 'I am not currently in a voice channel!', ephemeral: true });
        }
    },
};
