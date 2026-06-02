const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { doc, getDoc } = require('firebase/firestore');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Configure vote-to-kick for voice channels'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const configRef = doc(db, 'guilds', interaction.guild.id);
        const configSnap = await getDoc(configRef);
        let config = configSnap.exists() ? configSnap.data() : {};
        const vote = config.vote || { channels: [] };

        const embed = new EmbedBuilder()
            .setTitle('🗳️ Vote Configuration')
            .setColor('#F1C40F')
            .setDescription('Configure voice channels where vote-to-kick is active')
            .addFields(
                { name: '📢 Channels', value: vote.channels.length > 0 ? vote.channels.map(id => `<#${id}>`).join(', ') : '*None selected*', inline: true },
            )
            .setFooter({ text: 'When a user joins, members can vote to kick them out' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vote_edit_channels').setLabel('📢 Set Channels').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('vote_save').setLabel('✅ Save').setStyle(ButtonStyle.Success),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};
