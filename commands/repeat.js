const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('repeat')
        .setDescription('Cycle repeat mode: Off → Track → Queue → Off'),
    async execute(interaction) {
        const mode = QueueManager.cycleRepeat(interaction.guild.id);
        const labels = ['❌ Off', '🔂 Repeat Track', '🔁 Repeat Queue'];
        QueueManager.updateController(interaction.guild.id);
        return interaction.reply({ content: `🔁 Repeat is now: **${labels[mode]}**`, ephemeral: true });
    },
};
