const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave the voice channel'),
    async execute(interaction) {
        const queue = QueueManager.getQueue(interaction.guild.id);
        
        if (queue && queue.connection) {
            queue.isLeavingGracefully = true;
            queue.connection.destroy();
            return interaction.reply('Thalla 🫡').catch(() => {});
        } else {
            return interaction.reply({ content: 'I am not currently in a voice channel!', ephemeral: true });
        }
    },
};
