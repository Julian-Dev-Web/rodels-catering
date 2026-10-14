import type { Role } from '../types'
export const roleHome: Record<Role, string> = {
  customer: '/customer/reservations',
  manager: '/manager/dashboard',
  super_admin: '/super-admin/dashboard',
}
export function canVisit(role: Role, path: string) {
  const prefix = path.split('/')[1]
  return prefix === 'customer'
    ? role === 'customer'
    : prefix === 'manager'
      ? role === 'manager' || role === 'super_admin'
      : prefix === 'super-admin'
        ? role === 'super_admin'
        : true
}
export const navigation: Record<
  Role,
  { label: string; path: string; icon: string }[]
> = {
  customer: [
    ['My reservations', 'reservations', 'calendar'],
    ['Available dates', 'available-dates', 'date'],
    ['Packages', 'packages', 'utensils'],
    ['Payments', 'payments', 'wallet'],
    ['Transactions', 'transactions', 'receipt'],
    ['Cancellations', 'cancellations', 'cancel'],
    ['Refunds', 'refunds', 'return'],
    ['Reschedule', 'reschedule', 'clock'],
    ['Feedback', 'feedback', 'star'],
    ['Support', 'support', 'chat'],
    ['Settings', 'settings', 'settings'],
  ].map(([label, path, icon]) => ({ label, path: '/customer/' + path, icon })),
  manager: [
    ['Overview', 'dashboard', 'chart'],
    ['Event calendar', 'calendar', 'date'],
    ['Operating hours', 'operating-hours', 'clock'],
    ['Packages & menus', 'catalog', 'utensils'],
    ['Menu library', 'menu', 'utensils'],
    ['Event setups & extras', 'event-setups', 'star'],
    ['Reservations', 'reservations', 'calendar'],
    ['Cancellations', 'cancellations', 'cancel'],
    ['Reschedules', 'reschedule', 'clock'],
    ['Payment monitoring', 'payments', 'wallet'],
    ['Reports & analytics', 'reports', 'chart'],
    ['Refunds', 'refunds', 'return'],
    ['Feedback', 'feedback', 'star'],
    ['Support inbox', 'support', 'chat'],
    ['Settings', 'settings', 'settings'],
  ].map(([label, path, icon]) => ({ label, path: '/manager/' + path, icon })),
  super_admin: [
    ['System overview', 'dashboard', 'chart'],
    ['Backups & recovery', 'backups', 'database'],
    ['Packages & setups', 'packages', 'utensils'],
    ['Add-ons & features', 'add-ons', 'star'],
    ['User management', 'users', 'users'],
    ['Roles & permissions', 'roles', 'users'],
    ['Gallery', 'gallery', 'image'],
    ['Website maintenance', 'maintenance', 'settings'],
    ['System settings', 'system-settings', 'settings'],
    ['Operating hours', 'operating-hours', 'clock'],
    ['Security monitoring', 'security', 'receipt'],
    ['System reports', 'reports', 'chart'],
    ['Audit trail', 'audit-logs', 'receipt'],
    ['Account settings', 'settings', 'settings'],
  ].map(([label, path, icon]) => ({
    label,
    path: path.startsWith('/') ? path : '/super-admin/' + path,
    icon,
  })),
}
