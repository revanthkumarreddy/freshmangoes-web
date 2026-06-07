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

const placeholder = `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/placeholder-mango.svg`;

// Map of slug keywords to local realistic images
const LOCAL_IMAGES: Record<string, string> = {
  'alphonso': '/images/mango_alphonso.png',
  'banganpalli': '/images/mango_banganpalli.png',
  'mallika': '/images/mango_mallika.png',
  'totapuri': '/images/mango_totapuri.png',
};

export function primaryImage(p: WixProduct | undefined | null): string {
  const slug = (p as any)?.slug?.toLowerCase() || '';
  const name = (p as any)?.name?.toLowerCase() || '';
  const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

  // Intercept and provide highly realistic images
  for (const [key, path] of Object.entries(LOCAL_IMAGES)) {
    if (slug.includes(key) || name.includes(key)) {
      return `${BASE}${path}`;
    }
  }

  // Fallback to the best default realistic image we have
  return `${BASE}/images/mango_alphonso.png`;
}

export function galleryImages(p: WixProduct | undefined | null): string[] {
  return [primaryImage(p)];
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
