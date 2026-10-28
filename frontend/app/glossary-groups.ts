export type Rule = { source: string; target: string; mode: 'never_translate' | 'custom_translation'; case_sensitive: boolean };
export type Groups = { catalogVersion?: number; groups: Record<string, Rule[]>; enabled: string[] };
export const CUSTOM = 'Custom rules';
export function initialGroups(presets: Record<string, Rule[]>, custom: Rule[] = []): Groups {
  return { catalogVersion: 3, groups: { [CUSTOM]: custom, ...Object.fromEntries(Object.entries(presets).map(([k,v]) => [k, v.map(r => ({...r}))])) }, enabled: custom.length ? [CUSTOM] : [] };
}
export function activeRules(state: Groups): Rule[] {
  const found = new Map<string, Rule>();
  for (const name of [CUSTOM, ...Object.keys(state.groups).filter(n => n !== CUSTOM)]) {
    if (!state.enabled.includes(name)) continue;
    for (const rule of state.groups[name] || []) {
      const key = rule.source.trim().toLowerCase();
      if (!found.has(key)) found.set(key, rule);
    }
  }
  return [...found.values()];
}
export function toggleGroup(state: Groups, name: string): Groups {
  return {...state, enabled: state.enabled.includes(name) ? state.enabled.filter(n => n !== name) : [...state.enabled, name]};
}
export function deleteRule(state: Groups, source: string): Groups {
  const key = source.trim().toLowerCase();
  return {...state, groups: Object.fromEntries(Object.entries(state.groups).map(([name, rules]) => [name, rules.filter(r => r.source.trim().toLowerCase() !== key)]))};
}
export function saveCustom(state: Groups, rule: Rule, oldSource?: string): Groups {
  const next = oldSource ? deleteRule(state, oldSource) : state;
  const key = rule.source.trim().toLowerCase();
  const customs = (next.groups[CUSTOM] || []).filter(r => r.source.trim().toLowerCase() !== key);
  return {...next, groups: {...next.groups, [CUSTOM]: [...customs, rule]}, enabled: [...new Set([...next.enabled, CUSTOM])]};
}

// Only add newly introduced terms; preserve prior deletions, edits and toggles.
export function upgradeCatalog(state: Groups, previous: Record<string, Rule[]>, current: Record<string, Rule[]>): Groups {
  if ((state.catalogVersion ?? 0) >= 3) return state;
  const groups = {...state.groups};
  for (const [name, fresh] of Object.entries(current)) {
    const prior = new Set((previous[name] || []).map(r => r.source.toLowerCase()));
    const saved = groups[name] || [];
    const known = new Set(saved.map(r => r.source.toLowerCase()));
    groups[name] = [...saved, ...fresh.filter(r => !prior.has(r.source.toLowerCase()) && !known.has(r.source.toLowerCase()))];
  }
  return {...state, groups, catalogVersion: 3};
}
