const { Events, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { doc, getDoc, setDoc } = require('firebase/firestore');
const db = require('../database');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error!', ephemeral: true });
                }
            }
            return;
        }

        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId === 'setup_edit_msg') {
                const modal = new ModalBuilder().setCustomId('setup_msg_modal').setTitle('Edit Welcome Message');
                const input = new TextInputBuilder().setCustomId('setup_msg_text').setLabel('Message text (use {user} for mention)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            if (customId === 'setup_edit_channels') {
                const channels = interaction.guild.channels.cache.filter(c => c.isVoiceBased());
                const select = new StringSelectMenuBuilder().setCustomId('setup_channel_select').setPlaceholder('Select voice channels...').setMinValues(1).setMaxValues(channels.size).addOptions(
                    channels.map(c => new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(c.id).setDescription(`ID: ${c.id}`))
                );
                return interaction.reply({ content: 'Select voice channels:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
            }

            if (customId === 'setup_add_button') {
                const modal = new ModalBuilder().setCustomId('setup_addbtn_modal').setTitle('Add Action Button');
                const labelInput = new TextInputBuilder().setCustomId('setup_btn_label').setLabel('Button label').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80);
                const actionInput = new TextInputBuilder().setCustomId('setup_btn_action').setLabel('Action (disconnect/mute/unmute/deafen/undeafen)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20);
                const roleInput = new TextInputBuilder().setCustomId('setup_btn_role').setLabel('Role ID (only if action = role)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(20);
                modal.addComponents(new ActionRowBuilder().addComponents(labelInput), new ActionRowBuilder().addComponents(actionInput), new ActionRowBuilder().addComponents(roleInput));
                return interaction.showModal(modal);
            }

            if (customId === 'setup_remove_button') {
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                const buttons = config.setup?.buttons || [];
                if (buttons.length === 0) return interaction.reply({ content: 'No buttons to remove!', ephemeral: true });

                const select = new StringSelectMenuBuilder().setCustomId('setup_remove_btn_select').setPlaceholder('Select button to remove...').addOptions(
                    buttons.map((b, i) => new StringSelectMenuOptionBuilder().setLabel(`${i + 1}. ${b.label}`).setValue(i.toString()).setDescription(`Action: ${b.action}`))
                );
                return interaction.reply({ content: 'Select a button to remove:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
            }

            if (customId === 'setup_done') {
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                const setup = config.setup || { textMessage: '', channels: [], buttons: [] };
                if (!setup.textMessage) return interaction.reply({ content: '❌ Please set a message first!', ephemeral: true });
                if (setup.channels.length === 0) return interaction.reply({ content: '❌ Please select at least one channel!', ephemeral: true });
                await setDoc(configRef, { ...config, setup }, { merge: true });
                return interaction.update({ content: '✅ Setup saved!', embeds: [], components: [] });
            }

            if (customId === 'wa3r_edit_msg') {
                const modal = new ModalBuilder().setCustomId('wa3r_msg_modal').setTitle('Edit Wa3r Message');
                const input = new TextInputBuilder().setCustomId('wa3r_msg_text').setLabel('Message (use {user} for mention)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            if (customId === 'wa3r_edit_channels') {
                const channels = interaction.guild.channels.cache.filter(c => c.isVoiceBased());
                const select = new StringSelectMenuBuilder().setCustomId('wa3r_channel_select').setPlaceholder('Select voice channels...').setMinValues(1).setMaxValues(channels.size).addOptions(
                    channels.map(c => new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(c.id).setDescription(`ID: ${c.id}`))
                );
                return interaction.reply({ content: 'Select voice channels:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
            }

            if (customId === 'wa3r_edit_role') {
                const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position);
                const select = new StringSelectMenuBuilder().setCustomId('wa3r_role_select').setPlaceholder('Select a role...').setMinValues(1).setMaxValues(1).addOptions(
                    roles.map(r => new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.id).setDescription(`ID: ${r.id}`))
                );
                return interaction.reply({ content: 'Select the role to give:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
            }

            if (customId === 'wa3r_save') {
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                const wa3r = config.wa3r || { textMessage: '', channels: [], roleId: null };
                if (!wa3r.roleId) return interaction.reply({ content: '❌ Please select a role first!', ephemeral: true });
                if (wa3r.channels.length === 0) return interaction.reply({ content: '❌ Please select at least one channel!', ephemeral: true });
                await setDoc(configRef, { ...config, wa3r }, { merge: true });
                return interaction.update({ content: '✅ Wa3r saved!', embeds: [], components: [] });
            }

            if (customId === 'vote_edit_channels') {
                const channels = interaction.guild.channels.cache.filter(c => c.isVoiceBased());
                const select = new StringSelectMenuBuilder().setCustomId('vote_channel_select').setPlaceholder('Select voice channels...').setMinValues(1).setMaxValues(channels.size).addOptions(
                    channels.map(c => new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(c.id).setDescription(`ID: ${c.id}`))
                );
                return interaction.reply({ content: 'Select voice channels:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
            }

            if (customId === 'vote_save') {
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                const vote = config.vote || { channels: [] };
                if (vote.channels.length === 0) return interaction.reply({ content: '❌ Please select at least one channel!', ephemeral: true });
                await setDoc(configRef, { ...config, vote }, { merge: true });
                return interaction.update({ content: '✅ Vote saved!', embeds: [], components: [] });
            }

            if (customId.startsWith('vc_btn_')) {
                const idx = parseInt(customId.split('_')[2]);
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                const buttons = config.setup?.buttons || [];
                const btn = buttons[idx];
                if (!btn) return interaction.reply({ content: 'Button configuration not found!', ephemeral: true });

                const member = interaction.member;
                try {
                    switch (btn.action) {
                        case 'disconnect':
                            if (member.voice.channelId) await member.voice.disconnect();
                            break;
                        case 'mute':
                            await member.voice.setMute(true);
                            break;
                        case 'unmute':
                            await member.voice.setMute(false);
                            break;
                        case 'deafen':
                            await member.voice.setDeaf(true);
                            break;
                        case 'undeafen':
                            await member.voice.setDeaf(false);
                            break;
                        case 'role':
                            if (btn.roleId) await member.roles.add(btn.roleId);
                            break;
                    }
                    await interaction.reply({ content: `✅ ${btn.label} applied!`, ephemeral: true });
                } catch (err) {
                    console.error('Button action error:', err);
                    await interaction.reply({ content: '❌ Failed to apply action.', ephemeral: true });
                }
            }

            return;
        }

        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;

            if (customId === 'setup_channel_select') {
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                if (!config.setup) config.setup = { textMessage: '', channels: [], buttons: [] };
                config.setup.channels = interaction.values;
                await setDoc(configRef, config, { merge: true });
                return interaction.update({ content: `✅ ${interaction.values.length} channel(s) selected!`, components: [] });
            }

            if (customId === 'setup_remove_btn_select') {
                const idx = parseInt(interaction.values[0]);
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                if (config.setup?.buttons) {
                    config.setup.buttons.splice(idx, 1);
                    await setDoc(configRef, config, { merge: true });
                }
                return interaction.update({ content: '✅ Button removed!', components: [] });
            }

            if (customId === 'wa3r_channel_select') {
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                if (!config.wa3r) config.wa3r = { textMessage: '', channels: [], roleId: null };
                config.wa3r.channels = interaction.values;
                await setDoc(configRef, config, { merge: true });
                return interaction.update({ content: `✅ ${interaction.values.length} channel(s) selected!`, components: [] });
            }

            if (customId === 'wa3r_role_select') {
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                if (!config.wa3r) config.wa3r = { textMessage: '', channels: [], roleId: null };
                config.wa3r.roleId = interaction.values[0];
                await setDoc(configRef, config, { merge: true });
                return interaction.update({ content: `✅ Role <@&${interaction.values[0]}> selected!`, components: [] });
            }

            if (customId === 'vote_channel_select') {
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                if (!config.vote) config.vote = { channels: [] };
                config.vote.channels = interaction.values;
                await setDoc(configRef, config, { merge: true });
                return interaction.update({ content: `✅ ${interaction.values.length} channel(s) selected!`, components: [] });
            }

            return;
        }

        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;

            if (customId === 'setup_msg_modal') {
                const text = interaction.fields.getTextInputValue('setup_msg_text');
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                if (!config.setup) config.setup = { textMessage: '', channels: [], buttons: [] };
                config.setup.textMessage = text;
                await setDoc(configRef, config, { merge: true });
                return interaction.reply({ content: '✅ Message saved!', ephemeral: true });
            }

            if (customId === 'setup_addbtn_modal') {
                const label = interaction.fields.getTextInputValue('setup_btn_label');
                const action = interaction.fields.getTextInputValue('setup_btn_action').toLowerCase();
                const roleId = interaction.fields.getTextInputValue('setup_btn_role');

                const allowedActions = ['disconnect', 'mute', 'unmute', 'deafen', 'undeafen', 'role'];
                if (!allowedActions.includes(action)) {
                    return interaction.reply({ content: `❌ Invalid action! Allowed: ${allowedActions.join(', ')}`, ephemeral: true });
                }

                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                if (!config.setup) config.setup = { textMessage: '', channels: [], buttons: [] };
                if (!config.setup.buttons) config.setup.buttons = [];

                if (config.setup.buttons.length >= 5) {
                    return interaction.reply({ content: '❌ Maximum 5 buttons allowed!', ephemeral: true });
                }

                config.setup.buttons.push({ label, action, roleId: action === 'role' ? roleId : null, style: action === 'disconnect' ? 'Danger' : action === 'mute' || action === 'deafen' ? 'Danger' : 'Success' });
                await setDoc(configRef, config, { merge: true });
                return interaction.reply({ content: `✅ Button "${label}" added!`, ephemeral: true });
            }

            if (customId === 'wa3r_msg_modal') {
                const text = interaction.fields.getTextInputValue('wa3r_msg_text');
                const configRef = doc(db, 'guilds', interaction.guild.id);
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};
                if (!config.wa3r) config.wa3r = { textMessage: '', channels: [], roleId: null };
                config.wa3r.textMessage = text;
                await setDoc(configRef, config, { merge: true });
                return interaction.reply({ content: '✅ Message saved!', ephemeral: true });
            }

            if (customId === 'l7am9a_modal') {
                const msg = interaction.fields.getTextInputValue('l7am9a_msg');
                const channel = interaction.member.voice.channel;
                if (!channel) {
                    return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
                }

                await interaction.deferReply();

                const members = channel.members.filter(m => !m.user.bot).map(m => m);
                if (members.length === 0) {
                    return interaction.editReply('❌ No other users in the voice channel!');
                }

                const count = Math.floor(Math.random() * 3) + 1;
                const shuffled = [...members].sort(() => Math.random() - 0.5);
                const toDisconnect = shuffled.slice(0, Math.min(count, shuffled.length));

                for (const member of toDisconnect) {
                    try { await member.voice.disconnect(); } catch (err) { console.error(err); }
                }

                const names = toDisconnect.map(m => m.user.toString()).join(', ');
                await channel.send(`🎲 **${msg}**\n${names}`);
                return interaction.editReply(`✅ Disconnected ${toDisconnect.length} user(s)!`);
            }

            return;
        }
    },
};
