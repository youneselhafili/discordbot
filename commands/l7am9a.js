const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('l7am9a')
        .setDescription('Auto-disconnect random users from voice channel')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Number of users to disconnect (1-3)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(3)),
    async execute(interaction) {
        const count = interaction.options.getInteger('count');
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        }

        const members = channel.members.filter(m => !m.user.bot).map(m => m);
        if (members.length === 0) {
            return interaction.reply({ content: '❌ No other users in the voice channel!', ephemeral: true });
        }

        const toDisconnect = [];
        const shuffled = [...members].sort(() => Math.random() - 0.5);
        const amount = Math.min(count, shuffled.length);

        for (let i = 0; i < amount; i++) {
            toDisconnect.push(shuffled[i]);
        }

        await interaction.reply({ content: `🎲 **L7am9a!** Disconnecting ${toDisconnect.length} user(s)...` });

        for (const member of toDisconnect) {
            try {
                await member.voice.disconnect();
            } catch (err) {
                console.error(`Failed to disconnect ${member.user.tag}:`, err);
            }
        }
    },
};
