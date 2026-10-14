/**
 * 简历数据模型 v1。
 * 以 Android 版 com.showme.app.data.Resume 的 JSON 结构为基础，网页版新增的字段（Work.description）缺省为空，
 * 旧数据可直接导入。长文本字段保留换行，由模板按「回车换行、空行分段、- 开头为圆点」渲染。
 */
export interface Basics {
  name: string
  title: string
  phone: string
  email: string
  city: string
  summary: string
}

export interface Education {
  school: string
  major: string
  degree: string
  start: string
  end: string
  notes: string
}

export interface Work {
  company: string
  position: string
  start: string
  end: string
  /** 工作描述（多行），显示在工作亮点之前 */
  description: string
  highlights: string[]
}

export interface Project {
  name: string
  role: string
  start: string
  end: string
  description: string
}

export interface SkillGroup {
  category: string
  items: string[]
}

export interface Resume {
  version: number
  basics: Basics
  education: Education[]
  work: Work[]
  projects: Project[]
  skills: SkillGroup[]
}

export const RESUME_VERSION = 1

export const emptyBasics = (): Basics => ({ name: '', title: '', phone: '', email: '', city: '', summary: '' })
export const emptyEducation = (): Education => ({ school: '', major: '', degree: '', start: '', end: '', notes: '' })
export const emptyWork = (): Work => ({ company: '', position: '', start: '', end: '', description: '', highlights: [] })
export const emptyProject = (): Project => ({ name: '', role: '', start: '', end: '', description: '' })
export const emptySkillGroup = (): SkillGroup => ({ category: '', items: [] })

export const emptyResume = (): Resume => ({
  version: RESUME_VERSION,
  basics: emptyBasics(),
  education: [],
  work: [],
  projects: [],
  skills: [],
})

/** 首次使用预填的中文示例简历 */
export function sampleResume(): Resume {
  return {
    version: RESUME_VERSION,
    basics: {
      name: '李小明',
      title: '产品经理',
      phone: '138-0000-0000',
      email: 'lixiaoming@example.com',
      city: '上海',
      summary: '5 年互联网产品经验，主导过 2 款千万级用户产品的从 0 到 1；擅长数据驱动与跨团队协作，关注长期价值与用户体验的平衡。',
    },
    education: [
      {
        school: '复旦大学',
        major: '信息管理与信息系统',
        degree: '本科',
        start: '2015.09',
        end: '2019.06',
        notes: 'GPA 3.7/4.0，校学生会科技部部长',
      },
    ],
    work: [
      {
        company: '星海科技',
        position: '高级产品经理',
        start: '2022.07',
        end: '至今',
        description: '负责会员与增长业务线，向产品总监汇报，管理 3 人产品小组。',
        highlights: [
          '主导会员业务改版，付费转化率提升 32%，年增收超 2000 万',
          '搭建数据看板体系，需求评审周期从 5 天缩短至 2 天',
          '带 3 人小组完成 App 8.0 重构，崩溃率降至 0.02%',
        ],
      },
      {
        company: '云帆网络',
        position: '产品经理',
        start: '2019.07',
        end: '2022.06',
        description: '',
        highlights: [
          '从 0 到 1 设计协同办公工具，上线一年用户破 500 万',
          '建立 A/B 实验流程，核心功能迭代效率提升 40%',
        ],
      },
    ],
    projects: [
      {
        name: '智能简历助手',
        role: '产品负责人',
        start: '2023.03',
        end: '2023.12',
        description: '基于 LLM 的简历诊断与润色工具，负责产品规划与上线节奏。\n- 上线 3 个月留存 45%\n- 获公司年度创新奖',
      },
    ],
    skills: [
      { category: '产品设计', items: ['需求分析', '原型设计', '用户研究', '数据分析'] },
      { category: '工具', items: ['Figma', 'SQL', 'Tableau', 'Jira'] },
      { category: '语言', items: ['中文（母语）', '英语（CET-6）'] },
    ],
  }
}
