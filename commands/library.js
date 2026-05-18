const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { doc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('library')
        .setDescription('View and manage your music library'),
    async execute(interaction) {
        const userRef = doc(db, 'users', interaction.user.id);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            return interaction.reply({ content: '❌ Register first! Use `/adduser`.', ephemeral: true });
        }

        await interaction.reply({ content: '📚 **Opening library...**', ephemeral: true });

        const q = query(collection(db, 'libraries'), where('user_id', '==', interaction.user.id));
        const libSnap = await getDocs(q);
        const playlists = [];
        libSnap.forEach(d => playlists.push({ id: d.id, ...d.data() }));

        const embed = new EmbedBuilder()
            .setTitle('📚 My Library')
            .setColor('#7C3AED')
            .setFooter({ text: `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''} saved` });

        if (playlists.length === 0) {
            embed.setDescription('Your library is empty.\nUse the ➕ button below to add a playlist!');
        } else {
            embed.setDescription(playlists.map((p, i) => `**${i + 1}.** ${p.playlist_name}`).join('\n'));
        }

        const btnAdd = new ButtonBuilder()
            .setCustomId('lib_add')
            .setLabel('Add Playlist')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕');

        if (playlists.length > 0) {
            const btnDeleteAll = new ButtonBuilder()
                .setCustomId('lib_delete_all')
                .setLabel('Delete All')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️');

            const removeMenu = new StringSelectMenuBuilder()
                .setCustomId('lib_remove')
                .setPlaceholder('🗑️ Select a playlist to delete...')
                .addOptions(playlists.map(p => ({
                    label: p.playlist_name.substring(0, 100),
                    value: p.id,
                })));

            const row1 = new ActionRowBuilder().addComponents(removeMenu);
            const row2 = new ActionRowBuilder().addComponents(btnAdd, btnDeleteAll);
            return interaction.editReply({ embeds: [embed], components: [row1, row2] });
        }

        const row = new ActionRowBuilder().addComponents(btnAdd);
        return interaction.editReply({ embeds: [embed], components: [row] });
    },
};
