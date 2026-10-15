import { Link } from 'react-router-dom'
import { menuPhotos, isFoodKind } from '../lib/menu-photos'
import { useCatalog } from '../features/catalog'
import type { CatalogItem } from '../types'
export function FoodPhotoCredits() {
  const catalog = useCatalog()
  const custom = Object.entries(catalog.data || {}).filter(([key]) => isFoodKind(key)).flatMap(([,rows]) => (rows as CatalogItem[]).filter(row=>row.image_url))
  return <section className="section container prose food-credits"><span className="eyebrow">REPRESENTATIVE FOOD PHOTOGRAPHY</span><h1>Photo sources and credits.</h1><p>These food photos are illustrative references, not photographs of Rodel’s actual servings. Preparation, ingredients, portions and presentation may differ. Individual images retain their listed licenses; no endorsement by the photographers is implied.</p><Link className="text-button" to="/packages">Back to the menu</Link>
    {custom.length>0&&<><h2>Catalog photos supplied through administration</h2><ul>{custom.map(item=><li key={item.id}><strong>{item.name}</strong> — {item.image_credit||'Photo supplied through catalog administration.'}{item.image_source_url&&<>{' '}<a href={item.image_source_url} target="_blank" rel="noreferrer">Source</a></>}</li>)}</ul></>}
    <h2>Representative photo library</h2><p>Downloaded as size-limited Wikimedia Commons thumbnails. Images may be displayed with CSS cropping; the corresponding source and license apply to each image.</p><div className="table-scroll"><table><thead><tr><th>Menu item</th><th>Photographer / author</th><th>Source</th><th>License</th></tr></thead><tbody>{menuPhotos.map(photo=><tr key={photo.kind+photo.name}><td><strong>{photo.name}</strong>{photo.note&&<small className="photo-reference-note">{photo.note}</small>}</td><td>{photo.author}</td><td><a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.sourceTitle.replace(/^File:/,'')}</a></td><td><a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></td></tr>)}</tbody></table></div>
  </section>
}
