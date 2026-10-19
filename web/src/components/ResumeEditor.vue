<script setup lang="ts">
import { computed, reactive } from 'vue'
import { emptyEducation, emptyProject, emptySkillGroup, emptyWork } from '../model/resume'
import { useResume } from '../store/useResume'
import EntryList from './EntryList.vue'
import LinesField from './LinesField.vue'
import SectionCard from './SectionCard.vue'
import TextField from './TextField.vue'

const { resume, saving, savedAt, dirty } = useResume()

const open = reactive({ basics: true, education: false, work: false, projects: false, skills: false, summary: false })

const count = (n: number) => (n ? `${n} 条` : '')
/** 长文本字段的格式说明（与模板运行时 SM.rich 的规则一致） */
const RICH_HINT = '回车换行，空行分段，以「-」开头的行显示为圆点'

const pad = (n: number) => String(n).padStart(2, '0')
const saveText = computed(() => {
  if (saving.value) return '保存中…'
  if (dirty.value) return '有未保存的修改'
  const t = savedAt.value
  return t ? `已保存 ${pad(new Date(t).getHours())}:${pad(new Date(t).getMinutes())}` : '修改后请点击「保存」'
})
</script>

<template>
  <div class="editor">
    <SectionCard v-model:open="open.basics" title="基本信息" :meta="resume.basics.name">
      <TextField v-model="resume.basics.name" label="姓名" placeholder="如：李小明" />
      <TextField v-model="resume.basics.title" label="求职意向" placeholder="如：产品经理" />
      <div class="row">
        <TextField v-model="resume.basics.phone" label="电话" type="tel" />
        <TextField v-model="resume.basics.city" label="城市" />
      </div>
      <TextField v-model="resume.basics.email" label="邮箱" type="email" />
    </SectionCard>

    <SectionCard v-model:open="open.education" title="教育经历" :meta="count(resume.education.length)">
      <EntryList :items="resume.education" noun="教育经历" :create="emptyEducation" :summary="(e) => e.school">
        <template #default="{ item }">
          <TextField v-model="item.school" label="学校" />
          <div class="row">
            <TextField v-model="item.major" label="专业" />
            <TextField v-model="item.degree" label="学历" placeholder="本科 / 硕士" />
          </div>
          <div class="row">
            <TextField v-model="item.start" label="开始" placeholder="2015.09" />
            <TextField v-model="item.end" label="结束" placeholder="2019.06" />
          </div>
          <TextField v-model="item.notes" label="补充说明" placeholder="GPA、荣誉、主修课程等" multiline :rows="2" :hint="RICH_HINT" />
        </template>
      </EntryList>
    </SectionCard>

    <SectionCard v-model:open="open.work" title="工作经历" :meta="count(resume.work.length)">
      <EntryList :items="resume.work" noun="工作经历" :create="emptyWork" :summary="(w) => w.company">
        <template #default="{ item }">
          <div class="row">
            <TextField v-model="item.company" label="公司" />
            <TextField v-model="item.position" label="职位" />
          </div>
          <div class="row">
            <TextField v-model="item.start" label="开始" placeholder="2022.07" />
            <TextField v-model="item.end" label="结束" placeholder="至今" />
          </div>
          <TextField
            v-model="item.description"
            label="工作描述"
            placeholder="职责范围、汇报关系、团队规模等"
            multiline
            :rows="3"
            :hint="RICH_HINT"
          />
          <LinesField v-model="item.highlights" label="工作亮点（每行一条，显示为圆点）" placeholder="用数据说话：做了什么，带来什么结果" />
        </template>
      </EntryList>
    </SectionCard>

    <SectionCard v-model:open="open.projects" title="项目经历" :meta="count(resume.projects.length)">
      <EntryList :items="resume.projects" noun="项目" :create="emptyProject" :summary="(p) => p.name">
        <template #default="{ item }">
          <div class="row">
            <TextField v-model="item.name" label="项目名称" />
            <TextField v-model="item.role" label="角色" />
          </div>
          <div class="row">
            <TextField v-model="item.start" label="开始" />
            <TextField v-model="item.end" label="结束" />
          </div>
          <TextField v-model="item.description" label="项目描述" multiline :rows="4" :hint="RICH_HINT" />
        </template>
      </EntryList>
    </SectionCard>

    <SectionCard v-model:open="open.skills" title="技能" :meta="count(resume.skills.length)">
      <EntryList :items="resume.skills" noun="技能分类" :create="emptySkillGroup" :summary="(g) => g.category">
        <template #default="{ item }">
          <TextField v-model="item.category" label="分类" placeholder="如：工具、语言" />
          <LinesField v-model="item.items" label="技能（每行一项）" :rows="3" />
        </template>
      </EntryList>
    </SectionCard>

    <SectionCard v-model:open="open.summary" title="自我评价" :meta="resume.basics.summary ? '已填写' : ''">
      <TextField v-model="resume.basics.summary" label="介绍自己" multiline :rows="5" :hint="RICH_HINT" />
    </SectionCard>

    <p class="hint save-state" aria-live="polite">{{ saveText }}</p>
  </div>
</template>

<style scoped>
.editor { display: flex; flex-direction: column; gap: 16px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.save-state { text-align: center; margin: 4px 0 0; }
</style>
