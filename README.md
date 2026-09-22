# LocalProfileEditor

A Vencord userplugin for custom and shared Discord profiles.

## Features

- Custom profile badges
- Hide/show supported native Discord badges locally
- Custom profile colors
- Custom HTTPS banner
- Shared profiles between LocalProfileEditor users
- Discord OAuth authentication for publishing
- Per-account sync tokens when switching Discord accounts
- Public profile viewing; authentication is required only to publish your own profile

## How it works

Local changes are applied by the Vencord userplugin. When sharing is enabled and the user authenticates with Discord, the plugin publishes that user's selected profile data to the LocalProfileEditor Worker. Other LocalProfileEditor users can then retrieve and display the shared profile.

Users without LocalProfileEditor will continue to see the normal Discord profile.

## Installation

This is a Vencord **userplugin**, so a Vencord source installation is required.

1. Place the plugin source in:
   `Vencord/src/userplugins/LocalProfileEditor/`
2. Build Vencord.
3. Inject/reinstall the built Vencord version as required by your setup.
4. Enable **LocalProfileEditor** in Vencord's Plugins settings.

The plugin source files are in the `src/` directory of this repository.

## Shared profiles

Viewing shared profiles does not require authentication.

To publish your own shared profile, authenticate through the LocalProfileEditor Discord OAuth flow and paste the token returned for that Discord account into the plugin's **Sync Token** setting.

Each Discord account has its own token. Never share your sync token.

## Server

The Cloudflare Worker source is provided in `server/worker.js`.

It expects these Cloudflare bindings/environment variables:

- `DB` — D1 database binding
- `DISCORD_CLIENT_ID` — Discord application client ID
- `DISCORD_CLIENT_SECRET` — secret
- `SYNC_SECRET` — secret used to sign LocalProfileEditor sync tokens

Do not commit actual secret values.

The D1 `profiles` table uses:

```sql
CREATE TABLE profiles (
    user_id TEXT PRIMARY KEY,
    badges TEXT NOT NULL DEFAULT '[]',
    banner_url TEXT,
    primary_color TEXT,
    accent_color TEXT,
    updated_at INTEGER NOT NULL
);
```

## Privacy and security

The public profile endpoint exposes profile customization data that a user has published, indexed by Discord user ID. OAuth is used to verify that a user can publish only to their own Discord ID.

Sync tokens and Discord/Cloudflare secrets must never be committed to the repository.

## Creator

sxfo
