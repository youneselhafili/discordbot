const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { doc, getDoc } = require('firebase/firestore');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wa3r')
        .setDescription('Configure role stripping and assignment on VC join'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const configRef = doc(db, 'guilds', interaction.guild.id);
        const configSnap = await getDoc(configRef);
        let config = configSnap.exists() ? configSnap.data() : {};
        const wa3r = config.wa3r || { textMessage: '', channels: [], roleId: null };

        const embed = new EmbedBuilder()
            .setTitle('🔄 Wa3r Configuration')
            .setColor('#E74C3C')
            .setDescription(wa3r.textMessage ? `**Message:**\n${wa3r.textMessage}` : '*No message set*')
            .addFields(
                { name: '📢 Channels', value: wa3r.channels.length > 0 ? wa3r.channels.map(id => `<#${id}>`).join(', ') : '*None selected*', inline: true },
                { name: '🎭 Role', value: wa3r.roleId ? `<@&${wa3r.roleId}>` : '*Not set*', inline: true },
            )
            .setFooter({ text: 'When a user joins VC, all roles are removed and only this role is given' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('wa3r_edit_msg').setLabel('✏️ Edit Message').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('wa3r_edit_channels').setLabel('📢 Set Channels').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('wa3r_edit_role').setLabel('🎭 Set Role').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('wa3r_save').setLabel('✅ Save').setStyle(ButtonStyle.Success),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};
