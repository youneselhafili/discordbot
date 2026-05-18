const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('next')
        .setDescription('Skip to the next song in the queue'),
    async execute(interaction) {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!queue || !queue.playing) {
            return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
        }

        const success = QueueManager.skip(interaction.guild.id);
        if (success) {
            return interaction.reply({ content: '⏭️ Skipped to next!', ephemeral: true });
        }
        return interaction.reply({ content: '❌ Could not skip.', ephemeral: true });
    },
};
