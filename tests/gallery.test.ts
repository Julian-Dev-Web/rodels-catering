import { describe, expect, it } from 'vitest'
import { galleryValues } from '../src/lib/gallery'

describe('event gallery publication metadata', () => {
  it('normalizes optional values and the featured select without truthy-string mistakes', () => {
    expect(galleryValues({name:' Outdoor event ',event_type:'gathering',featured:'false'})).toEqual({name:'Outdoor event',description:'',event_type:'gathering',featured:false,source_url:null})
    expect(galleryValues({name:'School ceremony',event_type:'school',featured:'true',source_url:'https://www.facebook.com/example'}).featured).toBe(true)
  })
  it('rejects unsafe links, unknown occasions and oversized descriptions', () => {
    for (const values of [{source_url:'javascript:alert(1)'},{source_url:'https://'},{event_type:'invented'},{description:'a'.repeat(1501)}]) expect(() => galleryValues({name:'Event photo',...values})).toThrow()
  })
})
