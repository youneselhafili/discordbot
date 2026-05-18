const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('radio')
        .setDescription('Play Hit Radio live stream'),
    async execute(interaction) {
        const channel = interaction.member.voice.channel;
        if (!channel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        await interaction.reply({ content: '📻 **Tuning in...**', ephemeral: true });

        QueueManager.switchMode(interaction.guild.id, 'radio');
        await QueueManager.joinChannel(channel);
        await QueueManager.addSong(
            interaction.guild.id,
            'https://hitradio-maroc.ice.infomaniak.ch/hitradio-maroc-128.mp3',
            '📻 Hit Radio',
            interaction.user.id,
            interaction.channel
        );

        return interaction.editReply('✅ 📻 Hit Radio is now playing!');
    },
};
