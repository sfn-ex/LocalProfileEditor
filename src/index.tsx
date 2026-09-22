/*
 * LocalProfileEditor v1.0 - Vencord userplugin
 * Creator: sxfo
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { UserStore } from "@webpack/common";
import virtualMerge from "virtual-merge";

import { BadgeManager } from "./BadgeManager";

const Native = VencordNative.pluginHelpers.LocalProfileEditor as PluginNative<typeof import("./native")>;

const SHARED_PROFILE_API = "https://local-profile-editor.esclavedelargent.workers.dev";
const SHARED_PROFILE_TTL = 5 * 60 * 1000;
const PUBLISH_INTERVAL = 5000;

function getLocalUserId() {
    return UserStore.getCurrentUser()?.id ?? null;
}

type SharedProfile = {
    found: true;
    userId: string;
    badges: string[];
    bannerUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    updatedAt: number;
};

const sharedProfiles = new Map<string, SharedProfile>();
const sharedProfileFetchedAt = new Map<string, number>();
const sharedProfileRequests = new Map<string, Promise<void>>();

function isDiscordId(value: unknown): value is string {
    return typeof value === "string" && /^\d{17,20}$/.test(value);
}

function isHttpsUrl(value: unknown): value is string {
    return typeof value === "string" && /^https:\/\/[^\s]+$/i.test(value);
}

function requestSharedProfile(userId: string) {
    if (!isDiscordId(userId) || userId === getLocalUserId()) return;
    const last = sharedProfileFetchedAt.get(userId) ?? 0;
    if (Date.now() - last < SHARED_PROFILE_TTL || sharedProfileRequests.has(userId)) return;

    const request = Native.getSharedProfile(`${SHARED_PROFILE_API}/profile/${userId}`)
        .then(result => {
            sharedProfileFetchedAt.set(userId, Date.now());

            if (result.status === 404) {
                sharedProfiles.delete(userId);
                return;
            }
            if (result.status !== 200 || !result.body) return;

            const value: any = JSON.parse(result.body);
            if (!value || value.found !== true || value.userId !== userId) return;

            const badges = Array.isArray(value.badges)
                ? value.badges.filter((id: unknown): id is string => typeof id === "string" && !!BADGES[id])
                : [];

            sharedProfiles.set(userId, {
                found: true,
                userId,
                badges,
                bannerUrl: value.bannerUrl == null ? null : isHttpsUrl(value.bannerUrl) ? value.bannerUrl : null,
                primaryColor: typeof value.primaryColor === "string" ? value.primaryColor : null,
                accentColor: typeof value.accentColor === "string" ? value.accentColor : null,
                updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0
            });
        })
        .catch(() => {})
        .finally(() => sharedProfileRequests.delete(userId));

    sharedProfileRequests.set(userId, request);
}


export type BadgeDef = {
    label: string;
    icon: string;
    group: "Subscriptions" | "Discord" | "HypeSquad" | "Legacy";
};

export const BADGES: Record<string, BadgeDef> = {
    nitroClassic: { label: "Old / Classic Nitro", group: "Subscriptions", icon: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png" },
    nitro: { label: "Nitro • Under 1 Month", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/nitro.png" },
    nitroBronze: { label: "Nitro Bronze", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/nitro_bronze.png" },
    nitroSilver: { label: "Nitro Silver", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/nitro_silver.png" },
    nitroGold: { label: "Nitro Gold", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/nitro_gold.png" },
    nitroPlatinum: { label: "Nitro Platinum", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/nitro_platinum.png" },
    nitroDiamond: { label: "Nitro Diamond", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/nitro_diamond.png" },
    nitroEmerald: { label: "Nitro Emerald", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/nitro_emerald.png" },
    nitroRuby: { label: "Nitro Ruby", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/nitro_ruby.png" },
    nitroOpal: { label: "Nitro Opal", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/nitro_opal.png" },
    booster1: { label: "Server Booster • 1 Month", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/boost_1_months.png" },
    booster2: { label: "Server Booster • 2 Months", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/boost_2_months.png" },
    booster3: { label: "Server Booster • 3 Months", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/boost_3_months.png" },
    booster6: { label: "Server Booster • 6 Months", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/boost_6_months.png" },
    booster9: { label: "Server Booster • 9 Months", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/boost_9_months.png" },
    booster12: { label: "Server Booster • 12 Months", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/boost_12_months.png" },
    booster15: { label: "Server Booster • 15 Months", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/boost_15_months.png" },
    booster18: { label: "Server Booster • 18 Months", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/boost_18_months.png" },
    booster24: { label: "Server Booster • 24 Months", group: "Subscriptions", icon: "https://cdn.jsdelivr.net/gh/dev-hoehle/discord-badges@main/png/boost_24_months.png" },
    quest: { label: "Discord Quests", group: "Discord", icon: "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png" },
    orbs: { label: "Orbs", group: "Discord", icon: "https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png" },
    legacyUsername: { label: "Legacy Username", group: "Legacy", icon: "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png" },
    staff: { label: "Discord Staff", group: "Discord", icon: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png" },
    bugHunter1: { label: "Bug Hunter", group: "Discord", icon: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png" },
    bugHunter2: { label: "Golden Bug Hunter", group: "Discord", icon: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png" },
    hypesquad: { label: "HypeSquad Events", group: "HypeSquad", icon: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png" },
    bravery: { label: "HypeSquad Bravery", group: "HypeSquad", icon: "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png" },
    brilliance: { label: "HypeSquad Brilliance", group: "HypeSquad", icon: "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png" },
    balance: { label: "HypeSquad Balance", group: "HypeSquad", icon: "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png" },
    earlySupporter: { label: "Early Supporter", group: "Legacy", icon: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png" },
    partner: { label: "Partnered Server Owner", group: "Legacy", icon: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png" },
    moderatorAlumni: { label: "Moderator Program Alumni", group: "Legacy", icon: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png" }
};

export const settings = definePluginSettings({
    badgeSelection: {
        type: OptionType.STRING,
        description: "Internal badge selection used by the visual manager.",
        hidden: true,
        default: ""
    },
    hiddenNativeBadges: {
        type: OptionType.STRING,
        description: "Internal list of native Discord badges hidden locally.",
        hidden: true,
        default: ""
    },
    enableSharedProfiles: {
        type: OptionType.BOOLEAN,
        description: "Publish your profile and display profiles shared by other LocalProfileEditor users.",
        default: true
    },
    syncTokens: {
        type: OptionType.STRING,
        description: "Internal per-account sync token map.",
        hidden: true,
        default: "{}"
    },
    syncToken: {
        type: OptionType.STRING,
        description: "Private sync token for the currently logged-in Discord account.",
        default: "",
        onChange(value: string) {
            const userId = getLocalUserId();
            if (!isDiscordId(userId)) return;

            let tokens: Record<string, string> = {};
            try {
                const parsed = JSON.parse(settings.store.syncTokens || "{}");
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
                    tokens = parsed;
            } catch {}

            const token = value.trim();
            if (token) tokens[userId] = token;
            else delete tokens[userId];

            settings.store.syncTokens = JSON.stringify(tokens);
        }
    },
    enableCustomBanner: {
        type: OptionType.BOOLEAN,
        description: "Use a local custom profile banner.",
        default: false,
        restartNeeded: true
    },
    customBannerUrl: {
        type: OptionType.STRING,
        description: "Direct HTTPS image/GIF URL for your local profile banner.",
        default: "",
        restartNeeded: true
    },
    enableProfileColors: {
        type: OptionType.BOOLEAN,
        description: "Override your profile colors locally",
        default: false
    },
    primaryColor: {
        type: OptionType.STRING,
        description: "Primary profile color (#RRGGBB)",
        default: "#5865F2"
    },
    accentColor: {
        type: OptionType.STRING,
        description: "Accent profile color (#RRGGBB)",
        default: "#EB459E"
    }
});

export function getSelected(): string[] {
    const raw = settings.store.badgeSelection;
    if (typeof raw !== "string" || !raw.trim()) return [];
    return raw.split(",").map(x => x.trim()).filter(x => Boolean(BADGES[x]));
}

export function setSelected(ids: string[]) {
    settings.store.badgeSelection = [...new Set(ids.filter(x => Boolean(BADGES[x])))].join(",");
}

const NATIVE_TO_LOCAL: Record<string, string> = {
    staff: "staff",
    partner: "partner",
    hypesquad: "hypesquad",
    hypesquad_house_1: "bravery",
    hypesquad_house_2: "brilliance",
    hypesquad_house_3: "balance",
    early_supporter: "earlySupporter",
    bug_hunter_level_1: "bugHunter1",
    bug_hunter_level_2: "bugHunter2",
    certified_moderator: "moderatorAlumni",
    moderator_programs_alumni: "moderatorAlumni",
    active_developer: "activeDeveloper",
    quest_completed: "quest",
    quest: "quest",
    orbs: "orbs",
    orb: "orbs",
    discord_orbs: "orbs",
    nitro: "nitro",
    premium: "nitro",
    nitro_classic: "nitroClassic",
    premium_classic: "nitroClassic",
    legacy_username: "legacyUsername",
    legacy_username_badge: "legacyUsername",
    originally_known_as: "legacyUsername",
    pomelo: "legacyUsername"
};

let detectedOwnedBadges = new Set<string>();

function normalizeNativeBadgeId(id: unknown, description?: unknown): string | null {
    if (typeof id === "string") {
        const mapped = NATIVE_TO_LOCAL[id] ?? (BADGES[id] ? id : null);
        if (mapped) return mapped;
    }

    if (typeof description === "string") {
        const d = description.toLowerCase();
        if (d.includes("orb")) return "orbs";
        if (d.includes("quest")) return "quest";
        if (d.includes("nitro classic") || d.includes("classic nitro")) return "nitroClassic";
        if (
            d.includes("legacy username") ||
            d.includes("originally known as") ||
            d.startsWith("originally known as")
        ) return "legacyUsername";
        if (d.includes("nitro")) return "nitro";
    }

    return null;
}

function readHiddenNative(): string[] {
    const raw = settings.store.hiddenNativeBadges;
    if (typeof raw !== "string" || !raw.trim()) return [];
    return raw.split(",").map(x => x.trim()).filter(Boolean);
}

export function getHiddenNative(): string[] {
    return readHiddenNative();
}

export function setHiddenNative(ids: string[]) {
    settings.store.hiddenNativeBadges = [...new Set(ids.filter(Boolean))].join(",");
}

export function getOwnedBadgeIds(): Set<string> {
    return new Set(detectedOwnedBadges);
}


function getAccountSyncToken(userId: string | null) {
    if (!isDiscordId(userId)) return "";

    try {
        const parsed = JSON.parse(settings.store.syncTokens || "{}");
        const token = parsed?.[userId];
        return typeof token === "string" ? token.trim() : "";
    } catch {
        return "";
    }
}

let activeSyncUserId: string | null = null;

function refreshSyncTokenForCurrentAccount() {
    const userId = getLocalUserId();
    if (userId === activeSyncUserId) return;

    activeSyncUserId = userId;

    // Never carry a token from one Discord account into another account.
    // Existing v1.0 global tokens are deliberately not migrated because
    // their authenticated owner cannot be proven locally.
    settings.store.syncToken = getAccountSyncToken(userId);
    lastPublishedPayload = "";
}

let publishTimer: ReturnType<typeof setInterval> | null = null;
let lastPublishedPayload = "";
let publishInFlight = false;

function buildPublishPayload() {
    const userId = getLocalUserId();
    if (!isDiscordId(userId)) return null;

    return {
        userId,
        badges: getSelected(),
        bannerUrl: settings.store.enableCustomBanner && isHttpsUrl(settings.store.customBannerUrl.trim())
            ? settings.store.customBannerUrl.trim()
            : null,
        primaryColor: settings.store.enableProfileColors ? settings.store.primaryColor : null,
        accentColor: settings.store.enableProfileColors ? settings.store.accentColor : null
    };
}

async function publishOwnProfile(force = false) {
    if (!settings.store.enableSharedProfiles || publishInFlight) return;

    const userId = getLocalUserId();
    const token = getAccountSyncToken(userId);
    if (!token) return;

    const payload = buildPublishPayload();
    if (!payload) return;

    const serialized = JSON.stringify(payload);
    if (!force && serialized === lastPublishedPayload) return;

    publishInFlight = true;
    try {
        const result = await Native.putSharedProfile(
            `${SHARED_PROFILE_API}/profile/${payload.userId}`,
            token,
            serialized
        );
        if (result.status >= 200 && result.status < 300)
            lastPublishedPayload = serialized;
    } catch {
        // Sync failure must never break local profile customization.
    } finally {
        publishInFlight = false;
    }
}

const registeredBadges: ProfileBadge[] = [];

function parseHex(value: string): number | null {
    const clean = value.trim().replace(/^#/, "");
    return /^[0-9a-fA-F]{6}$/.test(clean) ? parseInt(clean, 16) : null;
}


// Discord badge display priority. Variants in the same family share the same slot.
// BadgeAPI START badges are prepended, so registerBadges() registers this list in reverse.
const BADGE_ORDER = [
    "staff",
    "partner",
    "hypesquad",
    "bugHunter1", "bugHunter2",
    "bravery", "brilliance", "balance",
    "earlySupporter",
    "verifiedDeveloper",
    "moderatorAlumni",
    "activeDeveloper",
    "legacyUsername",
    "nitroClassic", "nitro", "nitroBronze", "nitroSilver", "nitroGold",
    "nitroPlatinum", "nitroDiamond", "nitroEmerald", "nitroRuby", "nitroOpal",
    "booster1", "booster2", "booster3", "booster6", "booster9",
    "booster12", "booster15", "booster18", "booster24",
    "quest", "orbs"
] as const;

function registerBadges() {
    const orderedIds = [
        ...BADGE_ORDER.filter(id => BADGES[id]),
        ...Object.keys(BADGES).filter(id => !BADGE_ORDER.includes(id as any))
    ];

    // BadgePosition.START uses unshift internally, so reverse registration keeps
    // the final visible order equal to BADGE_ORDER.
    for (const id of orderedIds.reverse()) {
        const info = BADGES[id];
        const badge: ProfileBadge = {
            id: `local-profile-editor-${id}`,
            key: `LOCAL_PROFILE_EDITOR_${id.toUpperCase()}`,
            description: `${info.label} • Local`,
            iconSrc: info.icon,
            position: BadgePosition.START,
            shouldShow: ({ userId }) => {
                if (userId === getLocalUserId()) return getSelected().includes(id);
                if (!settings.store.enableSharedProfiles) return false;

                requestSharedProfile(userId);
                return sharedProfiles.get(userId)?.badges.includes(id) ?? false;
            }
        };

        registeredBadges.push(badge);
        addProfileBadge(badge);
    }
}

export default definePlugin({
    name: "LocalProfileEditor",
    description: "Customize and securely share badges, profile colors and banners. v1.0",
    authors: [{ name: "sxfo", id: 689089699461070890n }],
    dependencies: ["BadgeAPI"],
    settings,

    settingsAboutComponent: ErrorBoundary.wrap(BadgeManager, {
        noop: true
    }),

    patches: [
        {
            // Same banner render path used by Vencord's USRBG plugin.
            find: ':"SHOULD_LOAD");',
            replacement: {
                match: /\i(?:\?)?.getPreviewBanner\(\i,\i,\i\)(?=.{0,100}"COMPLETE")/,
                replace: "$self.patchBannerUrl(arguments[0])||$&"
            }
        },
        {
        find: "UserProfileStore",
        replacement: {
            match: /(?<=getUserProfile\(\i\){return )(.+?)(?=})/,
            replace: "$self.profileHook($1)"
        }
    }],

    start() {
        registerBadges();

        // Clear the old v1.0 global token on upgrade. Each account must
        // authenticate once so its token is stored under the correct user ID.
        activeSyncUserId = null;
        refreshSyncTokenForCurrentAccount();

        publishTimer = setInterval(() => {
            refreshSyncTokenForCurrentAccount();
            void publishOwnProfile();
        }, PUBLISH_INTERVAL);

        setTimeout(() => {
            refreshSyncTokenForCurrentAccount();
            void publishOwnProfile(true);
        }, 1500);
    },

    stop() {
        if (publishTimer) clearInterval(publishTimer);
        publishTimer = null;

        for (const badge of registeredBadges) removeProfileBadge(badge);
        registeredBadges.length = 0;
    },

    patchBannerUrl({ displayProfile }: any) {
        const userId = displayProfile?.userId;
        if (!isDiscordId(userId)) return;

        if (userId === getLocalUserId()) {
            if (!settings.store.enableCustomBanner) return;
            const url = settings.store.customBannerUrl.trim();
            if (!isHttpsUrl(url)) return;
            return url;
        }

        if (!settings.store.enableSharedProfiles) return;

        requestSharedProfile(userId);
        return sharedProfiles.get(userId)?.bannerUrl ?? undefined;
    },

    profileHook(profile: any) {
        if (!profile) return profile;

        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return profile;

        // Scope every profile modification to the target profile itself.
        // Without this check, opening another user's profile while logged into
        // TARGET_USER_ID can incorrectly apply our local colors/badge filtering.
        const profileUserId =
            profile.userId ??
            profile.user?.id ??
            profile.user?.userId;

        if (!isDiscordId(profileUserId)) return profile;

        if (profileUserId !== currentUser.id) {
            if (!settings.store.enableSharedProfiles) return profile;
            requestSharedProfile(profileUserId);
            const shared = sharedProfiles.get(profileUserId);
            if (!shared) return profile;

            const primary = shared.primaryColor ? parseHex(shared.primaryColor) : null;
            const accent = shared.accentColor ? parseHex(shared.accentColor) : null;

            if (primary !== null && accent !== null) {
                return virtualMerge(profile, {
                    themeColors: [primary, accent]
                });
            }

            return profile;
        }

        let result = profile;


        // Capture Discord's native profile badges before applying our local filter.
        if (Array.isArray(profile.badges)) {
            const owned = new Set<string>();

            for (const badge of profile.badges) {
                const localId = normalizeNativeBadgeId(badge?.id, badge?.description);
                if (localId) owned.add(localId);
            }

            detectedOwnedBadges = owned;

            const hidden = new Set(readHiddenNative());
            if (hidden.size) {
                result = virtualMerge(result, {
                    badges: profile.badges.filter((badge: any) => {
                        const localId = normalizeNativeBadgeId(badge?.id, badge?.description);
                        return !localId || !hidden.has(localId);
                    })
                });
            }
        }

        if (settings.store.enableProfileColors) {
            const primary = parseHex(settings.store.primaryColor);
            const accent = parseHex(settings.store.accentColor);

            if (primary !== null && accent !== null) {
                result = virtualMerge(result, {
                    premiumType: 2,
                    themeColors: [primary, accent]
                });
            }
        }

        return result;
    }
});
