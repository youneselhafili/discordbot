const { SlashCommandBuilder } = require('discord.js');
const { collection, query, where, getDocs } = require('firebase/firestore');
const db = require('../database');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lofi')
        .setDescription('Play Lofi music with shuffle & repeat'),
    async execute(interaction) {
        const channel = interaction.member.voice.channel;
        if (!channel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        await interaction.reply({ content: '🎧 **Setting up lo-fi...**', ephemeral: true });

        const q = query(collection(db, 'system'), where('type', '==', 'lofi'));
        const querySnapshot = await getDocs(q);
        const lofiLinks = [];
        querySnapshot.forEach(docSnap => lofiLinks.push(docSnap.data()));
        if (lofiLinks.length === 0) {
            return interaction.editReply('No Lofi playlists configured by developer.');
        }

        QueueManager.switchMode(interaction.guild.id, 'lofi');
        await QueueManager.joinChannel(channel);

        const lofiQueue = QueueManager.getQueue(interaction.guild.id);
        lofiQueue.shuffle = true;
        lofiQueue.repeatMode = 2;

        let first = true;
        for (const link of lofiLinks) {
            if (first) {
                await QueueManager.clearAndPlay(interaction.guild.id, link.url, '🌙 Lofi Music', interaction.user.id, interaction.channel);
                first = false;
            } else {
                await QueueManager.addSong(interaction.guild.id, link.url, '🌙 Lofi Music', interaction.user.id, interaction.channel);
            }
        }
        return interaction.editReply('✅ 🌙 Lofi Mode — Shuffle & Repeat ON — Enjoy!');
    },
};
