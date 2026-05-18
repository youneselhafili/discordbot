const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { doc, getDoc } = require('firebase/firestore');
const db = require('../database');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        // Only trigger when a non-bot user joins or moves to a new channel
        if (!newState.channelId || oldState.channelId === newState.channelId || newState.member.user.bot) return;

        const userId = newState.member.user.id;

        // Check if the bot is already in ANY voice channel in this guild
        const botVoiceState = newState.guild.members.me.voice;
        let isBotAlone = false;
        
        if (botVoiceState && botVoiceState.channelId) {
            const botChannel = newState.guild.channels.cache.get(botVoiceState.channelId);
            const nonBots = botChannel?.members.filter(m => !m.user.bot).size || 0;
            if (nonBots > 0) {
                return; // Bot is in a channel WITH PEOPLE — don't move
            }
            isBotAlone = true;
        }

        // Check if user has Auto Join Active
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const user = userSnap.data();

        if (!user || user.auto_join !== 'Active') return;

        try {
            const channel = newState.channel;

            if (isBotAlone) {
                // Directly join if the bot was alone
                const QueueManager = require('../utils/music');
                await QueueManager.joinChannel(channel);
                return;
            }

            const btnOk = new ButtonBuilder()
                .setCustomId(`aj_join_ok_${newState.channelId}_${userId}`)
                .setLabel('OKAY')
                .setStyle(ButtonStyle.Success);

            const btnNo = new ButtonBuilder()
                .setCustomId(`aj_join_no_${userId}`)
                .setLabel('MACHI DABA')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(btnOk, btnNo);

            await channel.send({ 
                content: `👋 <@${userId}> **NDKHAL?**`, 
                components: [row] 
            });
        } catch (error) {
            console.error('Could not send auto-join prompt:', error);
        }
    },
};
