const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),
    async execute(interaction) {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!queue || !queue.playing) {
            return interaction.reply({ content: 'There is nothing playing!', ephemeral: true });
        }
        
        queue.player.stop(); // Emits Idle event, playing next song
        return interaction.reply('✅ Action done! Skipped the song! ⏭️');
    },
};
