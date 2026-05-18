const {
    Events,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { doc, getDoc, setDoc, updateDoc, deleteDoc: deleteFirestoreDoc, collection, addDoc, getDocs, query, where } = require("firebase/firestore");
const db = require('../database');
const QueueManager = require('../utils/music');

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
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        }
        else if (interaction.isStringSelectMenu()) {
            // ─── Library Remove ─────────────────────────────
            if (interaction.customId === 'lib_remove') {
                const playlistId = interaction.values[0];
                try {
                    const playlistRef = doc(db, 'libraries', playlistId);
                    await deleteFirestoreDoc(playlistRef);
                    return interaction.reply({ content: '✅ Playlist removed from your library!', ephemeral: true });
                } catch (err) {
                    console.error('Error removing playlist:', err);
                    return interaction.reply({ content: '❌ Failed to remove playlist.', ephemeral: true });
                }
            }
            // ─── Play Search Select ────────────────────────
            else if (interaction.customId === 'play_search_select') {
                const channel = interaction.member.voice.channel;
                if (!channel) return interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });

                await interaction.deferReply();
                const selectedValue = interaction.values[0];
                const index = parseInt(selectedValue.split('_')[1]);

                const searchResults = interaction.client.searchResults?.get(interaction.user.id);
                if (!searchResults || !searchResults[index]) {
                    return interaction.editReply('❌ Search results expired. Please use `/play` again.');
                }

                const chosen = searchResults[index];
                interaction.client.searchResults.delete(interaction.user.id);

                QueueManager.switchMode(interaction.guild.id, 'play');
                await QueueManager.joinChannel(channel);
                await QueueManager.addSong(interaction.guild.id, chosen.url, chosen.title, interaction.user.id, interaction.channel);

                await interaction.message.edit({ components: [] });
                return interaction.editReply(`✅ Action done!`);
            }
            // ─── Auto Join Playlist Select ──────────────────
            else if (interaction.customId.startsWith('aj_playlist_')) {
                const channel = interaction.member.voice.channel;
                if (!channel) return interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });

                const playlistUrl = interaction.values[0];

                // Delete the library menu message
                await interaction.message.delete().catch(() => { });

                QueueManager.switchMode(interaction.guild.id, 'play');
                await QueueManager.addSong(interaction.guild.id, playlistUrl, 'Library Playlist', interaction.user.id, interaction.channel);

                const msg = await interaction.reply({ content: '✅ Playing your playlist!', fetchReply: true });
                setTimeout(() => { msg.delete().catch(() => { }); }, 5000);
            }
        }
        // ─── Buttons ───────────────────────────────────────
        else if (interaction.isButton()) {
            // ─── Controller Buttons ────────────────────────
            if (interaction.customId === 'ctrl_pause') {
                const result = QueueManager.togglePause(interaction.guild.id);
                if (result) {
                    await QueueManager.updateController(interaction.guild.id);
                    return interaction.reply({ content: result === 'paused' ? '⏸️ Paused' : '▶️ Resumed', ephemeral: true });
                }
                return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
            }
            else if (interaction.customId === 'ctrl_next') {
                const success = QueueManager.skip(interaction.guild.id);
                return interaction.reply({ content: success ? '⏭️ Skipped!' : '❌ Nothing to skip.', ephemeral: true });
            }
            else if (interaction.customId === 'ctrl_prev') {
                const success = QueueManager.previous(interaction.guild.id);
                return interaction.reply({ content: success ? '⏮️ Playing previous!' : '❌ No previous song.', ephemeral: true });
            }
            else if (interaction.customId === 'ctrl_repeat') {
                const mode = QueueManager.cycleRepeat(interaction.guild.id);
                const labels = ['❌ Off', '🔂 Track', '🔁 Queue'];
                await QueueManager.updateController(interaction.guild.id);
                return interaction.reply({ content: `🔁 Repeat: **${labels[mode]}**`, ephemeral: true });
            }
            else if (interaction.customId === 'ctrl_shuffle') {
                const isOn = QueueManager.toggleShuffle(interaction.guild.id);
                await QueueManager.updateController(interaction.guild.id);
                return interaction.reply({ content: `🔀 Shuffle: **${isOn ? 'On' : 'Off'}**`, ephemeral: true });
            }
            // ─── Library Delete All ────────────────────────
            else if (interaction.customId === 'lib_delete_all') {
                try {
                    const q = query(collection(db, 'libraries'), where('user_id', '==', interaction.user.id));
                    const libSnap = await getDocs(q);
                    const deletes = [];
                    libSnap.forEach(d => deletes.push(deleteFirestoreDoc(doc(db, 'libraries', d.id))));
                    await Promise.all(deletes);
                    return interaction.reply({ content: `✅ Deleted all **${deletes.length}** playlists from your library!`, ephemeral: true });
                } catch (err) {
                    console.error('Error deleting all playlists:', err);
                    return interaction.reply({ content: '❌ Failed to delete playlists.', ephemeral: true });
                }
            }
            // ─── Library Add Button ───────────────────────
            else if (interaction.customId === 'lib_add') {
                const userRef = doc(db, 'users', interaction.user.id);
                const user = (await getDoc(userRef)).data();
                if (!user) return interaction.reply({ content: '❌ Register first! Use `/adduser`.', ephemeral: true });

                const modal = new ModalBuilder().setCustomId('add_playlist_modal').setTitle('Add Playlist to Library');
                const nameInput = new TextInputBuilder().setCustomId('playlist_name').setLabel("Playlist Name").setStyle(TextInputStyle.Short).setRequired(true);
                const urlInput = new TextInputBuilder().setCustomId('playlist_url').setLabel("Playlist URL").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(urlInput));
                await interaction.showModal(modal);
            }
            else if (interaction.customId === 'aj_set_active') {
                const userRef = doc(db, 'users', interaction.user.id);
                await updateDoc(userRef, { auto_join: 'Active', username: interaction.user.username });
                return interaction.reply({ content: '✅ Auto Join: **Active**! The bot will prompt you when you join a voice channel.', ephemeral: true });
            }
            else if (interaction.customId === 'aj_set_stop') {
                const userRef = doc(db, 'users', interaction.user.id);
                await updateDoc(userRef, { auto_join: 'Stop', username: interaction.user.username });
                return interaction.reply({ content: '🛑 Auto Join: **Stopped**! No more prompts.', ephemeral: true });
            }
            // ─── Auto Join Voice Prompt Buttons ────────────
            else if (interaction.customId.startsWith('aj_join_ok_')) {
                const parts = interaction.customId.split('_');
                const channelId = parts[3];
                const targetUserId = parts[4];

                if (interaction.user.id !== targetUserId) {
                    return interaction.reply({ content: '❌ This prompt is not for you!', ephemeral: true });
                }

                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) {
                    await interaction.reply({ content: '❌ Voice channel not found.', ephemeral: true });
                    return;
                }

                // Join the channel but DON'T play anything
                await QueueManager.joinChannel(channel);

                // Delete the NDKHAL prompt message
                await interaction.message.delete().catch(() => { });

                // Fetch user library
                const q = query(collection(db, 'libraries'), where('user_id', '==', targetUserId));
                const querySnapshot = await getDocs(q);
                const library = [];
                querySnapshot.forEach(d => library.push({ id: d.id, ...d.data() }));

                if (library.length > 0) {
                    // Show a playlist select menu so user picks what to play
                    const playlistMenu = new StringSelectMenuBuilder()
                        .setCustomId(`aj_playlist_${targetUserId}`)
                        .setPlaceholder('🎵 Choose a playlist to play...')
                        .addOptions(library.map(p => ({
                            label: p.playlist_name.substring(0, 100),
                            value: p.playlist_url.substring(0, 100),
                            description: 'Click to play',
                        })));

                    const row = new ActionRowBuilder().addComponents(playlistMenu);
                    const embed = new EmbedBuilder()
                        .setTitle('📚 Your Library')
                        .setDescription(library.map((p, i) => `**${i + 1}.** ${p.playlist_name}`).join('\n'))
                        .setColor('#7C3AED')
                        .setFooter({ text: 'Pick a playlist to start playing' });

                    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
                    // Auto-delete after 30s if user doesn't pick
                    setTimeout(() => { msg.delete().catch(() => { }); }, 30000);
                } else {
                    const msg = await interaction.reply({ content: '✅ Joined! Your library is empty — use `/setup` → My Library to add playlists.', fetchReply: true });
                    setTimeout(() => { msg.delete().catch(() => { }); }, 8000);
                }
            }
            else if (interaction.customId.startsWith('aj_join_no_')) {
                const targetUserId = interaction.customId.split('_')[3];
                if (interaction.user.id !== targetUserId) {
                    return interaction.reply({ content: '❌ This prompt is not for you!', ephemeral: true });
                }
                // Delete the prompt and send a brief message that auto-cleans
                await interaction.message.delete().catch(() => { });
                const msg = await interaction.reply({ content: 'OKAY 3LA KHATRK 👋', fetchReply: true });
                setTimeout(() => { msg.delete().catch(() => { }); }, 4000);
            }
            // ─── Developer Buttons ─────────────────────────
            else if (interaction.customId === 'dev_add_lofi') {
                if (interaction.user.username !== 'younes_elhafili') return interaction.reply({ content: 'Not authorized.', ephemeral: true });
                const modal = new ModalBuilder().setCustomId('add_lofi_modal').setTitle('Add Lofi Playlist');
                const urlInput = new TextInputBuilder().setCustomId('lofi_url').setLabel("YouTube/Spotify URL").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
                await interaction.showModal(modal);
            }
            else if (interaction.customId === 'dev_see_users') {
                if (interaction.user.username !== 'younes_elhafili') return interaction.reply({ content: 'Not authorized.', ephemeral: true });
                const usersSnap = await getDocs(collection(db, 'users'));
                const users = [];
                usersSnap.forEach(d => users.push(d.data()));
                const embed = new EmbedBuilder().setTitle('Registered Users').setColor('#0000FF');
                if (users.length === 0) embed.setDescription('No users registered yet.');
                else embed.setDescription(users.map(u => `<@${u.discord_id}> - ${u.username} (Auto Join: ${u.auto_join})`).join('\n'));
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            else if (interaction.customId === 'dev_see_libs') {
                if (interaction.user.username !== 'younes_elhafili') return interaction.reply({ content: 'Not authorized.', ephemeral: true });
                const libsSnap = await getDocs(collection(db, 'libraries'));
                const libs = [];
                libsSnap.forEach(d => libs.push(d.data()));
                const embed = new EmbedBuilder().setTitle('User Libraries').setColor('#0000FF');
                if (libs.length === 0) embed.setDescription('No libraries saved yet.');
                else embed.setDescription(libs.map(l => `<@${l.user_id}> | ${l.playlist_name} | ${l.playlist_url}`).join('\n'));
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        // ─── Modals ────────────────────────────────────────
        else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'add_playlist_modal') {
                const name = interaction.fields.getTextInputValue('playlist_name');
                const url = interaction.fields.getTextInputValue('playlist_url');
                await addDoc(collection(db, 'libraries'), { user_id: interaction.user.id, playlist_url: url, playlist_name: name });
                return interaction.reply({ content: `✅ Playlist **${name}** added to your library!`, ephemeral: true });
            }
            else if (interaction.customId === 'add_lofi_modal') {
                const url = interaction.fields.getTextInputValue('lofi_url');
                await addDoc(collection(db, 'system'), { type: 'lofi', url: url });
                return interaction.reply({ content: `✅ Lofi URL added!`, ephemeral: true });
            }
        }
    },
};
