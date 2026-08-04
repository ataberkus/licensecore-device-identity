/** V2 — Languages. */
export function collectLanguages(): unknown {
  return {
    language: navigator.language,
    languages: [...(navigator.languages ?? [])],
  };
}
