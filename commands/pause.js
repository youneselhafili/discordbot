const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current song'),
    async execute(interaction) {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!queue || !queue.playing) return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });

        queue.player.pause();
        return interaction.reply('✅ Action done! ⏸️ Paused the music.');
    },
};
