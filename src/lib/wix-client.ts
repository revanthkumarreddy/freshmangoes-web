import { createClient, OAuthStrategy } from '@wix/sdk';
import { products } from '@wix/stores';
import { currentCart, checkout, orders } from '@wix/ecom';
import { redirects } from '@wix/redirects';
import { members } from '@wix/members';

const clientId = import.meta.env.PUBLIC_WIX_CLIENT_ID;

if (!clientId) {
  throw new Error(
    'Missing PUBLIC_WIX_CLIENT_ID. Add it to your .env file (see .env.example).'
  );
}

/**
 * Browser-safe Wix SDK client.
 * Uses the OAuth visitor strategy — no secret required.
 * Tokens (visitor + member) are stored in localStorage automatically.
 */
export const wixClient = createClient({
  modules: { products, currentCart, checkout, orders, redirects, members },
  auth: OAuthStrategy({
    clientId,
    tokens: loadTokens(),
  }),
});

function loadTokens() {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem('wix:tokens');
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

if (typeof window !== 'undefined') {
  // Persist refreshed visitor tokens so the cart sticks across reloads.
  // The SDK exposes the current tokens via getTokens().
  // We hook into a microtask after each request via a tiny interval — cheap & reliable.
  let last = '';
  setInterval(() => {
    try {
      const t = wixClient.auth.getTokens?.();
      const s = t ? JSON.stringify(t) : '';
      if (s && s !== last) {
        window.localStorage.setItem('wix:tokens', s);
        last = s;
      }
    } catch {
      /* ignore */
    }
  }, 4000);
}

/** Instantly commit active SDK tokens to localStorage */
export function persistTokens() {
  if (typeof window === 'undefined') return;
  try {
    const t = wixClient.auth.getTokens?.();
    if (t) {
      window.localStorage.setItem('wix:tokens', JSON.stringify(t));
    }
  } catch (err) {
    console.error('[WixClient] Failed to persist tokens:', err);
  }
}

/** Check if the current visitor has member tokens (logged in). */
export function isLoggedIn(): boolean {
  try {
    return wixClient.auth.loggedIn();
  } catch {
    return false;
  }
}

/** Fetch the current logged-in member's profile. Returns null if not logged in. */
export async function getCurrentMember() {
  try {
    if (!isLoggedIn()) return null;
    const { member } = await wixClient.members.getCurrentMember({
      fieldsets: ['FULL'],
    });
    return member ?? null;
  } catch {
    return null;
  }
}

export type WixClient = typeof wixClient;
