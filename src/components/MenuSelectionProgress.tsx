import { CheckCircle2 } from 'lucide-react'
import { menuSelectionState } from '../lib/menu-selection'
export function MenuSelectionProgress({dishes,required,drink}:{dishes:string[];required:number;drink:string}) {
  const progress=menuSelectionState(dishes,required,drink)
  return <div className="menu-selection-progress" aria-label="Live menu selection progress" role="status" aria-live="polite" aria-atomic="true">
    <div><strong>Dishes selected: {progress.selected} / {required}</strong><span>{progress.excess?`Remove ${progress.excess} to continue.`:progress.complete?<><CheckCircle2 size={15}/> Complete. Deselect a dish to choose another.</>:`Choose ${progress.remaining} more ${progress.remaining===1?'dish':'dishes'}.`}</span></div>
    <div><strong>Drinks selected: {progress.drinks} / {progress.drinkLimit}</strong><span>{progress.drinks?'Complete. Choose another drink to replace it.':'Choose one included drink.'}</span></div>
  </div>
}
