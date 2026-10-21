/** 管理权限只认 app_metadata.role；user_metadata 可由用户自行修改，绝不参与判定 */

export interface AdminIdentity {
  id: string
  email: string
  isAdmin: boolean
}

export function isAdminMetadata(appMetadata: unknown): boolean {
  if (typeof appMetadata !== 'object' || appMetadata === null || Array.isArray(appMetadata)) return false
  return (appMetadata as Record<string, unknown>).role === 'admin'
}

export function readAdminIdentity(user: unknown): AdminIdentity | null {
  if (typeof user !== 'object' || user === null) return null
  const u = user as Record<string, unknown>
  if (typeof u.id !== 'string' || u.id === '') return null
  return {
    id: u.id,
    email: typeof u.email === 'string' ? u.email : '',
    isAdmin: isAdminMetadata(u.app_metadata),
  }
}
