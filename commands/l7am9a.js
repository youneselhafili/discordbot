const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('l7am9a')
        .setDescription('Disconnect random users with a custom message'),
    async execute(interaction) {
        const channel = interaction.member.voice.channel;
        if (!channel) {
            return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId('l7am9a_modal')
            .setTitle('L7am9a - Custom Message');

        const msgInput = new TextInputBuilder()
            .setCustomId('l7am9a_msg')
            .setLabel('Message to send')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000);

        modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
        await interaction.showModal(modal);
    },
};
