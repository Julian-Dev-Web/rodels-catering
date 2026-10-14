export const POLICY_VERSION = '2026-10-15-v1'
export const setupItems = [
  { key: 'stage_backdrop', label: 'Stage Backdrop' },
  { key: 'elegant_chair', label: 'Elegant Chair' },
  { key: 'entrance', label: 'Entrance' },
  { key: 'presidential_table', label: 'Presidential Table' },
  { key: 'buffet_setup', label: 'Buffet Setup' },
  { key: 'diamond_dance_floor', label: 'Diamond Dance Floor' },
]
export const birthdayKeys = setupItems.slice(0, 3).map((item) => item.key)
export const weddingKeys = setupItems.map((item) => item.key)
