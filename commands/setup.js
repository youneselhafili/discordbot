const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { doc, getDoc, setDoc } = require('firebase/firestore');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure welcome message with action buttons for voice channels'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const configRef = doc(db, 'guilds', interaction.guild.id);
        const configSnap = await getDoc(configRef);
        let config = configSnap.exists() ? configSnap.data() : {};
        const setup = config.setup || { textMessage: '', channels: [], buttons: [] };

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Setup Configuration')
            .setColor('#9B59B6')
            .setDescription(setup.textMessage ? `**Message:**\n${setup.textMessage}` : '*No message set*')
            .addFields(
                { name: '📢 Channels', value: setup.channels.length > 0 ? setup.channels.map(id => `<#${id}>`).join(', ') : '*None selected*', inline: true },
                { name: '🔘 Buttons', value: setup.buttons.length > 0 ? setup.buttons.map((b, i) => `**${i + 1}.** ${b.label} → *${b.action}*`).join('\n') : '*No buttons*', inline: true }
            )
            .setFooter({ text: 'Configure how the bot behaves when users join VC' });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup_edit_msg').setLabel('✏️ Edit Message').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('setup_edit_channels').setLabel('📢 Set Channels').setStyle(ButtonStyle.Primary),
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup_add_button').setLabel('➕ Add Button').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('setup_remove_button').setLabel('🗑️ Remove Button').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('setup_done').setLabel('✅ Done').setStyle(ButtonStyle.Secondary),
        );

        await interaction.editReply({ embeds: [embed], components: [row1, row2] });
    },
};
