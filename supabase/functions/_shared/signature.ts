export async function verifySignature(
  raw: string,
  header: string,
  secret: string,
  live: boolean,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const parts = Object.fromEntries(header.split(',').map((v) => v.trim().split('=')))
  const timestamp = Number(parts.t)
  const supplied = live ? parts.li : parts.te
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(nowSeconds - timestamp) > 300 ||
    !supplied ||
    !/^[a-f0-9]{64}$/i.test(supplied)
  )
    return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${parts.t}.${raw}`),
  )
  const expected = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
    '',
  )
  let difference = 0
  for (let i = 0; i < 64; i++)
    difference |= expected.charCodeAt(i) ^ supplied.toLowerCase().charCodeAt(i)
  return difference === 0
}
