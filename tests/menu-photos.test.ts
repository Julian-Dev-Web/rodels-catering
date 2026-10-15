import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { rodelsFoods, rodelsDrinks, rodelsDesserts } from '../src/data/rodels-menu'
import { menuPhoto, menuPhotos, validCatalogImageUrl } from '../src/lib/menu-photos'

describe('representative menu photo library', () => {
  it('covers every owner-approved dish, drink and dessert with a local photograph and reusable attribution', async () => {
    const groups = { dishes: Object.values(rodelsFoods).flat(), drinks: rodelsDrinks, desserts: rodelsDesserts }
    expect(menuPhotos).toHaveLength(90)
    for (const [kind,names] of Object.entries(groups)) for (const name of names) {
      const photo = menuPhoto(name,kind as 'dishes' | 'drinks' | 'desserts')!
      expect(photo, name).toBeDefined()
      expect(photo.path).toMatch(/^\/images\/menu\/[a-f0-9]+\.(jpg|png|webp)$/)
      const bytes = await readFile('public'+photo.path)
      expect(bytes.length).toBeGreaterThan(1000)
      expect(bytes.subarray(0,2).toString('hex') === 'ffd8' || bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a' || bytes.subarray(0,4).toString() === 'RIFF').toBe(true)
      expect(photo.author).toBeTruthy()
      expect(photo.license).toMatch(/^(CC BY|CC0|Public domain)/)
      expect(photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
      expect(photo.licenseUrl).toMatch(/^https?:\/\//)
      expect(photo.note).toBeTruthy()
    }
  })
  it('matches punctuation variants while keeping different food kinds separate', () => {
    expect(menuPhoto("TOKWA'T BABOY",'dishes')?.name).toBe('Tokwa’t Baboy')
    expect(menuPhoto('Iced Tea','desserts')).toBeUndefined()
    expect(menuPhoto('New owner-created dish','dishes')).toBeUndefined()
  })
  it('accepts public HTTPS/local images and rejects unsafe schemes, embedded credentials and traversal', () => {
    for (const url of ['https://example.com/photo.jpg','/images/menu/abc.jpg']) expect(validCatalogImageUrl(url)).toBe(true)
    for (const url of ['javascript:alert(1)','data:image/svg+xml,hi','http://example.com/a.jpg','//example.com/a.jpg','https://user:pass@example.com/a.jpg','/images/../secret','/images/a b.jpg']) expect(validCatalogImageUrl(url)).toBe(false)
  })
})
