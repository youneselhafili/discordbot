const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    NoSubscriberBehavior,
    entersState
} = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { spawn } = require('child_process');
const path = require('path');

const YT_DLP_PATH = path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');

class SpotifyAPI {
    constructor() {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
    }

    isConfigured() {
        return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
    }

    async getAccessToken() {
        if (!this.isConfigured()) return null;
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        const fetch = require('node-fetch');
        const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: 'grant_type=client_credentials'
            });

            if (!response.ok) {
                console.error(`Failed to get Spotify access token: ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
            return this.accessToken;
        } catch (e) {
            console.error('Error fetching Spotify token:', e);
            return null;
        }
    }

    async getTrack(trackId) {
        const token = await this.getAccessToken();
        if (!token) return null;
        const fetch = require('node-fetch');
        const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return null;
        return await res.json();
    }

    async getPlaylist(playlistId) {
        const token = await this.getAccessToken();
        if (!token) return null;
        const fetch = require('node-fetch');
        let tracks = [];
        let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&market=MA`;
        
        while (url) {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                console.error(`[SPOTIFY API] Playlist error: ${res.status} ${res.statusText}`);
                const body = await res.text().catch(() => '');
                console.error(`[SPOTIFY API] Response: ${body}`);
                break;
            }
            const data = await res.json();
            tracks.push(...data.items.filter(item => item.track).map(item => item.track));
            url = data.next; 
        }
        return tracks;
    }

    async getAlbum(albumId) {
        const token = await this.getAccessToken();
        if (!token) return null;
        const fetch = require('node-fetch');
        let tracks = [];
        let url = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;
        let mainAlbum = null;
        
        const albumRes = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (albumRes.ok) mainAlbum = await albumRes.json();

        while (url) {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) break;
            const data = await res.json();
            if (mainAlbum) {
                data.items.forEach(t => t.album = mainAlbum);
            }
            tracks.push(...data.items);
            url = data.next;
        }
        return tracks;
    }
}

const spotifyApi = new SpotifyAPI();

