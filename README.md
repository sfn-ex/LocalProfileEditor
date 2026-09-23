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

LocalProfileEditor is a Vencord **userplugin**, so a Vencord source installation is required.

### Recommended installation

1. Download `LocalProfileEditorv1.0.1.zip` from the latest GitHub Release.
2. Extract the ZIP.
3. Place the `LocalProfileEditor` folder inside:
   `Vencord/src/userplugins/`
4. Open a terminal in your Vencord folder and build Vencord:
   `pnpm build`
5. Inject/reinstall Vencord if required:
   `pnpm inject`
6. Restart Discord.
7. Open **Settings → Vencord → Plugins** and enable **LocalProfileEditor**.

The final structure should look like:

`Vencord/src/userplugins/LocalProfileEditor/index.tsx`

`Vencord/src/userplugins/LocalProfileEditor/native.ts`

### Manual installation

Alternatively, copy `src/index.tsx` and `src/native.ts` from this repository into:

`Vencord/src/userplugins/LocalProfileEditor/`

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