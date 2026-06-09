import { useState, useEffect } from 'react';
import { addToCart } from '~/lib/cart';
import { wixClient } from '~/lib/wix-client';

type Variant = {
  _id?: string;
  variantId?: string;
  name?: string;
  price?: number;
  salePrice?: number | null;
  inStock?: boolean;
  choices?: Record<string, string>;
};

type Props = {
  productId: string;
  productName: string;
  variants: Variant[];
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function AddToCart({ productId, productName, variants }: Props) {
  const [liveVariants, setLiveVariants] = useState<Variant[]>(variants);
  const [selected, setSelected] = useState(0);
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Sync live stock of variants from Wix client-side on mount to bypass build-time static cache
  useEffect(() => {
    let active = true;
    async function fetchLiveStock() {
      try {
        console.log('[AddToCart] Fetching live stock for product ID:', productId);
        const { items } = await wixClient.products.queryProducts().eq('_id', productId).find();
        if (items.length > 0 && active) {
          const product = items[0];
          const mapped: Variant[] = product.variants?.map(v => {
            const price = Number(v.variant?.priceData?.price ?? 0);
            const discounted = Number(v.variant?.priceData?.discountedPrice ?? price);
            const onSale = discounted < price;
            return {
              _id: v._id,
              variantId: v._id,
              name: v.choices ? Object.values(v.choices).join(' · ') : 'Default',
              price: onSale ? discounted : price,
              salePrice: onSale ? price : null,
              inStock: v.stock?.inStock !== false,
            };
          }) || [];
          
          if (mapped.length === 0) {
            const price = Number(product.price?.price ?? product.priceData?.price ?? 0);
            const discounted = Number(product.price?.discountedPrice ?? product.priceData?.discountedPrice ?? price);
            const onSale = discounted < price;
            mapped.push({
              _id: 'default',
              variantId: '00000000-0000-0000-0000-000000000000',
              name: 'Default',
              price: onSale ? discounted : price,
              salePrice: onSale ? price : null,
              inStock: product.stock?.inStock !== false,
            });
          }
          
          console.log('[AddToCart] Mapped live variants for', productName, ':', JSON.stringify(mapped));
          setLiveVariants(mapped);
        }
      } catch (err) {
        console.error('[AddToCart] Failed to fetch live stock:', err);
      }
    }
    fetchLiveStock();
    return () => { active = false; };
  }, [productId]);

  const variant = liveVariants[selected] || liveVariants[0];
  const variantId = variant?.variantId || variant?._id;

  const price = variant?.price ?? 0;
  const sale = variant?.salePrice ?? null;
  const showSale = sale != null && sale > price;

  async function handleAdd() {
    setState('adding');
    setError(null);
    console.log('[AddToCart] Adding to cart:', { productId, variantId, qty });
    try {
      const result = await addToCart({
        catalogItemId: productId,
        variantId,
        quantity: qty,
      });
      console.log('[AddToCart] addToCart result:', JSON.stringify(result));

      // Validate that the item was successfully added with non-zero quantity
      const lineItems = result?.cart?.lineItems || [];
      const addedItem = lineItems.find((li: any) => {
        const matchesProduct = li.catalogReference?.catalogItemId === productId;
        const matchesVariant = !variantId || 
                               variantId === '00000000-0000-0000-0000-000000000000' || 
                               li.catalogReference?.options?.variantId === variantId;
        return matchesProduct && matchesVariant;
      });

      if (addedItem && (addedItem.quantity === 0 || addedItem.availability?.status === 'NOT_AVAILABLE')) {
        throw new Error('This item is out of stock in the store backend and cannot be added to the cart.');
      }

      const itemCount = lineItems.length;
      console.log('[AddToCart] Cart items after add:', itemCount);
      setState('added');
      setTimeout(() => setState('idle'), 2200);
    } catch (e: any) {
      console.error('[AddToCart] ERROR:', e);
      console.error('[AddToCart] Error details:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
      setError(e?.message || JSON.stringify(e) || 'Unknown error');
      setState('error');
    }
  }

  return (
    <div className="space-y-6">
      {liveVariants.length > 1 && (
        <div>
          <div className="eyebrow mb-2">Choose size</div>
          <div className="grid grid-cols-3 gap-2">
            {liveVariants.map((v, i) => (
              <button
                key={v._id || v.variantId || i}
                type="button"
                onClick={() => setSelected(i)}
                className={
                  'rounded-xl border px-3 py-3 text-sm font-medium transition-all ' +
                  (i === selected
                    ? 'border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-cream)]'
                    : 'border-black/15 hover:border-[color:var(--color-ink)]')
                }
              >
                <div>{v.name || `Option ${i + 1}`}</div>
                <div className="mt-1 text-xs opacity-80">{fmt(v.price ?? 0)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-baseline gap-3">
        {showSale && <span className="price-strike text-lg">{fmt(sale!)}</span>}
        <span className="display text-4xl">{fmt(price)}</span>
        <span className="text-xs uppercase tracking-wider opacity-60">incl. of all taxes</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-black/15 overflow-hidden">
          <button
            type="button"
            aria-label="Decrease quantity"
            className="px-4 py-2 hover:bg-black/5"
            onClick={() => setQty(Math.max(1, qty - 1))}
          >
            −
          </button>
          <span className="px-4 py-2 min-w-[2.5rem] text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            className="px-4 py-2 hover:bg-black/5"
            onClick={() => setQty(qty + 1)}
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={state === 'adding' || variant?.inStock === false}
          className="btn btn-saffron flex-1"
        >
          {variant?.inStock === false ? 'Out of stock' : (
            <>
              {state === 'adding' && 'Adding…'}
              {state === 'added' && '✓ Added to cart'}
              {state === 'error' && 'Try again'}
              {state === 'idle' && `Add ${productName} to cart`}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 font-semibold">Error adding to cart:</p>
          <p className="text-xs text-red-600 mt-1 break-all">{error}</p>
          <p className="text-xs text-red-500 mt-1">Check browser console (F12) for more details.</p>
        </div>
      )}

      <p className="text-xs opacity-70">
        Picked, packed and shipped within 24 hours. Free shipping over ₹1,500.
      </p>
    </div>
  );
}
