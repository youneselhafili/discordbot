# GS - Discord Fun Bot

A Discord bot for voice channel fun: welcome messages with action buttons, random disconnects, role management, and voting.

## Commands

| Command | Description |
|---------|-------------|
| `/setup` | Configure welcome message with action buttons (disconnect, mute, etc.) for voice channels |
| `/l7am9a` | Randomly disconnect 1-3 users from your voice channel |
| `/wa3r` | Configure role stripping + role assignment when users join voice channels |
| `/vote` | Configure vote-to-kick for voice channels (members vote AH/LA to keep or kick) |

## Setup

1. Clone the repo
2. Run `npm install`
3. Copy `.env` and fill in:
   - `DISCORD_TOKEN` - Your bot token from Discord Developer Portal
4. Run `node index.js`
