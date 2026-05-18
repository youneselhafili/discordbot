const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Developer Settings'),
    async execute(interaction) {
        // Developer restriction check
        if (interaction.user.username !== 'younes_elhafili') {
            return interaction.reply({ content: 'Not authorized. Only younes_elhafili can use this command.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Developer Settings')
            .setDescription('Manage the bot\'s internal data.')
            .setColor('#FF0000');

        const btnAddLofi = new ButtonBuilder()
            .setCustomId('dev_add_lofi')
            .setLabel('Add Lofi Playlist')
            .setStyle(ButtonStyle.Primary);

        const btnSeeUsers = new ButtonBuilder()
            .setCustomId('dev_see_users')
            .setLabel('See Users')
            .setStyle(ButtonStyle.Secondary);

        const btnSeeLibraries = new ButtonBuilder()
            .setCustomId('dev_see_libs')
            .setLabel('See Libraries')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(btnAddLofi, btnSeeUsers, btnSeeLibraries);

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};
