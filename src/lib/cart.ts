/**
 * Tiny façade over Wix `currentCart` SDK for the React components.
 * No external state library — we just emit a `cart:updated` window event
 * that the header (and any other listener) can react to.
 */
import { wixClient } from './wix-client';

export type LineItemInput = {
  catalogItemId: string;
  variantId?: string;
  quantity: number;
  options?: Record<string, string>;
};

const STORES_APP_ID = '1380b703-ce81-ff05-f115-39571d94dfcd';

export async function getCart() {
  try {
    return await wixClient.currentCart.getCurrentCart();
  } catch {
    return null;
  }
}

export async function addToCart(input: LineItemInput) {
  const res = await wixClient.currentCart.addToCurrentCart({
    lineItems: [
      {
        catalogReference: {
          catalogItemId: input.catalogItemId,
          appId: STORES_APP_ID,
          options: input.variantId
            ? { variantId: input.variantId }
            : input.options
              ? { options: input.options }
              : undefined,
        },
        quantity: input.quantity,
      },
    ],
  });
  window.dispatchEvent(new CustomEvent('cart:updated'));
  return res;
}

export async function updateLineItem(lineItemId: string, quantity: number) {
  const res = await wixClient.currentCart.updateCurrentCartLineItemQuantity([
    { _id: lineItemId, quantity },
  ]);
  window.dispatchEvent(new CustomEvent('cart:updated'));
  return res;
}

export async function removeLineItem(lineItemId: string) {
  const res = await wixClient.currentCart.removeLineItemsFromCurrentCart([lineItemId]);
  window.dispatchEvent(new CustomEvent('cart:updated'));
  return res;
}

export async function applyCoupon(code: string) {
  const res = await wixClient.currentCart.updateCurrentCart({
    couponCode: code,
  });
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
