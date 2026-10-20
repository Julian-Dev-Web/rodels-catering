const prefix = 'rodelconnect:booking-draft:v1:'

export function bookingDraftKey(
  userId: string | undefined,
  reservationId?: string,
) {
  return userId ? prefix + userId + ':' + (reservationId || 'new') : null
}

// Only restore fields with the form's expected shape. Incomplete/invalid user
// input still belongs in a draft; normal form and server validation run on save.
function restoreShape(template: unknown, stored: unknown, field?: string): unknown {
  if (template === null)
    return stored === null ||
      (typeof stored === 'number' && Number.isFinite(stored))
      ? stored
      : template
  if (Array.isArray(template) && field==='allergy_acknowledgments')
    return Array.isArray(stored) ? stored.filter(v=>v&&typeof v==='object'&&['dish_id','allergen_id','token'].every(k=>typeof v[k]==='string'&&v[k].length<=200)).map(v=>({dish_id:v.dish_id,allergen_id:v.allergen_id,token:v.token,...Object.fromEntries(['matched_allergens','risk_types'].filter(k=>Array.isArray(v[k])&&v[k].length<=30&&v[k].every((x:unknown)=>typeof x==='string'&&x.length<=150)).map(k=>[k,v[k]])),...Object.fromEntries(['recipe_hash','acknowledged_at'].filter(k=>typeof v[k]==='string'&&v[k].length<=128).map(k=>[k,v[k]]))})) : template
  if (Array.isArray(template))
    return Array.isArray(stored) && stored.every((v) => typeof v === 'string')
      ? stored
      : template
  if (typeof template === 'object') {
    if (!stored || typeof stored !== 'object' || Array.isArray(stored))
      return template
    const fields = Object.entries(template as Record<string, unknown>)
    if (!fields.length)
      return Object.fromEntries(
        Object.entries(stored).filter(
          ([, value]) => typeof value === 'number' && Number.isFinite(value),
        ),
      )
    return Object.fromEntries(
      fields.map(([key, value]) => [
        key,
        restoreShape(value, (stored as Record<string, unknown>)[key],key),
      ]),
    )
  }
  return typeof stored === typeof template &&
    (typeof stored !== 'number' || Number.isFinite(stored))
    ? stored
    : template
}

export function readBookingDraft<T>(
  key: string | null,
  defaults: T,
  revision: string | null,
): T {
  if (!key) return defaults
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (!saved || saved.revision !== revision) return defaults
    const restored = restoreShape(defaults, saved.values) as T
    if (
      defaults &&
      typeof defaults === 'object' &&
      'consent_version' in defaults &&
      restored &&
      typeof restored === 'object' &&
      'consent_version' in restored &&
      restored.consent_version !== defaults.consent_version
    )
      Object.assign(restored, {
        consent_version: defaults.consent_version,
        consent_accepted: false,
      })
    return restored
  } catch {
    return defaults
  }
}
export function restorePersistedDraft<T>(defaults:T,data:unknown):T {
  return restoreShape(defaults,data) as T
}

export function writeBookingDraft(
  key: string | null,
  values: unknown,
  revision: string | null,
) {
  if (!key) return
  try {
    sessionStorage.setItem(key, JSON.stringify({ revision, values }))
  } catch {
    /* Storage can be disabled or full. Keep the working form. */
  }
}

export function clearBookingDraft(key: string | null) {
  if (!key) return
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* Storage can be disabled. */
  }
}

export function clearBookingDrafts() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.removeItem(key)
  } catch {
    /* Storage can be disabled. */
  }
}
