/** S12 — Math / transcendental fingerprint. */
export function collectMathFp(): unknown {
  const values = {
    acos: Math.acos(0.123456789),
    acosh: Math.acosh?.(1.123456789) ?? null,
    asin: Math.asin(0.123456789),
    asinh: Math.asinh?.(0.123456789) ?? null,
    atan: Math.atan(0.123456789),
    atanh: Math.atanh?.(0.123456789) ?? null,
    cos: Math.cos(0.123456789),
    cosh: Math.cosh?.(0.123456789) ?? null,
    exp: Math.exp(0.123456789),
    expm1: Math.expm1?.(0.123456789) ?? null,
    log1p: Math.log1p?.(0.123456789) ?? null,
    sin: Math.sin(0.123456789),
    sinh: Math.sinh?.(0.123456789) ?? null,
    tan: Math.tan(-1e300),
    tanh: Math.tanh?.(0.123456789) ?? null,
    sqrt: Math.sqrt(2),
    cbrt: Math.cbrt?.(Math.PI) ?? null,
  };
  return values;
}
