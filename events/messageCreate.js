const { Events, EmbedBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) return;

        const prefix = 'g!';
        if (!message.content.toLowerCase().startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (commandName === 'play' || commandName === 'p') {
            const channel = message.member?.voice?.channel;
            if (!channel) {
                return message.reply('❌ You must be in a voice channel to play music!');
            }

            const query = args.join(' ');
            if (!query) {
                return message.reply('❌ Please provide a link or search query!');
            }

            try {
                // Determine title/search format
                let title = 'Loading...';

                if (query.startsWith('http')) {
                    if (query.includes('youtube.com') || query.includes('youtu.be')) {
                        const fetchedTitle = await QueueManager.getVideoTitle(query);
                        if (fetchedTitle) title = fetchedTitle;
                        else title = 'YouTube Audio';
                    }

                    // Jockie Music style "Added to queue" response (for direct links and Spotify)
                    const embed = new EmbedBuilder()
                        .setColor('#1DB954')
                        .setAuthor({ name: 'Added to queue', iconURL: message.author.displayAvatarURL() })
                        .setDescription(`**[${title}](${query})**`)
                        .setFooter({ text: `Requested by ${message.author.username}` });

                    const reply = await message.channel.send({ embeds: [embed] });

                    // Connect to voice channel and add to queue
                    QueueManager.switchMode(message.guild.id, 'play');
                    await QueueManager.joinChannel(channel);
                    await QueueManager.addSong(message.guild.id, query, title, message.author.id, message.channel);

                    // Delete the added to queue message after 10 seconds to keep chat clean
                    setTimeout(() => {
                        reply.delete().catch(() => { });
                        message.delete().catch(() => { });
                    }, 10000);
                } else {
                    // For text search, fallback to the slash command behavior
                    return message.reply('Please use `/play` for text search, or provide a direct link with `g!play`.');
                }
            } catch (error) {
                console.error(error);
                message.reply('❌ An error occurred while trying to play the track.');
            }
        }
    },
};
