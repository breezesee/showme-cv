import { sameResume } from '../model/normalize'
import { isResumeEmpty, sampleResume, type Resume } from '../model/resume'

/** 上次成功同步时两端一致的内容与服务器时间（updated_at） */
export interface Snapshot { data: Resume; at: string }
export interface RemoteRow { data: Resume; updatedAt: string }
export type MergeAction = 'push' | 'align' | 'pull' | 'conflict'

/** 登录或启动同步时，判定本机与云端谁覆盖谁；拿不准一律交给用户（conflict），绝不静默丢数据 */
export function decideMerge(local: Resume, snapshot: Snapshot | null, remote: RemoteRow | null): MergeAction {
  if (!remote) return 'push'
  if (sameResume(local, remote.data)) return 'align'
  // 本机只有示例或空白，没有值得保留的内容
  if (sameResume(local, sampleResume()) || isResumeEmpty(local)) return 'pull'
  if (snapshot) {
    if (sameResume(local, snapshot.data)) return 'pull'
    if (Date.parse(remote.updatedAt) <= Date.parse(snapshot.at)) return 'push'
  }
  return 'conflict'
}
