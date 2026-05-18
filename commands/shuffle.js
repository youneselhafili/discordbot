const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Toggle shuffle mode on or off'),
    async execute(interaction) {
        const isOn = QueueManager.toggleShuffle(interaction.guild.id);
        QueueManager.updateController(interaction.guild.id);
        return interaction.reply({ content: `🔀 Shuffle is now **${isOn ? 'Enabled' : 'Disabled'}**`, ephemeral: true });
    },
};
