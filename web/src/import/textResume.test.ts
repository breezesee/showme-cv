import { describe, expect, it } from 'vitest'
import { isResumeEmpty } from '../model/resume'
import { parseResumeText } from './textResume'

const fullText = `李小明
产品经理
138-0000-0000 | lixiaoming@example.com | 上海

一、教育经历
复旦大学｜信息管理与信息系统｜本科 2015.09 - 2019.06
GPA 3.7/4.0

二、工作经历
星海科技｜高级产品经理 2022.7 - 至今
负责会员与增长业务线。
- 付费转化率提升 32%
- 搭建数据看板体系

云帆网络｜产品经理 2019.07—2022.06
- 从 0 到 1 设计协同办公工具

三、项目经历
智能简历助手｜产品负责人 2023.03 ~ 2023.12
基于 LLM 的简历诊断工具
• 上线 3 个月留存 45%

四、专业技能
产品设计：需求分析、原型设计
工具：Figma、SQL

五、自我评价
5 年互联网产品经验，擅长数据驱动。

六、荣誉奖项
2023 年度创新奖`

describe('parseResumeText', () => {
  it('解析完整中文简历的各个板块与统计', () => {
    const { resume, stats } = parseResumeText(fullText)

    expect(resume.basics).toMatchObject({
      name: '李小明',
      title: '产品经理',
      phone: '138-0000-0000',
      email: 'lixiaoming@example.com',
      city: '上海',
      summary: '5 年互联网产品经验，擅长数据驱动。',
    })

    expect(resume.education).toEqual([
      {
        school: '复旦大学',
        major: '信息管理与信息系统',
        degree: '本科',
        start: '2015.09',
        end: '2019.06',
        notes: 'GPA 3.7/4.0',
      },
    ])

    expect(resume.work).toHaveLength(2)
    expect(resume.work[0]).toMatchObject({
      company: '星海科技',
      position: '高级产品经理',
      start: '2022.07',
      end: '至今',
      description: '负责会员与增长业务线。',
      highlights: ['付费转化率提升 32%', '搭建数据看板体系'],
    })
    expect(resume.work[1]).toMatchObject({
      company: '云帆网络',
      position: '产品经理',
      start: '2019.07',
      end: '2022.06',
      highlights: ['从 0 到 1 设计协同办公工具'],
    })

    expect(resume.projects).toEqual([
      {
        name: '智能简历助手',
        role: '产品负责人',
        start: '2023.03',
        end: '2023.12',
        description: '基于 LLM 的简历诊断工具\n- 上线 3 个月留存 45%',
      },
    ])

    expect(resume.skills).toEqual([
      { category: '产品设计', items: ['需求分析', '原型设计'] },
      { category: '工具', items: ['Figma', 'SQL'] },
    ])

    expect(resume.custom).toHaveLength(1)
    expect(resume.custom[0]).toMatchObject({ title: '荣誉奖项', body: '2023 年度创新奖' })

    expect(stats).toEqual({ basics: true, education: 1, work: 2, projects: 1, skills: 2, custom: 1 })
  })

  it('无板块标题时从首段提取姓名、意向与联系方式', () => {
    const { resume, stats } = parseResumeText('张伟 | 前端工程师 | 13900001111 | zhangwei@test.com')
    expect(resume.basics).toMatchObject({
      name: '张伟',
      title: '前端工程师',
      phone: '13900001111',
      email: 'zhangwei@test.com',
    })
    expect(stats).toMatchObject({ basics: true, education: 0, work: 0, projects: 0, custom: 0 })
  })

  it('识别 # 前缀、斜杠日期与学历位置', () => {
    const { resume } = parseResumeText(`# 教育经历
北京大学 计算机科学与技术 硕士 2018/09 ~ 2021/06

# 工作经历
字节跳动 前端工程师 2021.07-2024.06`)

    expect(resume.education[0]).toMatchObject({
      school: '北京大学',
      major: '计算机科学与技术',
      degree: '硕士',
      start: '2018.09',
      end: '2021.06',
    })
    expect(resume.work[0]).toMatchObject({
      company: '字节跳动',
      position: '前端工程师',
      start: '2021.07',
      end: '2024.06',
    })
  })

  it('日期单独一行时仍能识别学校、公司与项目标题', () => {
    const { resume } = parseResumeText(`教育经历
2016.09 - 2020.06
浙江大学 统计学 本科
GPA 3.8

工作经历
2020.07 - 至今
数联科技 数据分析师
- 日活提升 18%

项目经历
2023.01 - 2023.08
智能报表项目 负责人
- 完成 12 张报表`)

    expect(resume.education[0]).toMatchObject({
      school: '浙江大学',
      major: '统计学',
      degree: '本科',
      start: '2016.09',
      end: '2020.06',
      notes: 'GPA 3.8',
    })
    expect(resume.work[0]).toMatchObject({
      company: '数联科技',
      position: '数据分析师',
      start: '2020.07',
      end: '至今',
      highlights: ['日活提升 18%'],
    })
    expect(resume.projects[0]).toMatchObject({
      name: '智能报表项目',
      role: '负责人',
      start: '2023.01',
      end: '2023.08',
      description: '- 完成 12 张报表',
    })
  })

  it('标题在前、日期单独一行时也能识别', () => {
    const { resume } = parseResumeText(`工作经历
星海科技｜产品经理
2022.07 - 至今
- 付费转化率提升 32%`)

    expect(resume.work[0]).toMatchObject({
      company: '星海科技',
      position: '产品经理',
      start: '2022.07',
      end: '至今',
      highlights: ['付费转化率提升 32%'],
    })
  })

  it('三种列表符号都转为亮点，项目要点写入 description', () => {
    const { resume } = parseResumeText(`工作经历
星海科技｜产品经理 2022.01 - 至今
* 要点一
· 要点二
• 要点三

项目经历
助手｜负责人 2023.01 - 2023.06
• 项目要点`)
    expect(resume.work[0].highlights).toEqual(['要点一', '要点二', '要点三'])
    expect(resume.projects[0].description).toBe('- 项目要点')
  })

  it('「基本信息」板块的带标签字段优先于首段猜测', () => {
    const { resume } = parseResumeText(`基本信息
姓名：王芳
求职意向：数据分析师
电话：137 0000 0000
邮箱：wangfang@example.com
城市：杭州`)
    expect(resume.basics).toMatchObject({
      name: '王芳',
      title: '数据分析师',
      phone: '137 0000 0000',
      email: 'wangfang@example.com',
      city: '杭州',
    })
  })

  it('其他经历与证书作为自定义模块，空板块不产生条目', () => {
    const { resume, stats } = parseResumeText(`其他证书
PMP（2021）
- 英语六级

自我评价`)
    expect(resume.custom).toEqual([
      expect.objectContaining({ title: '其他证书', body: 'PMP（2021）\n- 英语六级' }),
    ])
    expect(resume.basics.summary).toBe('')
    expect(stats.custom).toBe(1)
  })

  it('空文本得到一份空简历', () => {
    const { resume, stats } = parseResumeText('  \n\n ')
    expect(isResumeEmpty(resume)).toBe(true)
    expect(stats).toEqual({ basics: false, education: 0, work: 0, projects: 0, skills: 0, custom: 0 })
  })
})
