/**
 * Build-time product fetching helpers.
 * Uses Wix Stores V1 (the catalog version actually populated on this site).
 */
import { wixServer } from './wix-server';

export type WixProduct = Awaited<
  ReturnType<ReturnType<typeof wixServer.products.queryProducts>['find']>
>['items'][number];

export async function fetchAllProducts(): Promise<WixProduct[]> {
  const all: WixProduct[] = [];
  let page = await wixServer.products.queryProducts().limit(100).find();
  all.push(...(page.items ?? []));
  while (page.hasNext()) {
    page = await page.next();
    all.push(...(page.items ?? []));
  }
  return all;
}

export async function fetchProductBySlug(slug: string): Promise<WixProduct | undefined> {
  const res = await wixServer.products.queryProducts().eq('slug', slug).limit(1).find();
  return res.items?.[0];
}

export function priceOf(p: WixProduct | undefined | null) {
  if (!p) return { price: 0, salePrice: null as number | null, currency: 'INR' };
  const price = Number((p as any).price?.price ?? (p as any).priceData?.price ?? 0);
  const discounted = Number((p as any).price?.discountedPrice ?? (p as any).priceData?.discountedPrice ?? price);
  const onSale = discounted < price;
  return {
    price: onSale ? discounted : price,
    salePrice: onSale ? price : null,
    currency: (p as any).price?.currency || 'INR',
  };
}

export function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function primaryImage(p: WixProduct | undefined | null): string {
  const main = (p as any)?.media?.mainMedia?.image?.url;
  if (main) return main;
  const first = (p as any)?.media?.items?.[0]?.image?.url;
  if (first) return first;
  return '/placeholder-mango.svg';
}

export function galleryImages(p: WixProduct | undefined | null): string[] {
  const items: any[] = (p as any)?.media?.items ?? [];
  const urls = items.map(i => i?.image?.url).filter((u: any): u is string => !!u);
  if (urls.length) return urls;
  const main = primaryImage(p);
  return main ? [main] : [];
}

export type SimpleVariant = {
  _id: string;
  variantId: string;
  name: string;
  price: number;
  salePrice: number | null;
  inStock: boolean;
};

export function variantsOf(p: WixProduct | undefined | null): SimpleVariant[] {
  if (!p) return [];
  const raw: any[] = (p as any).variants ?? [];
  if (!raw.length) {
    const { price, salePrice } = priceOf(p);
    return [{
      _id: 'default',
      variantId: '00000000-0000-0000-0000-000000000000',
      name: 'Default',
      price,
      salePrice,
      inStock: (p as any).stock?.inStock !== false,
    }];
  }
  return raw.map(v => {
    const choiceValues = v.choices ? (Object.values(v.choices) as string[]) : [];
    const price = Number(v.variant?.priceData?.price ?? 0);
    const discounted = Number(v.variant?.priceData?.discountedPrice ?? price);
    const onSale = discounted < price;
    return {
      _id: v._id,
      variantId: v._id,
      name: choiceValues.join(' · ') || v.variant?.sku || 'Default',
      price: onSale ? discounted : price,
      salePrice: onSale ? price : null,
      inStock: v.stock?.inStock !== false,
    };
  });
}
