export type Role = 'customer' | 'manager' | 'super_admin'
export type ReservationStatus =
  | 'draft'
  | 'pending'
  | 'for_approval'
  | 'approved'
  | 'pending_cancellation'
  | 'cancelled'
  | 'rejected'
  | 'pending_refund'
  | 'refund_approved'
  | 'refunded'
  | 'completed'
export interface Profile {
  id: string
  full_name: string
  first_name: string
  middle_name: string
  last_name: string
  phone: string
  avatar_path: string | null
  role: Role
  account_status: 'active' | 'suspended'
  status_changed_at: string | null
  created_at: string
}
export interface CatalogItem {
  id: string
  name: string
  description?: string
  price?: number
  dish_count?: number
  min_guests?: number
  max_guests?: number | null
  pricing_version?: number
  inclusions?: string[]
  suggested_dishes?: string[][]
  required_setup_id?: string | null
  setup_kind?: 'birthday' | 'wedding' | 'buffet' | null
  category_id?: string
  image_url?: string
  active: boolean
}
export type CatalogTable =
  | 'menu_sets'
  | 'menu_categories'
  | 'dishes'
  | 'drinks'
  | 'desserts'
  | 'event_setups'
  | 'event_features'
  | 'add_ons'
  | 'chair_types'
  | 'table_types'
export type Catalog = Record<CatalogTable, CatalogItem[]>
export interface Reservation {
  id: string
  updated_at: string
  reservation_reference?: string
  selection_snapshot?: {name:string;quantity:number;unit_amount:number|null;subtotal:number|null;basis:string}[] | null
  customer_id: string
  event_name: string
  event_date: string
  event_time: string
  address: Record<string, string>
  guests: number
  menu_set_id: string
  drink_id: string | null
  dessert_id: string | null
  status: ReservationStatus
  payment_status: string
  total: number
  paid: number
  refunded: number
  pricing: Record<string, number>
  created_at: string
  finalized_at: string | null
  booking_version?: number
  event_preferences?: import('./lib/booking').EventPreferences
  consent_version?: string | null
  consent_at?: string | null
  package_name?: string
  customer_name?: string
}
export interface RecordRow {
  id: string
  [key: string]: unknown
}
export interface Ticket {
  id: string
  customer_id: string
  subject: string
  status: string
  created_at: string
}
export interface Message {
  id: string
  ticket_id: string
  author_id: string
  body: string
  created_at: string
}
export interface Notice {
  id: string
  title: string
  body: string
  href: string
  read_at: string | null
  created_at: string
}
export interface Metrics {
  today_revenue: number
  today_bookings: number
  customers: number
  pending: number
  current_month_bookings: number
  previous_month_bookings: number
  current_month_users: number
  previous_month_users: number
  current_month_revenue: number
  previous_month_revenue: number
  top_packages: { name: string; bookings: number }[]
  weekly: { period: string; bookings: number }[]
  monthly: { period: string; bookings: number }[]
}
