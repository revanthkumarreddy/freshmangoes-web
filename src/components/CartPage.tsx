import { useEffect, useState } from 'react';
import { getCart, updateLineItem, removeLineItem, applyCoupon, checkoutNow } from '~/lib/cart';

const fmt = (amount: string | number | undefined) => {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
};

export default function CartPage() {
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  async function refresh() {
    setLoading(true);
    setCart(await getCart());
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  const lineItems = cart?.lineItems || [];
  const subtotal = cart?.subtotal?.amount;
  const total = cart?.priceSummary?.total?.amount || subtotal;
  const discount = cart?.priceSummary?.discount?.amount;
  const shipping = cart?.priceSummary?.shipping?.amount;

  async function onQty(id: string, q: number) {
    setBusy(id); setError(null);
    try { await updateLineItem(id, q); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function onRemove(id: string) {
    setBusy(id); setError(null);
    try { await removeLineItem(id); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function onCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!coupon.trim()) return;
    setBusy('coupon'); setError(null);
    try { await applyCoupon(coupon.trim()); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function onCheckout() {
    setCheckingOut(true); setError(null);
    try { await checkoutNow(); }
    catch (e) { setError((e as Error).message); setCheckingOut(false); }
  }

  if (loading) return <p className="opacity-70">Loading your cart…</p>;
  if (!lineItems.length)
    return (
      <div className="text-center py-16">
        <p className="display text-3xl mb-4">Your basket is empty</p>
        <p className="opacity-70 mb-6">Time to fill it with sunshine.</p>
        <a href={`${import.meta.env.BASE_URL}/shop`.replace('//', '/')} className="btn btn-saffron">Browse our mangoes</a>
      </div>
    );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {lineItems.map((li: any) => (
          <div key={li._id} className="flex gap-4 bg-white rounded-2xl p-4 shadow-sm border border-black/5">
            {li.image && (
              <img src={li.image} alt="" className="w-24 h-24 rounded-xl object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="display text-xl leading-tight">{li.productName?.translated || li.productName?.original}</h3>
              {li.descriptionLines?.length > 0 && (
                <p className="text-xs opacity-70 mt-1">
                  {li.descriptionLines.map((d: any, i: number) =>
                    <span key={i}>{d.name?.translated}: {d.colorInfo?.translated || d.plainText?.translated}{i < li.descriptionLines.length - 1 ? ' · ' : ''}</span>
                  )}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <div className="inline-flex items-center rounded-full border border-black/15">
                  <button className="px-3 py-1.5 disabled:opacity-40" disabled={busy === li._id || li.quantity <= 1} onClick={() => onQty(li._id, li.quantity - 1)}>−</button>
                  <span className="px-3 py-1.5 text-sm font-semibold min-w-[2rem] text-center">{li.quantity}</span>
                  <button className="px-3 py-1.5 disabled:opacity-40" disabled={busy === li._id} onClick={() => onQty(li._id, li.quantity + 1)}>+</button>
                </div>
                <button className="text-xs opacity-60 hover:opacity-100 hover:text-red-700 underline-offset-2 hover:underline" disabled={busy === li._id} onClick={() => onRemove(li._id)}>
                  Remove
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="display text-lg">{fmt(li.price?.amount)}</p>
              {li.fullPrice && li.fullPrice.amount !== li.price?.amount && (
                <p className="price-strike text-xs">{fmt(li.fullPrice.amount)}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <aside className="rounded-2xl bg-white border border-black/5 p-6 h-fit shadow-sm sticky top-24">
        <h3 className="display text-2xl mb-4">Order summary</h3>

        <form onSubmit={onCoupon} className="flex gap-2 mb-5">
          <input
            type="text"
            value={coupon}
            onChange={e => setCoupon(e.target.value.toUpperCase())}
            placeholder="Coupon code"
            className="flex-1 rounded-full border border-black/15 px-4 py-2 text-sm focus:border-[color:var(--color-ink)] outline-none"
          />
          <button className="btn btn-ghost !py-2 !px-4 text-sm" disabled={busy === 'coupon'}>Apply</button>
        </form>
        {cart?.appliedDiscounts?.length > 0 && (
          <p className="text-xs text-[color:var(--color-leaf-600)] mb-3">✓ {cart.appliedDiscounts[0].coupon?.code} applied</p>
        )}

        <dl className="text-sm space-y-2 mb-6">
          <div className="flex justify-between"><dt className="opacity-70">Subtotal</dt><dd>{fmt(subtotal)}</dd></div>
          {discount && parseFloat(discount) > 0 && (
            <div className="flex justify-between text-[color:var(--color-leaf-600)]"><dt>Discount</dt><dd>−{fmt(discount)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="opacity-70">Shipping</dt><dd>{shipping && parseFloat(shipping) > 0 ? fmt(shipping) : 'Calculated at checkout'}</dd></div>
          <div className="border-t border-black/10 pt-3 flex justify-between font-semibold text-base">
            <dt>Total</dt><dd className="display text-2xl">{fmt(total)}</dd>
          </div>
        </dl>

        <button className="btn btn-primary w-full" onClick={onCheckout} disabled={checkingOut}>
          {checkingOut ? 'Redirecting to secure checkout…' : 'Checkout securely →'}
        </button>
        {error && <p className="text-xs text-red-700 mt-3">{error}</p>}
        <p className="text-xs opacity-60 mt-4">Secure payment via Wix Payments. India shipping only. Free over ₹1,500.</p>
      </aside>
    </div>
  );
}
