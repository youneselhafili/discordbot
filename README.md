# GS - Discord Music Bot

A Discord music bot built with discord.js featuring playback, queue management, radio, and lofi streams.

## Features

- Music playback from YouTube and Spotify
- Queue management (skip, shuffle, repeat, clear)
- 24/7 lofi radio
- Auto-join voice channels
- Volume control
- User library system

## Commands

| Command | Description |
|---------|-------------|
| `/play` | Play a song or playlist |
| `/skip` | Skip current track |
| `/pause` | Pause playback |
| `/volume` | Adjust volume |
| `/queue` | View the queue |
| `/shuffle` | Shuffle the queue |
| `/repeat` | Toggle repeat mode |
| `/clear` | Clear the queue |
| `/join` | Join your voice channel |
| `/leave` | Leave the voice channel |
| `/autojoin` | Toggle auto-join on voice entry |
| `/lofi` | Start lofi radio stream |
| `/radio` | Start a radio station |
| `/library` | Manage your saved tracks |
| `/adduser` | Register user for library features |
| `/settings` | Configure bot settings |

## Setup

1. Clone the repo
2. Run `npm install`
3. Copy `.env` and fill in your tokens:
   - `DISCORD_TOKEN` - Your bot token from Discord Developer Portal
   - `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` - Spotify API credentials
4. Run `node index.js`
