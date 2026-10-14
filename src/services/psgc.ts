export interface Place {
  code: string
  name: string
}
export async function places(path: string): Promise<Place[]> {
  const res = await fetch(`https://psgc.gitlab.io/api/${path}/`, {
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error('Location service is unavailable. Try again shortly.')
  const data: unknown = await res.json()
  if (!Array.isArray(data)) throw new Error('Unexpected location response')
  return data
    .filter(
      (p): p is Place =>
        !!p && typeof p === 'object' && typeof p.code === 'string' && typeof p.name === 'string',
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}
