const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { doc, getDoc } = require('firebase/firestore');
const db = require('../database');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        if (!newState.channelId || oldState.channelId === newState.channelId || newState.member.user.bot) return;

        const guildId = newState.guild.id;
        const channelId = newState.channelId;
        const member = newState.member;
        const channel = newState.channel;

        const configRef = doc(db, 'guilds', guildId);
        const configSnap = await getDoc(configRef);
        if (!configSnap.exists()) return;
        const config = configSnap.data();

        const setup = config.setup;
        if (setup && setup.channels && setup.channels.includes(channelId) && setup.buttons && setup.buttons.length > 0) {
            const rows = [];
            let row = new ActionRowBuilder();
            for (let i = 0; i < setup.buttons.length; i++) {
                const btn = setup.buttons[i];
                const style = btn.style === 'Success' ? ButtonStyle.Success :
                    btn.style === 'Danger' ? ButtonStyle.Danger :
                    btn.style === 'Link' ? ButtonStyle.Link :
                    ButtonStyle.Secondary;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`vc_btn_${i}`)
                        .setLabel(btn.label)
                        .setStyle(style)
                );
                if ((i + 1) % 5 === 0) {
                    rows.push(row);
                    row = new ActionRowBuilder();
                }
            }
            if (row.components.length > 0) rows.push(row);

            const content = setup.textMessage
                ? setup.textMessage.replace(/\{user\}/g, `<@${member.id}>`).replace(/\{channel\}/g, `<#${channelId}>`)
                : `👋 <@${member.id}>`;
            await channel.send({ content, components: rows });
        }

        const wa3r = config.wa3r;
        if (wa3r && wa3r.channels && wa3r.channels.includes(channelId) && wa3r.roleId) {
            try {
                const rolesToRemove = member.roles.cache.filter(r => r.id !== guildId && r.id !== wa3r.roleId);
                for (const [, role] of rolesToRemove) {
                    await member.roles.remove(role).catch(() => {});
                }
                await member.roles.add(wa3r.roleId).catch(() => {});

                const content = wa3r.textMessage
                    ? wa3r.textMessage.replace(/\{user\}/g, `<@${member.id}>`).replace(/\{channel\}/g, `<#${channelId}>`)
                    : `🔄 <@${member.id}> roles have been changed`;
                await channel.send({ content });
            } catch (err) {
                console.error('Wa3r error:', err);
            }
        }

        const vote = config.vote;
        if (vote && vote.channels && vote.channels.includes(channelId)) {
            try {
                const embed = new EmbedBuilder()
                    .setTitle('🗳️ Vote')
                    .setDescription(`**wach bghito <@${member.id}> yb9a?**`)
                    .setColor('#F1C40F')
                    .setFooter({ text: 'Vote ends in 60 seconds' });

                const btnAH = new ButtonBuilder()
                    .setCustomId(`vote_ah_${member.id}_${channelId}`)
                    .setLabel('AH')
                    .setStyle(ButtonStyle.Success);
                const btnLA = new ButtonBuilder()
                    .setCustomId(`vote_la_${member.id}_${channelId}`)
                    .setLabel('LA 2 7777')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(btnAH, btnLA);
                const msg = await channel.send({ embeds: [embed], components: [row] });

                const collector = msg.createMessageComponentCollector({ time: 60000 });
                const votes = { ah: 0, la: 0, voters: new Set() };

                collector.on('collect', async (i) => {
                    if (votes.voters.has(i.user.id)) {
                        return i.reply({ content: 'You already voted!', ephemeral: true });
                    }
                    votes.voters.add(i.user.id);
                    if (i.customId.startsWith('vote_ah_')) votes.ah++;
                    else votes.la++;
                    await i.reply({ content: '✅ Vote recorded!', ephemeral: true });
                });

                collector.on('end', async () => {
                    await msg.edit({ components: [] });
                    if (votes.la > votes.ah) {
                        const target = await newState.guild.members.fetch(member.id).catch(() => null);
                        if (target && target.voice.channelId === channelId) {
                            await target.voice.disconnect().catch(() => {});
                            await channel.send(`🗳️ <@${member.id}> has been **kicked** from the voice channel! (${votes.la} vs ${votes.ah})`);
                        }
                    } else {
                        await channel.send(`🗳️ <@${member.id}> **stays!** (AH: ${votes.ah} | LA: ${votes.la})`);
                    }
                });
            } catch (err) {
                console.error('Vote error:', err);
            }
        }
    },
};
