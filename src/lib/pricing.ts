export function getOverriddenPrice(productName: string, variantName: string, originalPrice: number): number {
  const p = (productName || '').toLowerCase();
  const v = (variantName || '').toLowerCase().replace(/\s/g, '');
  
  const basePrices: Record<string, number> = {
    'alphonso': 549,
    'mallika': 549,
    'neelam': 459,
    'nilam': 459,
    'neelum': 459,
    'sendura': 479,
    'totapuri': 399,
  };

  for (const [key, base3kg] of Object.entries(basePrices)) {
    if (p.includes(key)) {
      if (v.includes('3kg') || v === 'default' || v === '') {
        return base3kg;
      }
      if (v.includes('5kg')) {
        return Math.round((base3kg / 3) * 5);
      }
    }
  }
  return originalPrice;
}
