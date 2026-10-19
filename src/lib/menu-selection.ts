// The current schema has a required single drink_id and dessert_id; packages
// define their exact dish_count. There is no two-drink package rule.
export function menuSelectionState(dishes:string[],required:number,drink:string) {
  const selected=new Set(dishes).size
  return {selected,required,remaining:Math.max(required-selected,0),excess:Math.max(selected-required,0),complete:required>0&&selected===required,drinks:drink?1:0,drinkLimit:1}
}
