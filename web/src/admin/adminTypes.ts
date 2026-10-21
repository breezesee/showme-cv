/** 管理台共享数据类型：只含账号与简历元信息，不含任何简历正文 */

export interface DailyPoint {
  date: string
  count: number
}

export interface AdminUserSummary {
  id: string
  email: string
  createdAt: string | null
  lastSignInAt: string | null
  resumeCount: number
  bannedUntil?: string | null
  isAdmin?: boolean
  lastResumeUpdate?: string | null
}

export type AdminUserFilter = 'all' | 'banned' | 'no_resume7d' | 'inactive7d'

export interface AdminAttention {
  banned: number
  noResume7d: number
  inactive7d: number
}

export interface AdminOverviewData {
  users: { total: number; new7d: number; active7d: number }
  resumes: { total: number; new7d: number; updated7d: number; usersWithResume: number }
  attention: AdminAttention
  daily: { users: DailyPoint[]; resumes: DailyPoint[] }
  recentUsers: AdminUserSummary[]
  activeUsers: AdminUserSummary[]
}

export interface AdminSearchResult {
  total: number
  users: AdminUserSummary[]
}

export interface AdminResumeMeta {
  id: string
  name: string
  createdAt: string | null
  updatedAt: string | null
  bytes: number
}

export interface AdminStorageUsage {
  bucket: string
  objects: number
  bytes: number
}

export interface AdminUserDetailData {
  user: {
    id: string
    email: string
    createdAt: string | null
    emailConfirmedAt: string | null
    lastSignInAt: string | null
    bannedUntil: string | null
    isAdmin: boolean
  }
  profile: { displayName: string } | null
  resumes: AdminResumeMeta[]
  storage: AdminStorageUsage[]
}

export interface AdminAuditEntry {
  id: number
  actorEmail: string
  action: string
  targetType: string
  targetId: string
  detail: Record<string, unknown>
  createdAt: string
}

export interface RelayStats {
  active: number
  expiring7d: number
  checkedAt: string
}
