/**
 * Tiny façade over Wix `currentCart` SDK for the React components.
 * No external state library — we just emit a `cart:updated` window event
 * that the header (and any other listener) can react to.
 */
import { wixClient, persistTokens } from './wix-client';

export type LineItemInput = {
  catalogItemId: string;
  variantId?: string;
  quantity: number;
  options?: Record<string, string>;
};

const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';

export async function getCart() {
  try {
    return await wixClient.currentCart.getCurrentCart();
  } catch {
    return null;
  }
}

export async function addToCart(input: LineItemInput) {
  const actualVariantId = input.variantId && input.variantId !== '00000000-0000-0000-0000-000000000000' && input.variantId !== 'default' ? input.variantId : undefined;

  const lineItem = {
    catalogReference: {
      catalogItemId: input.catalogItemId,
      appId: STORES_APP_ID,
      ...(actualVariantId 
          ? { options: { variantId: actualVariantId } } 
          : input.options 
            ? { options: { options: input.options } } 
            : {})
    },
    quantity: input.quantity,
  };

  console.log('[cart] addToCart payload:', JSON.stringify({ lineItems: [lineItem] }, null, 2));
  console.log('[cart] STORES_APP_ID:', STORES_APP_ID);

  try {
    const res = await wixClient.currentCart.addToCurrentCart({
      lineItems: [lineItem],
    });
    console.log('[cart] addToCurrentCart success:', JSON.stringify(res?.cart?.lineItems?.length, null, 2), 'items in cart');
    persistTokens();
    window.dispatchEvent(new CustomEvent('cart:updated'));
    return res;
  } catch (err: any) {
    console.error('[cart] addToCurrentCart FAILED:', err);
    console.error('[cart] Error name:', err?.name);
    console.error('[cart] Error message:', err?.message);
    console.error('[cart] Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    throw err;
  }
}

export async function updateLineItem(lineItemId: string, quantity: number) {
  const res = await wixClient.currentCart.updateCurrentCartLineItemQuantity([
    { _id: lineItemId, quantity },
  ]);
  persistTokens();
  window.dispatchEvent(new CustomEvent('cart:updated'));
  return res;
}

export async function removeLineItem(lineItemId: string) {
  const res = await wixClient.currentCart.removeLineItemsFromCurrentCart([lineItemId]);
  persistTokens();
  window.dispatchEvent(new CustomEvent('cart:updated'));
  return res;
}

export async function applyCoupon(code: string) {
  const res = await wixClient.currentCart.updateCurrentCart({
    couponCode: code,
  });
  persistTokens();
  window.dispatchEvent(new CustomEvent('cart:updated'));
  return res;
}

/** Create a Wix checkout from current cart and redirect the browser to it. */
export async function checkoutNow() {
  const { checkoutId } = await wixClient.currentCart.createCheckoutFromCurrentCart({
    channelType: 'WEB',
  });
  if (!checkoutId) throw new Error('No checkout id returned by Wix');

  const origin = window.location.origin;
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const { redirectSession } = await wixClient.redirects.createRedirectSession({
    ecomCheckout: { checkoutId },
    callbacks: {
      postFlowUrl: `${origin}${base}/thank-you`,
      thankYouPageUrl: `${origin}${base}/thank-you`,
      cartPageUrl: `${origin}${base}/cart`,
    },
  });
  const url = redirectSession?.fullUrl;
  if (!url) throw new Error('No redirect URL returned by Wix');
  window.location.href = url;
}
