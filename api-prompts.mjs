const ALLOWED_ICONS = ['math', 'english', 'reading', 'science', 'book', 'thinking', 'preview', 'clipboard'];
const ALLOWED_GROUPS = ['required', 'optional', 'adventure'];

export function buildTaskPrompt(payload) {
  const schema = {
    tasks: [
      {
        subject: '数学',
        icon: 'math',
        group: 'required',
        title: '不超过20字的任务名',
        description: '一句可执行说明，必须包含明确产出或完成证据',
        minutes: 20,
        difficulty: 2,
        focus: '核心训练点',
        reward: { stars: 15, coins: 20, xp: 24, mapEnergy: 8 }
      }
    ],
    parentTip: '一句给家长的执行建议'
  };

  const grade = payload.grade || payload.childProfile?.grade || '四年级';
  const minutes = Number(payload.minutes || payload.availableMinutes || 60);
  const focus = payload.focus || payload.focusSubjects || [];
  const childName = payload.childProfile?.childName || payload.childName || '孩子';
  const existing = Array.isArray(payload.existingTasks) ? payload.existingTasks : [];

  return [
    {
      role: 'system',
      content: `你是一名小学家庭学习任务设计师。你的工作是把家长的学习目标拆成“少而精、可执行、可追踪”的任务，而不是替孩子完成作业。\n\n必须遵守：\n1. 面向小学阶段，使用短句和明确动作，不使用成人化术语。\n2. 输出 3—5 个任务；单项 5—30 分钟；总时长不得超过家长给出的可用时间。\n3. 每个任务都必须包含可观察的完成证据，例如“写下一句话总结”“画一张关系图”“完成两题并解释一道”。\n4. 不要全部变成刷题。任务组合至少覆盖以下两类：回顾、预习、阅读、表达、动手观察、专注整理。\n5. 任务难度只能是 1、2 或 3。\n6. group 只能使用 ${ALLOWED_GROUPS.join('、')}；icon 只能使用 ${ALLOWED_ICONS.join('、')}。\n7. 奖励只记录成长，不做排名，不扣分，不因中断学习惩罚孩子。\n8. 不生成羞辱性、焦虑性或以速度比较孩子的文案。\n9. 只输出合法 JSON，不要 Markdown，不要代码围栏，不要解释。\n\nJSON 结构：${JSON.stringify(schema)}`
    },
    {
      role: 'user',
      content: `请为以下孩子安排今日家庭学习任务：\n孩子昵称：${childName}\n年级：${grade}\n可用时间：${minutes} 分钟\n今日重点：${Array.isArray(focus) && focus.length ? focus.join('、') : '综合学习'}\n家长补充目标：${payload.goal || payload.note || '无'}\n已有任务摘要：${JSON.stringify(existing)}\n\n请避免与已完成任务重复，并让第一个任务足够容易启动。`
    }
  ];
}

export function buildPreviewPrompt(payload) {
  const schema = {
    lesson: {
      id: 'preview-generated-id',
      subject: '数学',
      grade: '四年级',
      edition: '人教版',
      title: '角的度量（2）',
      textbookPages: '待家长核对',
      estimatedMinutes: 25,
      goal: '一句课前预习目标',
      sourceNote: '内容来源和人工复核提示',
      knowledgeCards: [
        {
          title: '知识卡标题',
          core: '不超过80字的核心知识',
          keyword: '关键词',
          pitfall: '常见误区',
          question: '留给孩子的预习问题'
        }
      ],
      steps: [
        { id: 'overview', title: '看全貌', subtitle: '我已经知道什么', instruction: '具体动作', placeholder: '填写提示', icon: 'book', reward: 8 },
        { id: 'baseline', title: '测基础', subtitle: '快速试一试', instruction: '具体动作', placeholder: '填写提示', icon: 'clipboard', reward: 8 },
        { id: 'understand', title: '想明白', subtitle: '本课我先观察', instruction: '具体动作', placeholder: '填写提示', icon: 'thinking', reward: 10 },
        { id: 'verify', title: '验理解', subtitle: '用自己的话说', instruction: '具体动作', placeholder: '填写提示', icon: 'reading', reward: 10 },
        { id: 'transfer', title: '练迁移', subtitle: '动手试一试', instruction: '具体动作', placeholder: '填写提示', icon: 'science', reward: 12 },
        { id: 'focus', title: '定重点', subtitle: '我的问题与课堂验证', instruction: '具体动作', placeholder: '填写提示', icon: 'preview', reward: 12 }
      ],
      challenges: {
        recognize: { label: '认一认', question: '单选题', options: ['选项1', '选项2', '选项3'], answer: 0 },
        explain: { label: '说一说', prompt: '让孩子用自己的话解释的任务' },
        apply: { label: '用一用', prompt: '生活迁移或简单应用任务' }
      }
    }
  };

  const title = payload.title || payload.lesson || '新课预习';
  const sourceText = payload.sourceText || payload.material || '';
  const childName = payload.childProfile?.childName || payload.childName || '孩子';

  return [
    {
      role: 'system',
      content: `你是一名小学课前预习单设计专家。预习的目标不是提前把新课讲完，而是帮助孩子激活旧知、观察材料、提出问题、动手尝试，并带着猜想进入课堂。\n\n必须遵守：\n1. 面向小学阶段，短句、明确动作、少术语。\n2. 固定生成 6 步：看全貌、测基础、想明白、验理解、练迁移、定重点；id、title 和 icon 必须与给定 JSON 结构一致。\n3. 生成 3—5 张知识卡。每张包含核心知识、关键词、易错点和一个预习问题。\n4. “认一认”只能有 3 个选项，answer 使用从 0 开始的索引；“说一说”和“用一用”不得直接给标准答案。\n5. 不把预习做成大量刷题，不提前泄露整节课答案；重点是观察、表达、问题和课堂验证。\n6. 数学、科学和语文内容必须逻辑自洽。若用户未提供教材原文，不得虚构精确页码，textbookPages 写“待家长核对”。\n7. sourceNote 必须明确说明是否基于用户提供材料，并提醒家长或教师抽样核对教材表述、图示与答案。\n8. 不设置排行榜、扣分或羞辱性文案。\n9. 只输出合法 JSON，不要 Markdown，不要代码围栏，不要解释。\n\nJSON 结构：${JSON.stringify(schema)}`
    },
    {
      role: 'user',
      content: `请为 ${childName} 生成一份小学课前预习单：\n学科：${payload.subject || '数学'}\n年级：${payload.grade || '四年级'}\n教材版本：${payload.edition || '通用版'}\n课题：${title}\n教材内容或本课要点：${sourceText || '未提供，请使用通用预习结构并标注待核对'}\n额外目标：${payload.goal || '帮助孩子带着问题进入课堂。'}`
    }
  ];
}
