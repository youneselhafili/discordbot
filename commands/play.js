const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const play = require('play-dl');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube or Spotify')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The song name or URL')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.reply('🔍 **Searching...**');

        const query = interaction.options.getString('query');
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return interaction.editReply('❌ You must be in a voice channel to use this command!');
        }

        try {
            QueueManager.switchMode(interaction.guild.id, 'play');
            await QueueManager.joinChannel(channel);

            // Spotify link
            if (query.includes('spotify.com')) {
                await QueueManager.addSong(interaction.guild.id, query, 'Spotify Music', interaction.user.id, interaction.channel);
                await interaction.deleteReply().catch(() => {});
                return;
            }

            // Direct URL — play the EXACT link, get title+artist from yt-dlp
            if (query.startsWith('http')) {
                let title = 'Loading...';

                // Get real title + artist from yt-dlp
                if (query.includes('youtube.com') || query.includes('youtu.be')) {
                    const fetchedTitle = await QueueManager.getVideoTitle(query);
                    if (fetchedTitle) title = fetchedTitle;
                    else title = 'YouTube Audio';
                }

                await QueueManager.addSong(interaction.guild.id, query, title, interaction.user.id, interaction.channel);
                await interaction.deleteReply().catch(() => {});
                return;
            }

            // Text search → show selection menu
            const searchResults = await play.search(query, { limit: 5 });
            if (!searchResults || searchResults.length === 0) {
                return interaction.editReply('No results found.');
            }

            if (!interaction.client.searchResults) interaction.client.searchResults = new Map();
            interaction.client.searchResults.set(interaction.user.id, searchResults);

            const options = searchResults.map((res, i) => ({
                label: res.title.substring(0, 100),
                description: `${res.channel?.name || 'Unknown'} • ${res.durationRaw || ''}`.substring(0, 100),
                value: `search_${i}`,
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('play_search_select')
                .setPlaceholder('Select a song to play...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.editReply({ content: '🔍 Multiple results found! Pick one:', components: [row] });

        } catch (error) {
            console.error(error);
            return interaction.editReply('An error occurred while trying to play the song.');
        }
    },
};
