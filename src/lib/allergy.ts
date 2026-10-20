export interface AllergyMatch {allergen_id:string;allergen:string;ingredient:string;ingredient_id:string;component_of:string;kind:'allergen'|'custom'}
export interface AllergyAcknowledgment {dish_id:string;allergen_id:string;token:string;matched_allergens?:string[];risk_types?:string[];recipe_hash?:string;acknowledged_at?:string}
export interface AllergyWarning extends AllergyAcknowledgment {
 dish:string;matches:AllergyMatch[];risk_types:string[];review_state:string;requires_ack:boolean;status:'contains'|'uncertain'|'reviewed_no_match';
 cross_contact_allergens:string[];cross_contact_notes:string;unresolved_tags:string[];unresolved_custom:string[]
}
export interface RecipeIngredient {name:string;aliases:string[];allergen_ids:string[];component_of:string;source_note:string}
export interface DishRecipe {ingredients:RecipeIngredient[];review_state:'not_reviewed'|'incomplete'|'verified';cross_contact_allergen_ids:string[];cross_contact_notes:string;revision:number;updated_at:string|null;reviewed_at:string|null}
export const hasAllergyDeclaration=(ids:string[],notes:string)=>ids.length>0||notes.trim().length>0
export const requiresAllergyAck=(warning:{requires_ack?:boolean})=>warning.requires_ack!==false
export function acknowledgmentFor(w:AllergyWarning):AllergyAcknowledgment {
 return {dish_id:w.dish_id,allergen_id:w.allergen_id,token:w.token,matched_allergens:[...new Set(w.matches.map(m=>m.allergen))],risk_types:w.risk_types,recipe_hash:w.recipe_hash,acknowledged_at:new Date().toISOString()}
}
export function recipeStatus(state:unknown,count?:number) {
 return state==='verified'?'Verified':count===0||state==='not_reviewed'?'Missing Ingredients':'Needs Review'
}
