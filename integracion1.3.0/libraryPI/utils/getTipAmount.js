  function splitPurchaseAmountAndTip(data, originalPurchaseAmount, decimals = 2) {
  const idx = data.findIndex((item) => item.name === 'purchaseAmount');
  if (idx === -1) {
    console.log('purchaseAmount not found in data');
    return data;
  }

  const rawCombined = data[idx].value;
  const padLength = rawCombined.length; // preserve original field width

  const combinedCents = parseInt(rawCombined, 10);

  // Normalize originalPurchaseAmount to the same "cents" integer representation
  const originalCents =
    typeof originalPurchaseAmount === 'string'
      ? parseInt(originalPurchaseAmount, 10)
      : Math.round(originalPurchaseAmount * Math.pow(10, decimals));

  const tipCents = combinedCents - originalCents;

  if (tipCents < 0) {
    throw new Error(
      `Computed negative tip (${tipCents}); check originalPurchaseAmount input`
    );
  }

  const pad = (n) => String(n).padStart(padLength, '0');

  const result = [...data];

  // Replace purchaseAmount with the original (non-tip) amount
  result[idx] = { name: 'purchaseAmount', value: pad(originalCents) };

  // Insert tip right after purchaseAmount
  if(this.useTips) {
      result.splice(idx + 1, 0, { name: 'tip', value: pad(tipCents) });
  }
  return result;
}

module.exports = {splitPurchaseAmountAndTip};