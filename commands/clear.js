const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear all bot messages from this channel')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to scan (default: 100, max: 100)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(100)),
    async execute(interaction) {
        await interaction.reply({ content: '🧹 **Clearing queue...**', ephemeral: true });

        const amount = interaction.options.getInteger('amount') || 100;
        const channel = interaction.channel;

        try {
            const fetched = await channel.messages.fetch({ limit: amount });
            const botMessages = fetched.filter(msg => msg.author.id === interaction.client.user.id);

            if (botMessages.size === 0) {
                return interaction.editReply('✅ No bot messages to clear.');
            }

            // bulkDelete can only delete messages < 14 days old
            const now = Date.now();
            const deletable = botMessages.filter(msg => (now - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);
            const tooOld = botMessages.size - deletable.size;

            if (deletable.size > 0) {
                await channel.bulkDelete(deletable, true);
            }

            let reply = `✅ Cleared **${deletable.size}** bot message${deletable.size !== 1 ? 's' : ''}!`;
            if (tooOld > 0) reply += ` (${tooOld} older than 14 days, can't delete)`;

            return interaction.editReply(reply);
        } catch (error) {
            console.error('Error clearing messages:', error);
            return interaction.editReply('❌ Failed to clear messages. Make sure I have "Manage Messages" permission.');
        }
    },
};