class QueueManager {
    constructor() {
        this.queues = new Map();
    }

    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                connection: null,
                player: createAudioPlayer({
                    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
                }),
                songs: [],
                history: [],
                currentSong: null,
                playing: false,
                volume: 0.5,
                repeatMode: 0,
                shuffle: false,
                mode: 'idle',
                controllerMessage: null,
                epoch: 0,
                _lastTextChannel: null,
                _ytdlpProcess: null,
                _leaveTimer: null,
            });

            const queue = this.queues.get(guildId);

            queue.player.on(AudioPlayerStatus.Idle, () => {
                if (!queue.playing) return;
                if (queue._ytdlpProcess) { queue._ytdlpProcess.kill(); queue._ytdlpProcess = null; }

                if (queue.repeatMode === 1 && queue.currentSong) {
                    this.playSong(guildId, queue.currentSong);
                } else {
                    if (queue.repeatMode === 2 && queue.currentSong) {
                        queue.songs.push(queue.currentSong);
                    }
                    if (queue.currentSong) {
                        queue.history.push(queue.currentSong);
                        if (queue.history.length > 50) queue.history.shift();
                    }
                    if (queue.songs.length > 0) {
                        let nextSong;
                        if (queue.shuffle) {
                            const idx = Math.floor(Math.random() * queue.songs.length);
                            nextSong = queue.songs.splice(idx, 1)[0];
                        } else {
                            nextSong = queue.songs.shift();
                        }
                        this.playSong(guildId, nextSong);
                    } else {
                        queue.playing = false;
                        queue.currentSong = null;
                        // Wait 15s then leave if still idle
                        queue._leaveTimer = setTimeout(() => {
                            const q = this.queues.get(guildId);
                            if (q && !q.playing && q.connection) {
                                console.log('[VOICE] No songs for 15s, leaving.');
                                q.connection.destroy();
                            }
                        }, 15000);
                    }
                }
            });

            queue.player.on(AudioPlayerStatus.AutoPaused, () => {
                try { queue.player.unpause(); } catch (e) { /* ignore */ }
            });

            queue.player.on('error', error => {
                console.error(`[PLAYER ERROR] ${error.message}`);
                if (queue._ytdlpProcess) { queue._ytdlpProcess.kill(); queue._ytdlpProcess = null; }
                if (queue.songs.length > 0) {
                    const next = queue.shuffle
                        ? queue.songs.splice(Math.floor(Math.random() * queue.songs.length), 1)[0]
                        : queue.songs.shift();
                    this.playSong(guildId, next);
                } else {
                    queue.playing = false;
                }
            });
        }
        return this.queues.get(guildId);
    }

    // ─── Voice Connection ──────────────────────────────────
    async joinChannel(channel) {
        const guildId = channel.guild.id;
        const queue = this.getQueue(guildId);

        if (queue.connection && queue.connection.state.status !== 'destroyed') {
            if (queue.connection.joinConfig.channelId === channel.id) {
                return queue.connection; // Already in the correct channel
            }
            // If in a different channel, we DO NOT destroy the connection.
            // joinVoiceChannel will automatically move the bot to the new channel smoothly.
            joinVoiceChannel({
                channelId: channel.id,
                guildId: guildId,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: true,
            });
            return queue.connection;
        }

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guildId,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true,
        });

        queue.connection = connection;
        connection.subscribe(queue.player);

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (e) {
                console.log('[VOICE] Disconnected, resetting queue.');
                this.resetQueue(guildId);
            }
        });

        connection.on(VoiceConnectionStatus.Destroyed, () => {
            console.log('[VOICE] Connection destroyed, resetting queue.');
            this.resetQueue(guildId);
        });

        return connection;
    }

    resetQueue(guildId) {
        const queue = this.queues.get(guildId);
        if (queue) {
            queue.epoch++;
            queue.player.stop(true);
            if (queue._ytdlpProcess) { queue._ytdlpProcess.kill(); queue._ytdlpProcess = null; }
            if (queue._leaveTimer) { clearTimeout(queue._leaveTimer); queue._leaveTimer = null; }

            const textChannel = queue._lastTextChannel || queue.controllerMessage?.channel;
            
            (async () => {
                if (textChannel) {
                    await this._cleanBotMessages(textChannel);
                    
                    // Send kick/leave message
                    const leaveEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('safi jriti 3liya \ud83d\ude12');
                    
                    textChannel.send({ embeds: [leaveEmbed] }).catch(() => {});
                }
            })();

            if (queue.controllerMessage) queue.controllerMessage.delete().catch(() => {});

            queue.songs = [];
            queue.history = [];
            queue.currentSong = null;
            queue.playing = false;
            queue.connection = null;
            queue.mode = 'idle';
            queue.shuffle = false;
            queue.repeatMode = 0;
            queue.controllerMessage = null;
            queue._lastTextChannel = null;
        }
    }

    async _cleanBotMessages(textChannel) {
        try {
            const fetched = await textChannel.messages.fetch({ limit: 50 });
            const botMsgs = fetched.filter(m => m.author.bot && (Date.now() - m.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);
            if (botMsgs.size > 0) await textChannel.bulkDelete(botMsgs, true).catch(() => {});
        } catch (e) { /* silently fail */ }
    }

    // ─── Get direct stream URL (for live detection) ────────
    _getDirectUrl(url) {
        return new Promise((resolve) => {
            let resolved = false;
            const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

            const ytdlp = spawn(YT_DLP_PATH, [
                '-g', '-f', 'bestaudio/best',
                '--no-playlist', '--no-check-certificates', '--no-warnings',
                url
            ]);

            let stdout = '';
            ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
            ytdlp.stderr.on('data', () => {});
            ytdlp.on('close', () => {
                const directUrl = stdout.trim().split('\n')[0]?.trim();
                done(directUrl && directUrl.startsWith('http') ? directUrl : null);
            });
            ytdlp.on('error', () => done(null));
            setTimeout(() => { ytdlp.kill(); done(null); }, 15000);
        });
    }

    // ─── Get video title + artist from yt-dlp ──────────────
    getVideoTitle(url) {
        return new Promise((resolve) => {
            let resolved = false;
            const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

            const ytdlp = spawn(YT_DLP_PATH, [
                '--print', 'title',
                '--print', 'uploader',
                '--no-download',
                '--no-playlist',
                '--no-check-certificates',
                '--no-warnings',
                url
            ]);

            let stdout = '';
            ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
            ytdlp.stderr.on('data', () => {});
            ytdlp.on('close', () => {
                const lines = stdout.trim().split('\n');
                const title = lines[0]?.trim();
                let artist = lines[1]?.trim();
                // Clean up artist name
                if (artist) {
                    artist = artist.replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim();
                }
                if (title) {
                    done(artist && artist !== 'NA' && artist.length > 0 ? `${title} - ${artist}` : title);
                } else {
                    done(null);
                }
            });
            ytdlp.on('error', () => done(null));
            setTimeout(() => { ytdlp.kill(); done(null); }, 15000);
        });
    }

    // ─── Search YouTube via yt-dlp (replaces play-dl search) ──
    ytdlpSearch(searchQuery) {
        return new Promise((resolve) => {
            let resolved = false;
            const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

            const ytdlp = spawn(YT_DLP_PATH, [
                `ytsearch1:${searchQuery}`,
                '--print', 'webpage_url',
                '--print', 'title',
                '--print', 'uploader',
                '--no-download',
                '--no-playlist',
                '--no-check-certificates',
                '--no-warnings'
            ]);

            let stdout = '';
            ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
            ytdlp.stderr.on('data', () => {});
            ytdlp.on('close', () => {
                const lines = stdout.trim().split('\n');
                const url = lines[0]?.trim();
                const title = lines[1]?.trim();
                let artist = lines[2]?.trim();
                // Clean up artist name
                if (artist) {
                    artist = artist.replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim();
                }
                if (url && url.startsWith('http')) {
                    const fullTitle = artist && artist !== 'NA' && artist.length > 0
                        ? `${title} - ${artist}`
                        : (title || searchQuery);
                    done({ url, title: fullTitle });
                } else {
                    done(null);
                }
            });
            ytdlp.on('error', () => done(null));
            setTimeout(() => { ytdlp.kill(); done(null); }, 15000);
        });
    }

    // ─── YouTube Playlist Resolver ─────────────────────
    resolveYouTubePlaylist(playlistUrl) {
        return new Promise((resolve) => {
            let resolved = false;
            const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

            const ytdlp = spawn(YT_DLP_PATH, [
                '--flat-playlist',
                '--print', 'url',
                '--print', 'title',
                '--print', 'uploader',
                '--print', 'duration',
                '--no-download',
                '--no-check-certificates',
                '--no-warnings',
                playlistUrl
            ]);

            let stdout = '';
            ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
            ytdlp.stderr.on('data', () => {});
            ytdlp.on('close', () => {
                const lines = stdout.trim().split('\n').filter(l => l.trim());
                const tracks = [];
                // Each track outputs 4 lines: url, title, uploader, duration
                for (let i = 0; i + 3 < lines.length; i += 4) {
                    const videoId = lines[i].trim();
                    const title = lines[i + 1]?.trim() || 'Unknown';
                    let artist = lines[i + 2]?.trim() || '';
                    const duration = parseInt(lines[i + 3]?.trim()) || 0;

                    if (artist) {
                        artist = artist.replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim();
                    }

                    const url = videoId.startsWith('http')
                        ? videoId
                        : `https://www.youtube.com/watch?v=${videoId}`;

                    const fullTitle = artist && artist !== 'NA' && artist.length > 0
                        ? `${title} - ${artist}` : title;

                    tracks.push({ url, title: fullTitle, durationSec: duration });
                }
                done(tracks);
            });
            ytdlp.on('error', () => done([]));
            setTimeout(() => { ytdlp.kill(); done([]); }, 30000);
        });
    }

    // ─── Spotify Resolver (full metadata) ──────────────
    async resolveSpotify(url) {
        try {
            const fetch = require('node-fetch');
            let finalUrl = url;

            // Expand short links (spotify.link)
            if (url.includes('spotify.link')) {
                try {
                    const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const location = res.headers.get('location');
                    if (location) finalUrl = location;
                } catch (e) {
                    console.error('Error expanding spotify.link URL:', e);
                }
            }

            // Attempt official API if configured
            if (spotifyApi.isConfigured()) {
                let type = null;
                let id = null;
                
                if (finalUrl.includes('open.spotify.com')) {
                    const parts = finalUrl.split('open.spotify.com/')[1]?.split('?')[0]?.split('/');
                    if (parts && parts.length >= 2) {
                        type = parts[0];
                        id = parts[1];
                    }
                } else if (finalUrl.startsWith('spotify:')) {
                    const parts = finalUrl.split(':');
                    if (parts.length >= 3) {
                        type = parts[1];
                        id = parts[2];
                    }
                }

                if (type && id) {
                    let tracks = [];
                    console.log(`[SPOTIFY] Resolving ${type}: ${id}`);
                    if (type === 'track') {
                        const track = await spotifyApi.getTrack(id);
                        if (track) tracks = [track];
                    } else if (type === 'playlist') {
                        tracks = await spotifyApi.getPlaylist(id) || [];
                    } else if (type === 'album') {
                        tracks = await spotifyApi.getAlbum(id) || [];
                    }

                    console.log(`[SPOTIFY] Got ${tracks.length} tracks from ${type}`);

                    if (tracks.length > 0) {
                        return tracks.map(t => {
                            const name = t.name || '';
                            const allArtists = t.artists?.map(a => a.name) || [];
                            const artistStr = allArtists.join(', ');
                            const mainArtist = allArtists[0] || '';
                            const durationMs = t.duration_ms || 0;
                            const durationSec = Math.round(durationMs / 1000);
                            const albumName = t.album?.name || '';
                            const thumbnail = t.album?.images?.[0]?.url || null;

                            return {
                                name,
                                artist: artistStr,
                                mainArtist,
                                title: artistStr ? `${name} - ${artistStr}` : name,
                                durationSec,
                                albumName,
                                thumbnail,
                                // Very precise search: "Artist - Song" for exact match
                                searchQuery: mainArtist ? `${mainArtist} - ${name}` : name,
                                _source: 'official'
                            };
                        });
                    } else {
                        console.log(`[SPOTIFY] Official API failed to return tracks, falling back to scraper...`);
                    }
                }
            }

            // Fallback to scraper
            const { getTracks } = require('spotify-url-info')(fetch);
            const tracks = await getTracks(finalUrl);
            return tracks.map(t => {
                const name = t.name || '';
                const allArtists = t.artists?.map(a => a.name) || [];
                const artistStr = allArtists.join(', ');
                const mainArtist = allArtists[0] || '';
                const durationMs = t.duration_ms || t.duration || 0;
                const durationSec = Math.round(durationMs / 1000);
                const albumName = t.album?.name || '';
                const thumbnail = t.album?.images?.[0]?.url || t.coverArt?.sources?.[0]?.url || null;

                return {
                    name,
                    artist: artistStr,
                    mainArtist,
                    title: artistStr ? `${name} - ${artistStr}` : name,
                    durationSec,
                    albumName,
                    thumbnail,
                    searchQuery: mainArtist ? `${mainArtist} - ${name}` : name,
                    _source: 'scraper'
                };
            });
        } catch (e) {
            console.error('Error resolving Spotify URL:', e);
            if (!spotifyApi.isConfigured()) {
                return { error: 'NO_CREDENTIALS' };
            }
            return [];
        }
    }

    // ─── Mode Switching ────────────────────────────────────
    switchMode(guildId, newMode) {
        const queue = this.getQueue(guildId);
        if (queue.mode === newMode) return; // CRITICAL: Don't reset if already in this mode
        
        queue.epoch++;
        queue.player.stop(true);
        if (queue._ytdlpProcess) { queue._ytdlpProcess.kill(); queue._ytdlpProcess = null; }
        if (queue._leaveTimer) { clearTimeout(queue._leaveTimer); queue._leaveTimer = null; }
        queue.songs = [];
        queue.history = [];
        queue.currentSong = null;
        queue.playing = false;
        queue.mode = newMode;
        queue.controllerMessage = null;
    }

    // ─── Add Song ──────────────────────────────────────────
    async addSong(guildId, songUrl, title, requestedBy, textChannel) {
        const queue = this.getQueue(guildId);
        const currentEpoch = queue.epoch;

        if (textChannel) queue._lastTextChannel = textChannel;
        if (queue._leaveTimer) { clearTimeout(queue._leaveTimer); queue._leaveTimer = null; }

        // ── Spotify: resolve full metadata → precise YouTube search ──
        if (songUrl.includes('spotify.com') || songUrl.includes('spotify.link')) {
            const tracks = await this.resolveSpotify(songUrl);
            if (queue.epoch !== currentEpoch) return;
            
            if (tracks.error === 'NO_CREDENTIALS') {
                if (textChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('⚠️ Spotify API Credentials Missing')
                        .setDescription("The standard Spotify resolver is currently blocked on this server.\n\nTo ensure 100% stable Spotify playback, please add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to your `.env` file.\n\nYou can get them for free from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).");
                    textChannel.send({ embeds: [embed] }).catch(console.error);
                }
                return;
            }

            if (!Array.isArray(tracks) || tracks.length === 0) {
                if (textChannel) textChannel.send('❌ Failed to resolve Spotify link.').catch(console.error);
                return;
            }

            // Queue all tracks instantly with url: null (Just-In-Time resolution)
            console.log(`[PLAYLIST] Queuing ${tracks.length} Spotify tracks JIT...`);
            
            for (let i = 0; i < tracks.length; i++) {
                const tr = tracks[i];
                queue.songs.push({
                    url: null, // Resolves at playback time
                    searchQuery: tr.searchQuery,
                    title: tr.title,
                    artist: tr.artist,
                    thumbnail: tr.thumbnail,
                    albumName: tr.albumName,
                    durationSec: tr.durationSec,
                    requestedBy,
                    textChannel: i === 0 ? textChannel : null
                });
            }

            if (!queue.playing && queue.songs.length > 0) {
                this.playSong(guildId, queue.songs.shift());
            } else {
                this.updateController(guildId);
            }
            return;
        }

        // ── YouTube Playlist: resolve each video individually ──
        if ((songUrl.includes('youtube.com') || songUrl.includes('youtu.be')) && songUrl.includes('list=')) {
            console.log('[PLAYLIST] Resolving YouTube playlist...');
            const tracks = await this.resolveYouTubePlaylist(songUrl);
            if (queue.epoch !== currentEpoch) return;
            if (!tracks || tracks.length === 0) {
                if (textChannel) textChannel.send('❌ Failed to resolve YouTube playlist.').catch(console.error);
                return;
            }

            console.log(`[PLAYLIST] Found ${tracks.length} tracks`);

            // First track: play immediately
            const first = tracks[0];
            const firstSong = {
                url: first.url,
                title: first.title,
                durationSec: first.durationSec || 0,
                requestedBy,
                textChannel
            };
            queue.songs.push(firstSong);
            if (!queue.playing) {
                this.playSong(guildId, queue.songs.shift());
            } else {
                this.updateController(guildId);
            }

            // Background-load remaining tracks
            if (tracks.length > 1) {
                const epochAtStart = queue.epoch;
                (async () => {
                    for (let i = 1; i < tracks.length; i++) {
                        if (queue.epoch !== epochAtStart) return;
                        const tr = tracks[i];
                        queue.songs.push({
                            url: tr.url,
                            title: tr.title,
                            durationSec: tr.durationSec || 0,
                            requestedBy,
                            textChannel: null
                        });
                        if (!queue.playing && queue.songs.length > 0) {
                            this.playSong(guildId, queue.songs.shift());
                        }
                    }
                    // Update controller once all tracks are loaded
                    this.updateController(guildId);
                    console.log(`[PLAYLIST] All ${tracks.length} tracks queued.`);
                })();
            }
            return;
        }

        // ── Normal song — play the EXACT URL given ──
        const song = { url: songUrl, title, requestedBy, textChannel };
        queue.songs.push(song);

        if (!queue.playing) {
            this.playSong(guildId, queue.songs.shift());
        } else {
            this.updateController(guildId);
        }
    }

    // ─── Clear & Play ──────────────────────────────────────
    async clearAndPlay(guildId, songUrl, title, requestedBy, textChannel) {
        const queue = this.getQueue(guildId);
        queue.epoch++;
        if (queue._ytdlpProcess) { queue._ytdlpProcess.kill(); queue._ytdlpProcess = null; }
        queue.songs = [];
        queue.history = [];
        queue.playing = false;
        queue.currentSong = null;
        queue.player.stop(true);
        await this.addSong(guildId, songUrl, title, requestedBy, textChannel);
    }

    // ─── Play Song (PIPES audio directly — no expiring URLs) ──
    async playSong(guildId, song) {
        const queue = this.getQueue(guildId);
        const epochAtStart = queue.epoch;

        try {
            if (!song) { queue.playing = false; return; }
            if (song.textChannel) queue._lastTextChannel = song.textChannel;
            if (queue._leaveTimer) { clearTimeout(queue._leaveTimer); queue._leaveTimer = null; }

            // Kill any old yt-dlp process FIRST
            if (queue._ytdlpProcess) {
                queue._ytdlpProcess.kill();
                queue._ytdlpProcess = null;
            }

            // ── Just-In-Time Resolution for Spotify ──
            if (!song.url && song.searchQuery) {
                console.log(`[SPOTIFY JIT] Resolving YouTube URL for: "${song.searchQuery}"`);
                
                // Show loading state in controller
                queue.currentSong = song;
                queue.playing = true;
                this.updateController(guildId);

                const result = await this.ytdlpSearch(song.searchQuery);
                if (queue.epoch !== epochAtStart) return;

                if (!result) {
                    console.error(`[SPOTIFY JIT] Failed to find YouTube video for: "${song.searchQuery}"`);
                    if (queue.songs.length > 0) {
                        this.playSong(guildId, queue.songs.shift());
                    } else {
                        queue.playing = false;
                        queue.currentSong = null;
                    }
                    return;
                }
                song.url = result.url;
            }

            if (!song.url) { queue.playing = false; return; }

            console.log(`[PLAY] Playing: "${song.title}" | URL: ${song.url}`);
            queue.currentSong = song;
            queue.playing = true;

            let resource;

            if (song.url.includes('youtube.com') || song.url.includes('youtu.be')) {
                // Step 1: Get direct URL to detect if it's a live stream
                const directUrl = await this._getDirectUrl(song.url);

                if (directUrl && (directUrl.includes('.m3u8') || directUrl.includes('/live'))) {
                    // LIVE STREAM → use URL directly (FFmpeg handles HLS/m3u8)
                    console.log('[PLAY] Live stream detected, using direct URL');
                    if (queue.epoch !== epochAtStart) return;
                    resource = createAudioResource(directUrl, { inputType: 'arbitrary', inlineVolume: true });
                } else {
                    // NORMAL VIDEO → pipe through yt-dlp (no URL expiry)
                    const ytdlp = spawn(YT_DLP_PATH, [
                        '-f', 'bestaudio/best',
                        '-o', '-',
                        '--no-playlist',
                        '--no-check-certificates',
                        '--no-warnings',
                        song.url
                    ]);

                    queue._ytdlpProcess = ytdlp;
                    ytdlp.stdout.on('error', () => {});
                    ytdlp.stderr.on('data', (data) => {
                        const msg = data.toString().trim();
                        if (msg && !msg.includes('WARNING') && !msg.includes('[download]')
                            && !msg.includes('[ExtractAudio]') && !msg.includes('Broken pipe')
                            && !msg.includes('unable to write data')) {
                            console.error('[yt-dlp]', msg);
                        }
                    });

                    if (queue.epoch !== epochAtStart) { ytdlp.kill(); return; }
                    resource = createAudioResource(ytdlp.stdout, { inputType: 'arbitrary', inlineVolume: true });
                }
            } else {
                // Direct stream URL (radio, etc.)
                resource = createAudioResource(song.url, { inputType: 'arbitrary', inlineVolume: true });
            }

            if (queue.epoch !== epochAtStart) return;

            resource.volume.setVolume(queue.volume);
            queue.player.play(resource);
            console.log(`[PLAY] Now playing: "${song.title}"`);
            this.updateController(guildId);

        } catch (error) {
            console.error('Error playing song:', error);
            queue.playing = false;
            if (queue.songs.length > 0) this.playSong(guildId, queue.songs.shift());
        }
    }

    // ─── Skip / Next ───────────────────────────────────────
    skip(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue.playing) return false;
        if (queue._ytdlpProcess) { queue._ytdlpProcess.kill(); queue._ytdlpProcess = null; }
        queue.player.stop();
        return true;
    }

    // ─── Previous ──────────────────────────────────────────
    previous(guildId) {
        const queue = this.getQueue(guildId);
        if (queue.history.length === 0) return false;
        if (queue._ytdlpProcess) { queue._ytdlpProcess.kill(); queue._ytdlpProcess = null; }
        if (queue.currentSong) queue.songs.unshift(queue.currentSong);
        const prev = queue.history.pop();
        this.playSong(guildId, prev);
        return true;
    }

    // ─── Toggle Pause ──────────────────────────────────────
    togglePause(guildId) {
        const queue = this.getQueue(guildId);
        if (queue.player.state.status === AudioPlayerStatus.Paused) {
            queue.player.unpause();
            return 'resumed';
        } else if (queue.player.state.status === AudioPlayerStatus.Playing) {
            queue.player.pause();
            return 'paused';
        }
        return null;
    }

    toggleShuffle(guildId) {
        const queue = this.getQueue(guildId);
        queue.shuffle = !queue.shuffle;
        return queue.shuffle;
    }

    cycleRepeat(guildId) {
        const queue = this.getQueue(guildId);
        queue.repeatMode = (queue.repeatMode + 1) % 3;
        return queue.repeatMode;
    }

    // ─── Controller Embed ──────────────────────────────────
    buildControllerEmbed(guildId) {
        const queue = this.getQueue(guildId);
        const song = queue.currentSong;
        const modeColors = { play: 0x7C3AED, lofi: 0x10B981, radio: 0xEF4444, idle: 0x6B7280 };
        const repeatLabels = ['Off', '🔂 Track', '🔁 Queue'];
        const isPaused = queue.player.state.status === AudioPlayerStatus.Paused;

        const embed = new EmbedBuilder().setColor(modeColors[queue.mode] || 0x7C3AED);

        if (song) {
            embed.setAuthor({ name: '🎶 Now Playing' });
            embed.setTitle(`${isPaused ? '⏸️' : '▶️'} ${song.title}`);

            // Show album art if available (Spotify tracks)
            if (song.thumbnail) {
                embed.setThumbnail(song.thumbnail);
            }

            const descParts = [];

            // Show artist separately if available
            if (song.artist) {
                descParts.push(`🎤 **Artist:** ${song.artist}`);
            }
            if (song.albumName) {
                descParts.push(`💿 **Album:** ${song.albumName}`);
            }
            if (song.durationSec && song.durationSec > 0) {
                const mins = Math.floor(song.durationSec / 60);
                const secs = song.durationSec % 60;
                descParts.push(`⏱️ **Duration:** ${mins}:${secs.toString().padStart(2, '0')}`);
            }

            if (song.requestedBy && song.requestedBy !== 'AutoJoin') {
                descParts.push(`\nRequested by <@${song.requestedBy}>`);
            }

            // Show upcoming queue
            if (queue.songs.length > 0) {
                descParts.push('');
                descParts.push('**⏳ Up Next:**');
                const showCount = Math.min(queue.songs.length, 5);
                for (let i = 0; i < showCount; i++) {
                    descParts.push(`${i + 1}. ${queue.songs[i].title}`);
                }
                if (queue.songs.length > 5) {
                    descParts.push(`*...and ${queue.songs.length - 5} more*`);
                }
            }
            if (descParts.length > 0) embed.setDescription(descParts.join('\n'));
        } else {
            embed.setTitle('💤 Nothing playing');
        }

        const statusParts = [];
        if (queue.songs.length > 0) statusParts.push(`📋 Queue: ${queue.songs.length}`);
        if (queue.repeatMode > 0) statusParts.push(`${repeatLabels[queue.repeatMode]}`);
        if (queue.shuffle) statusParts.push('🔀 Shuffle');
        if (statusParts.length > 0) embed.setFooter({ text: statusParts.join('  │  ') });

        return embed;
    }

    buildControllerButtons(guildId) {
        const queue = this.getQueue(guildId);
        const isPaused = queue.player.state.status === AudioPlayerStatus.Paused;

        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ctrl_prev').setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary).setDisabled(queue.history.length === 0),
            new ButtonBuilder().setCustomId('ctrl_pause').setEmoji(isPaused ? '▶️' : '⏸️')
                .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ctrl_next').setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary).setDisabled(queue.songs.length === 0 && queue.repeatMode === 0),
            new ButtonBuilder().setCustomId('ctrl_repeat').setEmoji('🔁')
                .setStyle(queue.repeatMode > 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ctrl_shuffle').setEmoji('🔀')
                .setStyle(queue.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary),
        );
    }

    async updateController(guildId) {
        const queue = this.getQueue(guildId);
        if (queue.mode === 'radio' || queue.mode === 'lofi') return;

        const textChannel = queue.currentSong?.textChannel || queue._lastTextChannel || queue.controllerMessage?.channel;
        if (!textChannel) return;

        const embed = this.buildControllerEmbed(guildId);
        const row = this.buildControllerButtons(guildId);

        try {
            if (queue.controllerMessage) await queue.controllerMessage.delete().catch(() => {});
            const msg = await textChannel.send({ embeds: [embed], components: [row] });
            queue.controllerMessage = msg;
        } catch (err) {
            console.error('[CONTROLLER] Error:', err.message);
        }
    }
}

module.exports = new QueueManager();
