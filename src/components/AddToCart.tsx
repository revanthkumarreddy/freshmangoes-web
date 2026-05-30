import { useState } from 'react';
import { addToCart } from '~/lib/cart';

type Variant = {
  _id?: string;
  variantId?: string;
  name?: string;
  price?: number;
  salePrice?: number | null;
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
  const [selected, setSelected] = useState(0);
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const variant = variants[selected];
  const variantId = variant?.variantId || variant?._id;

  const price = variant?.price ?? 0;
  const sale = variant?.salePrice ?? null;
  const showSale = sale != null && sale > price;

  async function handleAdd() {
    setState('adding');
    setError(null);
    try {
      await addToCart({
        catalogItemId: productId,
        variantId,
        quantity: qty,
      });
      setState('added');
      setTimeout(() => setState('idle'), 2200);
    } catch (e) {
      setError((e as Error).message);
      setState('error');
    }
  }

  return (
    <div className="space-y-6">
      {variants.length > 1 && (
        <div>
          <div className="eyebrow mb-2">Choose size</div>
          <div className="grid grid-cols-3 gap-2">
            {variants.map((v, i) => (
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
          disabled={state === 'adding'}
          className="btn btn-saffron flex-1"
        >
          {state === 'adding' && 'Adding…'}
          {state === 'added' && '✓ Added to cart'}
          {state === 'error' && 'Try again'}
          {state === 'idle' && `Add ${productName} to cart`}
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <p className="text-xs opacity-70">
        Picked, packed and shipped within 24 hours. Free shipping over ₹1,500.
      </p>
    </div>
  );
}
