import { describe, expect, it } from 'vitest'
import { discountBasisPoints, stockQuantity } from '../src/lib/manager-input'
import { menuSelectionState } from '../src/lib/menu-selection'
describe('manager inputs use the actual supported percentage and stock ranges',()=>{
  it('accepts presets and custom percentages without silently rounding excess decimals',()=>{
    for(const p of['5','10','15','20','12.5','0','100.00'])expect(discountBasisPoints(p)).toBe(Number(p)*100)
    for(const p of['','-1','100.01','10.001','Infinity','NaN','1e2','five'])expect(()=>discountBasisPoints(p)).toThrow()
    expect(()=>discountBasisPoints('20',0,1500)).toThrow(/0% to 15%/)
  })
  it('rejects blank, decimal, negative, zero and oversized stock adjustments',()=>{
    for(const q of['','-1','0','1.5','1000001','NaN','Infinity','1e3'])expect(()=>stockQuantity(q)).toThrow()
    expect(stockQuantity('200')).toBe(200);expect(stockQuantity('0',true)).toBe(0)
  })
})
describe('package-aware live menu progress',()=>{
  it('tracks exact dish counts and the actual single-drink schema',()=>{
    expect(menuSelectionState(['a','b','c'],5,'')).toMatchObject({selected:3,remaining:2,complete:false,drinks:0,drinkLimit:1})
    expect(menuSelectionState(['a','b','c'],3,'tea')).toMatchObject({selected:3,remaining:0,complete:true,drinks:1,drinkLimit:1})
    expect(menuSelectionState(['a','b','c'],2,'tea')).toMatchObject({excess:1,complete:false})
    expect(menuSelectionState(['a','a'],3,'')).toMatchObject({selected:1,remaining:2})
    expect(menuSelectionState([],0,'').complete).toBe(false)
  })
})
