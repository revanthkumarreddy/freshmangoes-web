/**
 * Build-time Wix SDK client (no browser, no tokens persistence).
 * Used by Astro `getStaticPaths` and SSG product/category fetching.
 */
import { createClient, OAuthStrategy } from '@wix/sdk';
import { products } from '@wix/stores';

const clientId = import.meta.env.PUBLIC_WIX_CLIENT_ID;

if (!clientId) {
  throw new Error('Missing PUBLIC_WIX_CLIENT_ID at build time.');
}

export const wixServer = createClient({
  modules: { products },
  auth: OAuthStrategy({ clientId }),
});
