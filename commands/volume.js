const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Change the volume')
        .addIntegerOption(option => 
            option.setName('level')
                .setDescription('Volume level (1-100)')
                .setRequired(true)),
    async execute(interaction) {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!queue || !queue.playing) return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });

        const level = interaction.options.getInteger('level');
        if (level < 1 || level > 100) return interaction.reply({ content: 'Volume must be between 1 and 100.', ephemeral: true });

        queue.volume = level / 100;
        
        // This only applies to the NEXT song unless we recreate the resource
        // A full implementation requires tracking the active AudioResource
        return interaction.reply(`✅ Action done! 🔊 Volume set to ${level}% (Will apply to the next track)`);
    },
};
