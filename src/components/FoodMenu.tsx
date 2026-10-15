import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../features/catalog'
import { FoodPhoto } from './FoodPhoto'
import { ErrorState, Loading } from './ui'
import type { FoodKind } from '../lib/menu-photos'

export function FoodMenu() {
  const catalog = useCatalog()
  const [kind, setKind] = useState<FoodKind>('dishes'), [search,setSearch] = useState(''), [category,setCategory] = useState('all'), [limit,setLimit] = useState(12)
  if (catalog.isPending) return <Loading />
  if (catalog.error) return <ErrorState error={catalog.error} />
  const rows = catalog.data[kind].filter(item => item.name.toLowerCase().includes(search.toLowerCase().trim()) && (kind !== 'dishes' || category === 'all' || item.category_id === category))
  return <section className="food-menu" aria-label="Food menu with photos">
    <div className="section-heading"><div><span className="eyebrow">PICK YOUR FAVORITES</span><h2>What goes on your table.</h2></div></div>
    <p className="food-photo-notice">Representative photos help you browse. Rodel’s actual ingredients, portions and presentation may differ. <Link to="/food-photo-credits">Photo sources & credits</Link></p>
    <div className="tabs" aria-label="Food type">{(['dishes','drinks','desserts'] as const).map(type => <button key={type} aria-pressed={kind === type} className={kind === type ? 'active' : ''} onClick={() => {setKind(type);setSearch('');setCategory('all');setLimit(12)}}>{type.charAt(0).toUpperCase()+type.slice(1)} <span>({catalog.data[type].length})</span></button>)}</div>
    <div className="menu-filters"><label>Find a menu item<input type="search" aria-label="Search food menu" value={search} onChange={event => {setSearch(event.target.value);setLimit(12)}} placeholder="Search your favorites…" /></label>{kind === 'dishes' && <label>Category<select aria-label="Food menu category" value={category} onChange={event=>{setCategory(event.target.value);setLimit(12)}}><option value="all">All categories</option>{catalog.data.menu_categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</div>
    <p className="muted" aria-live="polite">{rows.length} {kind} available</p>
    <div className="food-card-grid">{rows.slice(0,limit).map(item=><article className="food-card" key={item.id}><FoodPhoto item={item} kind={kind}/><div><h3>{item.name}</h3>{kind === 'dishes' && <small>{catalog.data.menu_categories.find(category=>category.id===item.category_id)?.name}</small>}</div></article>)}</div>
    {rows.length > limit && <button className="button secondary food-show-more" onClick={()=>setLimit(current=>current+12)}>Show more {kind}</button>}
    {!rows.length && <p>No matching menu items. Try another search.</p>}
  </section>
}
