const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { doc, getDoc, updateDoc } = require('firebase/firestore');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autojoin')
        .setDescription('Toggle auto-join when you enter a voice channel'),
    async execute(interaction) {
        const userRef = doc(db, 'users', interaction.user.id);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            return interaction.reply({ content: '❌ Register first! Use `/adduser`.', ephemeral: true });
        }

        const user = userSnap.data();
        const currentStatus = user.auto_join || 'Stop';

        const btnActivate = new ButtonBuilder()
            .setCustomId('aj_set_active')
            .setLabel('Activate')
            .setStyle(ButtonStyle.Success)
            .setDisabled(currentStatus === 'Active');

        const btnStop = new ButtonBuilder()
            .setCustomId('aj_set_stop')
            .setLabel('Deactivate')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(currentStatus === 'Stop');

        const row = new ActionRowBuilder().addComponents(btnActivate, btnStop);

        return interaction.reply({
            content: `🤖 Auto Join is currently: **${currentStatus}**\nWhen active, the bot will ask to join when you enter a voice channel.`,
            components: [row],
            ephemeral: true
        });
    },
};
