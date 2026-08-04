/**
 * Native-code tampering: Function.prototype.toString on builtins + compare
 * against a fresh about:blank iframe realm when available.
 */
export function detectNativeCodeTampering(): {
  tampered: boolean;
  details: Record<string, unknown>;
} {
  const suspects: Array<{ name: string; fn: () => unknown }> = [];

  const push = (name: string, fn: unknown) => {
    if (typeof fn === 'function') {
      suspects.push({ name, fn: fn as () => unknown });
    }
  };

  push('navigator.permissions.query', navigator.permissions?.query);
  push('Document.prototype.createElement', Document.prototype.createElement);
  push(
    'HTMLCanvasElement.prototype.toDataURL',
    HTMLCanvasElement.prototype.toDataURL,
  );
  if (typeof WebGLRenderingContext !== 'undefined') {
    push(
      'WebGLRenderingContext.prototype.getParameter',
      WebGLRenderingContext.prototype.getParameter,
    );
  }
  push(
    'navigator.userAgent getter',
    Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent')?.get,
  );

  const localFlags: Record<string, boolean> = {};
  let localTampered = false;
  for (const s of suspects) {
    const ok = looksNative(s.fn);
    localFlags[s.name] = !ok;
    if (!ok) localTampered = true;
  }

  let realmMismatch = false;
  const realmFlags: Record<string, boolean> = {};
  try {
    if (typeof document !== 'undefined' && document.body) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = 'about:blank';
      document.body.appendChild(iframe);
      const iw = iframe.contentWindow as Window & {
        Function: typeof Function;
      } | null;
      if (iw) {
        const remoteToString = iw.Function.prototype.toString;
        for (const s of suspects) {
          try {
            const localStr = Function.prototype.toString.call(s.fn);
            const remoteStr = remoteToString.call(s.fn);
            if (localStr !== remoteStr) {
              realmMismatch = true;
              realmFlags[s.name] = true;
            }
          } catch {
            realmFlags[s.name] = true;
            realmMismatch = true;
          }
        }
      }
      iframe.remove();
    }
  } catch {
    // iframe blocked — skip realm check
  }

  return {
    tampered: localTampered || realmMismatch,
    details: { localFlags, realmFlags, realmMismatch },
  };
}

function looksNative(fn: () => unknown): boolean {
  try {
    const src = Function.prototype.toString.call(fn);
    if (!/\{\s*\[native code\]\s*\}/u.test(src)) return false;
    if (src.includes('/*')) return false;
    return true;
  } catch {
    return false;
  }
}
