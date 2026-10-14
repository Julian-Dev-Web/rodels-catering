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
export const navigation: Record<Role, { label: string; path: string; icon: string }[]> = {
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
    ['Menu library', 'menu', 'utensils'],
    ['Reservations', 'reservations', 'calendar'],
    ['Cancellations', 'cancellations', 'cancel'],
    ['Reschedules', 'reschedule', 'clock'],
    ['Payments & reports', 'payments', 'wallet'],
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
    ['User access', 'users', 'users'],
    ['Gallery', 'gallery', 'image'],
    ['System settings', 'maintenance', 'settings'],
    ['Audit trail', 'audit-logs', 'receipt'],
    ['Account settings', 'settings', 'settings'],
  ].map(([label, path, icon]) => ({
    label,
    path: path.startsWith('/') ? path : '/super-admin/' + path,
    icon,
  })),
}
