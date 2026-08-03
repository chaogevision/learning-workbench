(function(){
  "use strict";

  const UNIT_MARKUP = "<div class=\"site-shell\">\n<div class=\"preview-adventure-hero\">\n  <div class=\"preview-adventure-copy\">\n    <span class=\"pill\">小学数学五年级下册 · 六步预习</span>\n    <h1>分数的意义和性质</h1>\n    <p>先测试真实起点，再通过知识地图、苏格拉底引导、三关挑战与一题三变完成完整预习闭环。</p>\n    <div class=\"hero-metrics\">\n      <span><strong>7</strong> 张知识卡</span>\n      <span><strong>6</strong> 个互动步骤</span>\n      <span><strong>60</strong> 分钟</span>\n    </div>\n    <div class=\"actions\">\n      <button class=\"btn btn-primary\" id=\"startSixStepPreview\" type=\"button\">开始六步预习</button>\n      <button class=\"btn btn-secondary mode-toggle\" type=\"button\">切换家长模式</button>\n      <button class=\"btn btn-secondary\" id=\"resetUnit\" type=\"button\">重新体验</button>\n    </div>\n  </div>\n  <div class=\"preview-character-stage\">\n    <div class=\"character-speech\"><strong>探索龙 Dino：</strong>先说出你的真实想法，答错也没关系，我们会一步一步找到关键条件。</div>\n    <img class=\"preview-child-character\" src=\"assets/characters/child-preview.png\" alt=\"__CHILD_NAME__正在进行预习探索\">\n    <img class=\"preview-mascot-character\" src=\"assets/characters/mascot-guide.png\" alt=\"探索龙 Dino 正在引导预习\">\n  </div>\n</div>\n<div class=\"preview-control-strip\">\n  <div class=\"brand-copy\"><strong>__CHILD_NAME__的六步预习探险</strong><span>分数的意义和性质 · 教材第 45—77 页</span></div>\n  <div class=\"progress-group\">\n    <div class=\"progress-track\"><div class=\"progress-bar\" id=\"unitProgressBar\"></div></div>\n    <div class=\"progress-text\" id=\"unitProgressText\">0 / 6</div>\n  </div>\n  <div class=\"preview-control-reward\"><span>完成步骤获得</span><strong>成长星</strong></div>\n</div>\n<nav aria-label=\"六步预习导航\" class=\"six-step-nav\" id=\"sixStepNav\"></nav><main class=\"workspace\">\n<section class=\"step-panel active\" data-step-panel=\"0\">\n<div class=\"panel\">\n<div class=\"section-head\"><div><h2>第一步：看全貌</h2><p>先建立单元知识结构，再进入一个核心知识点。</p></div><div class=\"meta-note parent-only\">教材印刷页：[45, 77] · PDF 页：[1, 7]</div></div>\n<div class=\"knowledge-layout\"><article class=\"map-card\"><div class=\"map-grid\" id=\"knowledgeMap\"></div></article><article class=\"detail-card\" id=\"knowledgeDetail\"></article></div>\n<div class=\"continue-bar\"><button class=\"btn btn-primary\" id=\"completeOverviewBtn\" type=\"button\">我已经看完单元全貌</button></div>\n</div>\n</section>\n<section class=\"step-panel\" data-step-panel=\"1\">\n<div class=\"panel\"><div class=\"section-head\"><div><h2>第二步：测基础</h2><p>先留下原始判断，不急着看完整讲解。</p></div><div class=\"meta-note\" id=\"pretestCounter\">第 1 / 2 题</div></div><div class=\"question-stage\" id=\"pretestStage\"></div></div>\n</section>\n<section class=\"step-panel\" data-step-panel=\"2\">\n<div class=\"panel\"><div class=\"section-head\"><div><h2>第三步：想明白</h2><p>不直接给答案，通过图形、问题和递进提示理解核心概念。</p></div><div class=\"meta-note\" id=\"socraticCounter\">引导 1 / 5</div></div><div class=\"socratic-layout\"><article class=\"content-card\" id=\"socraticVisual\"></article><article class=\"question-stage\" id=\"socraticStage\"></article></div></div>\n</section>\n<section class=\"step-panel\" data-step-panel=\"3\">\n<div class=\"panel\"><div class=\"section-head\"><div><h2>第四步：验理解</h2><p>认出来、说清楚、用起来，三关完成才算真正理解。</p></div><div class=\"meta-note\">三关逐步解锁</div></div><div class=\"challenge-grid\" id=\"challengeGrid\"></div><div class=\"continue-bar\" id=\"challengeContinue\"></div></div>\n</section>\n<section class=\"step-panel\" data-step-panel=\"4\">\n<div class=\"panel\"><div class=\"section-head\"><div><h2>第五步：练迁移</h2><p>先看具体错因，再完成母题、换数字、换问法和换情境。</p></div><div class=\"meta-note\" id=\"variationProgressText\">母题与三变 0 / 4</div></div>\n<div class=\"diagnosis-layout\">\n<article class=\"diagnosis-card diagnosis-summary\"><h3>我的错因诊断</h3><p>诊断来自本网页中的真实选择和表达记录，不把所有问题归为“粗心”。</p><div class=\"diagnosis-list\" id=\"diagnosisList\"></div><div class=\"diagnosis-empty\" id=\"diagnosisEmpty\">当前还没有明显错因记录。完成前面步骤后，这里会自动更新。</div></article>\n<article class=\"diagnosis-card variation-card\"><div class=\"variation-tabs\" id=\"variationTabs\"></div><h3 id=\"variationTitle\"></h3><p id=\"variationDescription\"></p><div class=\"visual-frame\" id=\"variationVisual\"></div><div id=\"variationAnswerArea\"></div><div class=\"variation-hints\" id=\"variationHints\"></div><div class=\"feedback\" id=\"variationFeedback\">先独立想一想，再决定是否需要提示。</div><div class=\"button-row\"><button class=\"btn btn-soft\" id=\"variationHintBtn\" type=\"button\">给我一个提示</button><button class=\"btn btn-primary\" id=\"variationSubmitBtn\" style=\"display:none\" type=\"button\">提交答案</button><button class=\"btn btn-secondary\" id=\"variationNextBtn\" style=\"display:none\" type=\"button\">下一题</button></div></article>\n</div><div class=\"continue-bar\" id=\"variationContinue\"></div>\n</div>\n</section>\n<section class=\"step-panel\" data-step-panel=\"5\">\n<div class=\"panel\"><div class=\"section-head\"><div><h2>第六步：定重点</h2><p>复盘已经理解的内容和仍需关注的问题，带着明确目标进入课堂。</p></div><div class=\"meta-note\">预习成果单 · 课堂准备</div></div>\n<div class=\"metric-row\"><div class=\"metric\"><span>已完成步骤</span><strong id=\"metricSteps\">0 / 6</strong></div><div class=\"metric\"><span>累计星星</span><strong id=\"metricStars\">0</strong></div><div class=\"metric\"><span>预习结果</span><strong><span class=\"traffic yellow\" id=\"metricTraffic\">进行中</span></strong></div></div>\n<div class=\"review-grid\"><article class=\"review-card understood-card\"><div class=\"review-kicker\">我已经理解</div><h3>这次预习已经建立的认识</h3><div class=\"review-list\" id=\"understoodList\"></div></article><article class=\"review-card attention-card\"><div class=\"review-kicker\">我还需要关注</div><h3>正式学习前仍需留意的问题</h3><div class=\"review-list\" id=\"attentionList\"></div></article></div>\n<article class=\"class-focus-card\"><div><div class=\"review-kicker\">正式上课重点听</div><h3>带着这些问题进入课堂</h3></div><ol class=\"focus-list\" id=\"formalClassFocusList\"></ol></article>\n<div class=\"print-grid\">\n<article class=\"print-card\"><h3>我还想问老师的问题</h3><p>预习不要求提前全部学会，最重要的是发现自己还不明白什么。</p><div class=\"ask-box\"><textarea id=\"teacherQuestion\"></textarea></div></article>\n<article class=\"print-card\"><h3>我的 1—3—7 复习计划</h3><div class=\"plan-list\" id=\"reviewPlan\"></div></article>\n<article class=\"print-card\"><h3>保存单元知识卡</h3><p>把核心知识卡排版到 A4 页面，方便后续回忆。</p><button class=\"btn btn-primary print-action\" data-print-mode=\"cards\" type=\"button\">打印知识卡</button></article>\n<article class=\"print-card\"><h3>保存我的错因诊断</h3><p>输出本次主要错因和针对性的课堂关注提醒。</p><button class=\"btn btn-primary print-action\" data-print-mode=\"diagnosis\" type=\"button\">打印错因卡</button></article>\n<article class=\"print-card\"><h3>保存一题三变练习单</h3><p>保留母题和三种变化，不打印网页答案。</p><button class=\"btn btn-primary print-action\" data-print-mode=\"variations\" type=\"button\">打印练习单</button></article>\n<article class=\"print-card\"><h3>保存完整预习成果单</h3><p>一次打印知识卡、错因诊断、变式、课堂重点和复习计划。</p><button class=\"btn btn-success print-action\" data-print-mode=\"all\" type=\"button\">打印完整成果单</button></article>\n</div>\n<div class=\"finish-panel\"><div><div class=\"review-kicker\">预习闭环</div><h3>我已经知道正式上课时该重点听什么</h3><p>预习不是提前学完，而是明确已会、未会和课堂重点。</p></div><button class=\"btn btn-primary\" id=\"finishAllBtn\" type=\"button\">完成前五步后确定重点</button></div>\n</div>\n</section>\n</main><div aria-hidden=\"true\" id=\"printRoot\">\n<section class=\"dynamic-print-section print-page\" id=\"printCards\"></section>\n<section class=\"dynamic-print-section print-page\" id=\"printDiagnosis\"></section>\n<section class=\"dynamic-print-section print-page\" id=\"printVariations\"></section>\n<section class=\"dynamic-print-section print-page\" id=\"printResult\"></section>\n</div></div>";

  window.mountSixStepPreview = function(root, data, options={}){
    if(!root || !data) return;
    const childName = String(options.childName || "小明");
    root.innerHTML = UNIT_MARKUP.replaceAll("__CHILD_NAME__", childName.replace(/[&<>"']/g, ""));
    const startButton = root.querySelector("#startSixStepPreview");
    if(startButton) startButton.addEventListener("click",()=>root.querySelector("#sixStepNav")?.scrollIntoView({behavior:"smooth",block:"start"}));

    const stepCompanions = [
      { icon:"map", child:"child-preview.png", mascot:"mascot-guide.png", title:"先画出知识地图", text:"先不用急着做题，点击知识卡看看这个单元要探索哪些概念。" },
      { icon:"tasks", child:"child-think.png", mascot:"mascot-think.png", title:"留下你的第一判断", text:"这一关只记录真实起点。答错不会扣奖励，后面的讲解会根据你的选择继续。" },
      { icon:"thinking", child:"child-think.png", mascot:"mascot-guide.png", title:"一步一步想明白", text:"探索龙不会马上公布答案。先选择、再看提示，最后用自己的话总结。" },
      { icon:"trophy", child:"child-study.png", mascot:"mascot-encourage.png", title:"三关逐步解锁", text:"先认出来，再说清原因，最后把知识用到新的生活情境中。" },
      { icon:"science", child:"child-study.png", mascot:"mascot-guide.png", title:"进入变形实验室", text:"从母题出发，依次换数字、换问法、换情境，检查能不能真正迁移。" },
      { icon:"badge", child:"child-celebrate.png", mascot:"mascot-celebrate.png", title:"生成我的课堂任务卡", text:"系统会汇总已经理解的内容、仍需关注的问题和正式上课重点。" }
    ];
    root.querySelectorAll(".step-panel .panel").forEach((panel,index)=>{
      const guide=stepCompanions[index];
      if(!guide) return;
      const banner=document.createElement("div");
      banner.className="step-companion-banner";
      banner.innerHTML=`<div class="step-companion-copy"><img src="assets/icons/${guide.icon}.svg" alt=""><div><strong>${guide.title}</strong><p>${guide.text}</p></div></div><div class="step-companion-characters"><img src="assets/characters/${guide.child}" alt="${childName}的学习状态"><img src="assets/characters/${guide.mascot}" alt="探索龙 Dino 的引导状态"></div>`;
      const head=panel.querySelector(".section-head");
      if(head) head.insertAdjacentElement("afterend",banner); else panel.prepend(banner);
    });

  const body=root;
  const page="unit";
  const bookId=data?.book?.book_id||"math-preview";
  const unitId=data?.unit?.unit_id||"unit-demo";
  body.dataset.page="unit";
const qs=(selector,scope=body)=>scope.querySelector(selector);
  const qsa=(selector,scope=body)=>Array.from(scope.querySelectorAll(selector));
  const make=(tag,className,text)=>{
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text!==undefined)element.textContent=String(text);
    return element;
  };
  const storageKey=(id)=>`math-six-step:${bookId}:${id}`;
  const modeKey=`math-six-step:${bookId}:mode`;

  function readJSON(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)||"null")??fallback;}
    catch(_){return fallback;}
  }
  function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(_){} }
  function removeProgress(id){try{localStorage.removeItem(storageKey(id));}catch(_){} }

  function setMode(mode){
    body.classList.toggle("parent-mode",mode==="parent");
    qsa(".mode-toggle").forEach(button=>{
      button.textContent=mode==="parent"?"切换孩子模式":"切换家长模式";
    });
    try{localStorage.setItem(modeKey,mode);}catch(_){}
  }
  function initMode(){
    let mode="child";
    try{mode=localStorage.getItem(modeKey)||"child";}catch(_){}
    setMode(mode);
    qsa(".mode-toggle").forEach(button=>button.addEventListener("click",()=>{
      setMode(body.classList.contains("parent-mode")?"child":"parent");
    }));
  }

  function visualElement(visual){
    const wrap=make("div","visual-card");
    if(!visual||!visual.type){
      wrap.append(make("div","generic-visual","本知识点以文字和例题为主。"));
      return wrap;
    }
    const d=visual.data||{};
    const caption=visual.caption||"";
    const addCaption=()=>{if(caption)wrap.append(make("div","fraction-caption",caption));};

    if(visual.type==="fraction_bar"){
      const rows=Array.isArray(d.rows)&&d.rows.length?d.rows:[d];
      rows.forEach(row=>{
        const total=Math.max(1,Number(row.total||1));
        const filled=Math.max(0,Math.min(total,Number(row.filled||0)));
        const bar=make("div","fraction-bar");
        const pieces=make("div","fraction-pieces");
        pieces.style.gridTemplateColumns=`repeat(${total},1fr)`;
        for(let i=0;i<total;i++)pieces.append(make("span","fraction-piece"+(i<filled?" filled":"")));
        bar.append(pieces);
        if(row.label)bar.append(make("div","fraction-caption",row.label));
        wrap.append(bar);
      });
      addCaption();return wrap;
    }
    if(visual.type==="fraction_circle"){
      const total=Math.max(1,Number(d.total||1));
      const filled=Math.max(0,Math.min(total,Number(d.filled||0)));
      const circle=make("div","circle-fraction");
      circle.style.setProperty("--fill",`${filled/total*100}%`);
      wrap.append(circle);addCaption();return wrap;
    }
    if(visual.type==="groups"){
      const groups=Math.max(1,Number(d.groups||1));
      const items=Math.max(1,Number(d.items_per_group||d.itemsPerGroup||1));
      const highlighted=Math.max(0,Math.min(groups,Number(d.highlighted_groups||0)));
      const grid=make("div","group-grid");
      grid.style.setProperty("--groups",String(Math.min(groups,6)));
      for(let group=0;group<groups;group++){
        const box=make("div","group-box"+(group<highlighted?" highlight":""));
        for(let item=0;item<items;item++)box.append(make("span","group-item"));
        grid.append(box);
      }
      wrap.append(grid);addCaption();return wrap;
    }
    if(visual.type==="formula"){
      wrap.append(make("div","formula",d.expression||d.text||caption||"数学关系"));
      if(d.note)wrap.append(make("div","fraction-caption",d.note));
      return wrap;
    }
    if(visual.type==="venn"){
      const venn=make("div","venn");
      venn.append(
        make("div","venn-circle venn-left",d.left||"集合 A"),
        make("div","venn-circle venn-right",d.right||"集合 B"),
        make("div","venn-middle",d.intersection||"共同部分")
      );
      wrap.append(venn);addCaption();return wrap;
    }
    if(visual.type==="number_line"){
      const min=Number(d.min??0),max=Number(d.max??1);
      const points=Array.isArray(d.points)?d.points:[];
      const line=make("div","number-line");
      points.forEach(point=>{
        const value=Number(point.value??point);
        const ratio=max===min?0:(value-min)/(max-min);
        const left=`${Math.max(0,Math.min(1,ratio))*100}%`;
        const tick=make("span","tick");tick.style.left=left;
        const label=make("span","tick-label",point.label??String(value));label.style.left=left;
        line.append(tick,label);
      });
      wrap.append(line);addCaption();return wrap;
    }
    if(visual.type==="grid"){
      const rows=Math.max(1,Number(d.rows||2)),cols=Math.max(1,Number(d.cols||2));
      const filled=Math.max(0,Math.min(rows*cols,Number(d.filled||0)));
      const grid=make("div","grid-visual");grid.style.setProperty("--cols",String(cols));
      for(let i=0;i<rows*cols;i++)grid.append(make("span","grid-cell"+(i<filled?" filled":"")));
      wrap.append(grid);addCaption();return wrap;
    }
    if(visual.type==="classification"){
      const classification=make("div","classify");
      (Array.isArray(d.columns)?d.columns:[]).slice(0,3).forEach(column=>{
        const box=make("div","classify-col");box.append(make("strong","",column.title||"分类"));
        (column.items||[]).forEach(item=>box.append(make("span","",item)));
        classification.append(box);
      });
      wrap.append(classification);addCaption();return wrap;
    }
    if(visual.type==="line_chart"||visual.type==="bar_chart"){
      const values=(d.values||[]).map(Number).filter(Number.isFinite);
      const labels=d.labels||values.map((_,index)=>String(index+1));
      const svgNS="http://www.w3.org/2000/svg";
      const svg=document.createElementNS(svgNS,"svg");svg.setAttribute("viewBox","0 0 520 240");
      const max=Math.max(1,...values),pad=38,width=520-pad*2,height=240-pad*2;
      const axis=document.createElementNS(svgNS,"path");axis.setAttribute("d",`M${pad} ${pad}V${pad+height}H${pad+width}`);axis.setAttribute("fill","none");axis.setAttribute("stroke","#9AA8BD");axis.setAttribute("stroke-width","2");svg.append(axis);
      if(visual.type==="bar_chart"){
        const barWidth=values.length?width/values.length*.58:0;
        values.forEach((value,index)=>{
          const x=pad+(index+.5)*width/values.length-barWidth/2;
          const y=pad+height-(value/max)*height;
          const rect=document.createElementNS(svgNS,"rect");rect.setAttribute("x",x);rect.setAttribute("y",y);rect.setAttribute("width",barWidth);rect.setAttribute("height",pad+height-y);rect.setAttribute("rx","7");rect.setAttribute("fill","var(--primary)");svg.append(rect);
        });
      }else{
        const points=values.map((value,index)=>[pad+(values.length===1?.5:index/(values.length-1))*width,pad+height-(value/max)*height]);
        const path=document.createElementNS(svgNS,"path");path.setAttribute("d",points.map((point,index)=>(index?"L":"M")+point[0]+" "+point[1]).join(" "));path.setAttribute("fill","none");path.setAttribute("stroke","var(--primary)");path.setAttribute("stroke-width","5");path.setAttribute("stroke-linecap","round");path.setAttribute("stroke-linejoin","round");svg.append(path);
        points.forEach(point=>{const circle=document.createElementNS(svgNS,"circle");circle.setAttribute("cx",point[0]);circle.setAttribute("cy",point[1]);circle.setAttribute("r","6");circle.setAttribute("fill","var(--accent)");svg.append(circle);});
      }
      labels.forEach((label,index)=>{const text=document.createElementNS(svgNS,"text");text.setAttribute("x",pad+(index+.5)*width/labels.length);text.setAttribute("y","225");text.setAttribute("text-anchor","middle");text.setAttribute("font-size","12");text.setAttribute("fill","#6D7A91");text.textContent=label;svg.append(text);});
      const holder=make("div","chart-wrap");holder.append(svg);wrap.append(holder);addCaption();return wrap;
    }
    if(visual.type==="rotation"){
      wrap.append(make("div","formula",d.expression||"↻ 90°　→　↻ 180°"));
      wrap.append(make("div","fraction-caption",caption||"观察旋转中心、方向和角度"));return wrap;
    }
    if(visual.type==="prism_net"||visual.type==="geometry_split"){
      const grid=make("div","grid-visual");grid.style.setProperty("--cols",String(d.cols||4));
      const pattern=Array.isArray(d.pattern)?d.pattern:[0,1,0,0,1,1,1,1,0,1,0,0];
      pattern.forEach(on=>grid.append(make("span","grid-cell"+(on?" filled":""))));
      wrap.append(grid);addCaption();return wrap;
    }
    wrap.append(make("div","generic-visual",d.text||caption||"请结合教材图示观察这个知识点。"));
    return wrap;
  }

  function initStart(){
    const enter=qs("#enterSite");
    if(enter)enter.addEventListener("click",()=>{location.href="index.html";});
  }

  function initOverview(){
    const units=data.units||[];
    let completed=0;
    qsa(".unit-card").forEach(card=>{
      const progress=readJSON(storageKey(card.dataset.unitId),null);
      const status=qs(".status",card);
      if(progress&&progress.completed){
        completed+=1;card.classList.add("done");
        if(status)status.textContent=`已完成 · ${progress.level||"已点亮"} · ${progress.stars||0}★`;
      }else if(status){status.textContent="未开始";}
    });
    const bar=qs("#overviewProgressBar"),label=qs("#overviewProgressText");
    if(bar)bar.style.width=`${units.length?completed/units.length*100:0}%`;
    if(label)label.textContent=`${completed} / ${units.length} 已完成`;

    const reset=qs("#resetAllProgress");
    if(reset){
      let armed=false;
      reset.addEventListener("click",()=>{
        if(!armed){armed=true;reset.textContent="再次点击确认清除";reset.classList.add("btn-danger");return;}
        units.forEach(unit=>removeProgress(unit.id));location.reload();
      });
    }
  }

  function initStaticPrint(){
    const button=qs("#staticPrintButton");
    if(button)button.addEventListener("click",()=>window.print());
  }

  function initUnit(){
    const unit=data.unit||{};
    const cards=unit.knowledge_cards||[];
    const pretest=unit.pretest||[];
    const lesson=unit.socratic_lesson||{};
    const lessonSteps=lesson.steps||[];
    const challenges=unit.challenges||[];
    const variations=unit.variations||[];
    const diagnosis=unit.diagnosis||{};
    const review=unit.review||{};

    const defaultState={
      activeStep:0,
      completedSteps:[],
      activeKnowledge:0,
      viewedKnowledge:[0],
      pretestIndex:0,
      pretestAnswers:[],
      socraticIndex:0,
      socraticCompleted:[],
      socraticHints:{},
      socraticFinished:false,
      selfExplanation:"",
      unlockedChallenge:0,
      completedChallenges:[],
      challengeReasons:{},
      variationIndex:0,
      completedVariations:[],
      variationHints:{},
      errors:[],
      stars:0,
      teacherQuestion:"",
      reviewChecks:[],
      finished:false,
      level:""
    };
    const saved=readJSON(storageKey(unit.unit_id),{});
    const state={...defaultState,...saved};
    ["completedSteps","viewedKnowledge","pretestAnswers","socraticCompleted","completedChallenges","completedVariations","errors","reviewChecks"].forEach(key=>{
      if(!Array.isArray(state[key]))state[key]=[...defaultState[key]];
    });
    if(!state.socraticHints||typeof state.socraticHints!=="object")state.socraticHints={};
    if(!state.variationHints||typeof state.variationHints!=="object")state.variationHints={};
    if(!state.challengeReasons||typeof state.challengeReasons!=="object")state.challengeReasons={};

    const nav=qs("#sixStepNav");
    const panels=qsa(".step-panel");
    const topBar=qs("#unitProgressBar"),topLabel=qs("#unitProgressText");
    const stepNames=[
      {key:"看",title:"看全貌",subtitle:"知识地图"},
      {key:"测",title:"测基础",subtitle:"前置小测"},
      {key:"想",title:"想明白",subtitle:"苏格拉底引导"},
      {key:"验",title:"验理解",subtitle:"三关挑战"},
      {key:"练",title:"练迁移",subtitle:"诊断与变式"},
      {key:"定",title:"定重点",subtitle:"课堂准备"}
    ];

    const has=(array,value)=>array.includes(value);
    const addUnique=(array,value)=>{if(!array.includes(value))array.push(value);};
    const save=()=>{
      writeJSON(storageKey(unit.unit_id),state);
      root.dispatchEvent(new CustomEvent("sixstep-progress",{bubbles:true,composed:true,detail:{unitId:unit.unit_id,completedSteps:state.completedSteps.length,stars:state.stars,finished:state.finished,level:state.level,errors:state.errors.length}}));
    };

    function addError(source,misconception,key){
      if(!misconception||!misconception.type||!misconception.message)return;
      const unique=key||`${source}:${misconception.type}:${misconception.message}`;
      if(state.errors.some(item=>item.key===unique))return;
      state.errors.push({key:unique,source,type:misconception.type,message:misconception.message});
      save();renderDiagnosis();
    }

    function completeStep(index){addUnique(state.completedSteps,index);save();renderStepNav();updateProgress();}

    function setStep(index){
      state.activeStep=index;save();
      panels.forEach((panel,panelIndex)=>panel.classList.toggle("active",panelIndex===index));
      renderStepNav();
      if(index===4){renderDiagnosis();renderVariation();}
      if(index===5)renderReview();
      qs(".workspace")?.scrollIntoView({behavior:"smooth",block:"start"});
    }

    function renderStepNav(){
      if(!nav)return;nav.innerHTML="";
      stepNames.forEach((step,index)=>{
        const button=make("button","step-nav-btn"+(index===state.activeStep?" active":"")+(has(state.completedSteps,index)?" complete":""));
        button.type="button";
        const num=make("span","num",has(state.completedSteps,index)?"✓":String(index+1).padStart(2,"0"));
        button.append(num,make("strong","",`${step.key} · ${step.title}`),make("small","",step.subtitle));
        button.addEventListener("click",()=>setStep(index));
        nav.append(button);
      });
    }

    function updateProgress(){
      const count=state.completedSteps.length;
      if(topBar)topBar.style.width=`${count/6*100}%`;
      if(topLabel)topLabel.textContent=state.finished?`已完成 · ${state.level}`:`${count} / 6`;
      const metric=qs("#metricSteps");if(metric)metric.textContent=`${count} / 6`;
    }

    function renderKnowledge(){
      const map=qs("#knowledgeMap"),detail=qs("#knowledgeDetail");
      if(!map||!detail||!cards.length)return;
      map.innerHTML="";
      cards.forEach((card,index)=>{
        const button=make("button","knowledge-node"+(index===state.activeKnowledge?" active":""));button.type="button";
        button.append(make("span","node-num",String(index+1).padStart(2,"0")),make("h3","",card.title),make("small","",`教材第 ${(card.source_pages||[]).join("、")} 页`));
        button.addEventListener("click",()=>{
          state.activeKnowledge=index;addUnique(state.viewedKnowledge,index);save();renderKnowledge();
          detail.scrollIntoView({behavior:"smooth",block:"center"});
        });
        map.append(button);
      });
      const card=cards[state.activeKnowledge]||cards[0];
      detail.innerHTML="";
      const top=make("div","detail-top");top.append(make("span","micro-label",`KNOWLEDGE CARD ${String(state.activeKnowledge+1).padStart(2,"0")}`),make("span","page-chip",`教材 P${(card.source_pages||[]).join("—")}`));
      detail.append(top,make("h3","",card.title),make("div","core-question",card.question));
      const visual=make("div","math-visual");visual.append(visualElement(card.visual));detail.append(visual);
      detail.append(make("div","detail-copy",card.core_idea));
      const chips=make("div","keyword-row");(card.keywords||[]).forEach(keyword=>chips.append(make("span","chip",keyword)));detail.append(chips);
      detail.append(make("div","warning",`易错点：${card.misconception||"请对照教材核验。"}`));
      detail.append(make("div","thinking",`预习问题：${card.preview_question||"正式上课时你还想弄清什么？"}`));
      detail.append(make("div","source-box",`教材来源：第 ${(card.source_pages||[]).join("、")} 页｜前置知识：${card.prerequisite||"见教材"}`));
      const actions=make("div","detail-actions");
      const focusButton=make("button","btn btn-soft",card.id===lesson.focus_card_id?"这个知识点将在第三步深入讲解":"浏览下一张知识卡");focusButton.type="button";
      focusButton.addEventListener("click",()=>{
        if(card.id===lesson.focus_card_id)setStep(2);
        else{state.activeKnowledge=(state.activeKnowledge+1)%cards.length;addUnique(state.viewedKnowledge,state.activeKnowledge);save();renderKnowledge();}
      });
      const printButton=make("button","btn btn-secondary","打印当前知识卡");printButton.type="button";printButton.addEventListener("click",()=>printCurrentCard(card));
      actions.append(focusButton,printButton);detail.append(actions);
    }

    function renderPretest(){
      const stage=qs("#pretestStage"),counter=qs("#pretestCounter");
      if(!stage)return;
      const index=state.pretestIndex;
      if(counter)counter.textContent=`第 ${Math.min(index+1,pretest.length)} / ${pretest.length} 题`;
      if(index>=pretest.length){
        stage.innerHTML="";
        stage.append(make("div","question-label","PRETEST COMPLETE"),make("h3","","前置小测完成"),make("p","lead","你的原始判断已经记录。下一步不会直接灌输结论，而会用图形和问题逐步验证。"),make("div","feedback good","小测的目的不是给分，而是让后续讲解真正回应你的想法。"));
        const button=make("button","btn btn-primary","进入苏格拉底式讲解");button.type="button";button.addEventListener("click",()=>{completeStep(1);setStep(2);});
        const row=make("div","button-row");row.append(button);stage.append(row);return;
      }
      const activity=pretest[index];
      stage.innerHTML="";
      const progress=make("div","stage-progress");pretest.forEach((_,i)=>progress.append(make("span",i<=index?"on":"")));stage.append(progress);
      stage.append(make("div","question-label",activity.kind==="prerequisite"?"前置知识体检":"先猜一猜"),make("h3","",activity.title||activity.prompt),make("p","lead",activity.prompt));
      const choices=make("div","choice-list");
      const recorded=state.pretestAnswers[index];
      (activity.options||[]).forEach((option,optionIndex)=>{
        const button=make("button","choice-btn"+(recorded===optionIndex?" selected":""),option);button.type="button";button.disabled=recorded!==undefined;
        button.addEventListener("click",()=>{
          state.pretestAnswers[index]=optionIndex;
          if(optionIndex!==Number(activity.answer))addError("前置小测",activity.misconceptions?.[String(optionIndex)],`${activity.id}:${optionIndex}`);
          save();renderPretest();
        });choices.append(button);
      });
      stage.append(choices);
      const feedback=make("div","feedback"+(recorded!==undefined?" good":""),recorded!==undefined?(activity.record_message||"答案已经记录。接下来一步一步验证。"):"提交后只记录你的第一判断，不立即展开完整讲解。");stage.append(feedback);
      if(recorded!==undefined){
        const next=make("button","btn btn-primary",index===pretest.length-1?"查看小测记录":"下一题");next.type="button";next.addEventListener("click",()=>{state.pretestIndex+=1;save();renderPretest();});
        const row=make("div","button-row");row.append(next);stage.append(row);
      }
    }

    function correctResponse(activity,response){
      if(activity.type==="choice")return Number(response)===Number(activity.answer);
      if(activity.type==="number")return Number.isFinite(Number(response))&&Math.abs(Number(response)-Number(activity.answer))<=Number(activity.tolerance||0);
      if(activity.type==="text")return Boolean(String(response||"").trim());
      if(activity.type==="order")return JSON.stringify(response)===JSON.stringify(activity.answer||[]);
      return false;
    }

    function misconceptionFor(activity,response){
      if(activity.type==="choice")return activity.misconceptions?.[String(response)];
      return activity.misconceptions?.wrong;
    }

    function buildResponseControls(activity,onSubmit){
      const holder=make("div");
      if(activity.type==="choice"){
        const list=make("div","choice-list");
        (activity.options||[]).forEach((option,index)=>{
          const button=make("button","choice-btn",option);button.type="button";button.dataset.response=String(index);
          button.addEventListener("click",()=>onSubmit(index,button,list));list.append(button);
        });holder.append(list);return holder;
      }
      if(activity.type==="number"){
        const input=make("input","short-input");input.type="number";input.inputMode="decimal";input.placeholder="输入答案";
        const button=make("button","btn btn-primary","提交答案");button.type="button";button.addEventListener("click",()=>onSubmit(input.value,button,holder));
        holder.append(input,button);return holder;
      }
      if(activity.type==="text"){
        const input=make("textarea","answer-input");input.placeholder="写下一句自己的想法";
        const button=make("button","btn btn-primary","提交表达");button.type="button";button.addEventListener("click",()=>onSubmit(input.value,button,holder));
        holder.append(input,button);return holder;
      }
      if(activity.type==="order"){
        let items=[...(activity.options||[])];
        const list=make("div","choice-list");
        const draw=()=>{
          list.innerHTML="";
          items.forEach((item,index)=>{
            const row=make("div","review-item");row.append(make("span","",item));
            const actions=make("div","button-row");
            const up=make("button","mini-btn","↑"),down=make("button","mini-btn","↓");up.type=down.type="button";up.disabled=index===0;down.disabled=index===items.length-1;
            up.addEventListener("click",()=>{[items[index-1],items[index]]=[items[index],items[index-1]];draw();});
            down.addEventListener("click",()=>{[items[index+1],items[index]]=[items[index],items[index+1]];draw();});
            actions.append(up,down);row.append(actions);list.append(row);
          });
        };draw();
        const button=make("button","btn btn-primary","提交顺序");button.type="button";button.addEventListener("click",()=>onSubmit(items,button,holder));
        holder.append(list,button);return holder;
      }
      holder.append(make("div","notice","暂不支持此题型，请在家长模式检查数据。"));return holder;
    }

    function renderSocratic(){
      const stage=qs("#socraticStage"),visualHolder=qs("#socraticVisual"),counter=qs("#socraticCounter");
      if(!stage)return;
      const index=state.socraticIndex;
      const total=lessonSteps.length+1;
      if(counter)counter.textContent=state.socraticFinished?"讲解已完成":`引导 ${Math.min(index+1,total)} / ${total}`;

      if(state.socraticFinished){
        const summary=lesson.summary||{};
        if(visualHolder){visualHolder.innerHTML="";visualHolder.append(visualElement(lesson.visual));}
        stage.innerHTML="";
        const progress=make("div","stage-progress");for(let i=0;i<total;i++)progress.append(make("span","on"));stage.append(progress);
        stage.append(make("div","question-label","SOCRATIC LESSON COMPLETE"),make("h3","","核心知识已经一步一步想明白"),make("p","lead",summary.sample_answer||""),make("div","feedback good","接下来用三关挑战检查能不能认出来、说清楚、用起来。"));
        const go=make("button","btn btn-primary","进入三关挑战");go.type="button";go.addEventListener("click",()=>setStep(3));const row=make("div","button-row");row.append(go);stage.append(row);return;
      }

      if(index>=lessonSteps.length){
        const summary=lesson.summary||{};
        if(visualHolder){visualHolder.innerHTML="";visualHolder.append(visualElement(lesson.visual));}
        stage.innerHTML="";
        const progress=make("div","stage-progress");for(let i=0;i<total;i++)progress.append(make("span","on"));stage.append(progress);
        stage.append(make("div","question-label","用自己的话总结"),make("h3","","最后一步：自我解释"),make("p","lead",summary.prompt||"请用自己的话总结核心知识。"));
        const text=make("textarea","answer-input");text.placeholder="先写下自己的解释，不要求和课本一模一样。";text.value=state.selfExplanation||"";stage.append(text);
        const checklist=make("div","checklist");(summary.checklist||[]).forEach((item,itemIndex)=>{
          const label=make("label");const checkbox=make("input");checkbox.type="checkbox";checkbox.dataset.index=String(itemIndex);label.append(checkbox,make("span","",item));checklist.append(label);
        });stage.append(checklist);
        const reference=make("div","reference-answer");reference.append(make("strong","","教材参考表达："),document.createTextNode(summary.sample_answer||""));stage.append(reference);
        const feedback=make("div","feedback","离线网页不会假装理解开放回答，请用关键要素清单进行自我比较。"),buttons=make("div","button-row");
        const show=make("button","btn btn-soft","查看参考表达"),finish=make("button","btn btn-primary","完成讲解");show.type=finish.type="button";
        show.addEventListener("click",()=>reference.classList.add("show"));
        finish.addEventListener("click",()=>{
          const value=text.value.trim();const checked=qsa("input:checked",checklist).length;
          if(!value){feedback.className="feedback bad";feedback.textContent="先写下一句自己的解释，再完成这一环节。";addError("苏格拉底总结",{type:"表达不完整",message:"尚未尝试用自己的语言总结核心概念。"},`${summary.id}:empty`);return;}
          state.selfExplanation=value;
          if(checked<Math.min(2,(summary.checklist||[]).length))addError("苏格拉底总结",{type:"表达不完整",message:"总结中可能遗漏了教材要求的关键要素。"},`${summary.id}:checklist`);
          state.socraticFinished=true;completeStep(2);save();
          stage.innerHTML="";stage.append(make("div","question-label","SOCRATIC LESSON COMPLETE"),make("h3","","核心知识已经一步一步想明白"),make("p","lead",summary.sample_answer||""),make("div","feedback good","接下来用三关挑战检查能不能认出来、说清楚、用起来。"));
          const go=make("button","btn btn-primary","进入三关挑战");go.type="button";go.addEventListener("click",()=>setStep(3));const row=make("div","button-row");row.append(go);stage.append(row);
        });
        buttons.append(show,finish);stage.append(buttons,feedback);return;
      }

      const activity=lessonSteps[index];
      const completed=has(state.socraticCompleted,index);
      const hintsShown=Number(state.socraticHints[activity.id]||0);
      if(visualHolder){visualHolder.innerHTML="";visualHolder.append(visualElement(activity.visual||lesson.visual));}
      stage.innerHTML="";
      const progress=make("div","stage-progress");for(let i=0;i<total;i++)progress.append(make("span",i<=index?"on":""));stage.append(progress);
      stage.append(make("div","question-label","苏格拉底式引导"),make("h3","",activity.title||`第 ${index+1} 步`),make("p","lead",activity.prompt));
      const feedback=make("div","feedback",completed?(activity.explanation||"已经完成当前步骤。"):("先作出判断；答错后只获得思考提示，不立即公布答案。"));
      if(!completed){
        const controls=buildResponseControls(activity,(response,trigger,container)=>{
          if(correctResponse(activity,response)){
            addUnique(state.socraticCompleted,index);save();renderSocratic();
          }else{
            if(trigger&&trigger.classList)trigger.classList.add("wrong");
            if(trigger&&"disabled" in trigger)trigger.disabled=true;
            addError("苏格拉底讲解",misconceptionFor(activity,response),`${activity.id}:${String(response)}`);
            const current=Number(state.socraticHints[activity.id]||0);
            if(current<(activity.hints||[]).length)state.socraticHints[activity.id]=current+1;
            save();renderSocratic();
          }
        });
        stage.append(controls);
      }
      const hints=make("div","hint-stack");(activity.hints||[]).slice(0,hintsShown).forEach((hint,hintIndex)=>hints.append(make("div","hint-item",`提示 ${hintIndex+1}：${hint}`)));stage.append(hints,feedback);
      const buttons=make("div","button-row");
      if(!completed){
        const hintButton=make("button","btn btn-soft",hintsShown<(activity.hints||[]).length?"再给我一个提示":"提示已全部显示");hintButton.type="button";hintButton.disabled=hintsShown>=(activity.hints||[]).length;
        hintButton.addEventListener("click",()=>{state.socraticHints[activity.id]=Math.min((activity.hints||[]).length,hintsShown+1);save();renderSocratic();});buttons.append(hintButton);
        if(hintsShown>0){
          const reveal=make("button","btn btn-secondary","查看完整答案与解析");reveal.type="button";reveal.addEventListener("click",()=>{addUnique(state.socraticCompleted,index);save();renderSocratic();});buttons.append(reveal);
        }
      }else{
        feedback.className="feedback good";
        const next=make("button","btn btn-primary",index===lessonSteps.length-1?"进入自我解释":"下一步");next.type="button";next.addEventListener("click",()=>{state.socraticIndex+=1;save();renderSocratic();});buttons.append(next);
      }
      stage.append(buttons);
    }

    function completeChallenge(index,reason){
      addUnique(state.completedChallenges,index);state.unlockedChallenge=Math.min(challenges.length-1,Math.max(state.unlockedChallenge,index+1));state.stars+=1;
      if(reason)state.challengeReasons[String(index)]=reason;
      if(state.completedChallenges.length===challenges.length)completeStep(3);
      save();renderChallenges();
    }

    function renderChallenges(){
      const grid=qs("#challengeGrid"),continueArea=qs("#challengeContinue");if(!grid)return;grid.innerHTML="";
      challenges.forEach((activity,index)=>{
        const unlocked=index<=state.unlockedChallenge,completed=has(state.completedChallenges,index);
        const card=make("article","challenge-card"+(!unlocked?" locked":"")+(completed?" complete":""));
        card.append(make("span","challenge-tag",activity.title||["认一认","说一说","用一用"][index]),make("h3","",activity.prompt));
        if(activity.context)card.append(make("p","",activity.context));
        const bodyArea=make("div","challenge-body");
        if(completed){bodyArea.append(make("div","feedback good","本关已完成，获得 1 颗星。"));}
        else if(!unlocked){bodyArea.append(make("div","feedback","完成上一关后解锁。"));}
        else{
          const feedback=make("div","feedback","选择或输入答案开始闯关。"),controls=buildResponseControls(activity,(response,trigger)=>{
            if(!correctResponse(activity,response)){
              if(trigger&&trigger.classList)trigger.classList.add("wrong");if(trigger&&"disabled" in trigger)trigger.disabled=true;
              addError(activity.title||"三关挑战",misconceptionFor(activity,response),`${activity.id}:${String(response)}`);
              feedback.className="feedback bad";feedback.textContent=(activity.hints||[])[0]||"再观察题目中的关键条件。";return;
            }
            if(activity.why_required){
              qsa("button",controls).forEach(button=>button.disabled=true);
              feedback.className="feedback good";feedback.textContent="答案方向正确，再用一句话解释原因。";
              const reason=make("textarea","reason-input");reason.placeholder="用一句话说说为什么";
              const submit=make("button","btn btn-primary","提交原因");submit.type="button";submit.addEventListener("click",()=>{
                const value=reason.value.trim();
                if(!value){feedback.className="feedback bad";feedback.textContent="还差一句自己的解释。";addError(activity.title,{type:"表达不完整",message:"能够选择答案，但尚未说明原因。"},`${activity.id}:reason`);return;}
                feedback.className="feedback good";feedback.textContent=`参考表达：${activity.sample_explanation||activity.explanation}`;completeChallenge(index,value);
              });bodyArea.append(reason,submit);
            }else{feedback.className="feedback good";feedback.textContent=activity.explanation||"回答正确。";completeChallenge(index,"");}
          });
          bodyArea.append(controls,feedback);
        }
        bodyArea.append(make("div","source-box",`教材来源：第 ${(activity.source_pages||[]).join("、")} 页`));card.append(bodyArea);grid.append(card);
      });
      if(continueArea){
        continueArea.innerHTML="";
        if(state.completedChallenges.length===challenges.length){
          const button=make("button","btn btn-primary","进入错因诊断与一题三变");button.type="button";button.addEventListener("click",()=>setStep(4));continueArea.append(button);
        }
      }
    }

    function groupedErrors(){
      const grouped={};
      state.errors.forEach(error=>{
        if(!grouped[error.type])grouped[error.type]={count:0,messages:new Set()};
        grouped[error.type].count+=1;grouped[error.type].messages.add(error.message);
      });
      return Object.entries(grouped).sort((a,b)=>b[1].count-a[1].count);
    }

    function renderDiagnosis(){
      const list=qs("#diagnosisList"),empty=qs("#diagnosisEmpty");if(!list)return;list.innerHTML="";
      const entries=groupedErrors();if(empty)empty.style.display=entries.length?"none":"block";
      entries.forEach(([type,detail])=>{
        const item=make("div","diagnosis-item");const heading=make("strong");heading.append(document.createTextNode(type),make("span","count-chip",detail.count));
        item.append(heading,make("p","",[...detail.messages][0]));list.append(item);
      });
      buildPrintContent();
    }

    function renderVariation(){
      const tabs=qs("#variationTabs"),title=qs("#variationTitle"),description=qs("#variationDescription"),visual=qs("#variationVisual"),answer=qs("#variationAnswerArea"),hints=qs("#variationHints"),feedback=qs("#variationFeedback"),submitButton=qs("#variationSubmitBtn"),progress=qs("#variationProgressText"),continueArea=qs("#variationContinue");
      if(!tabs||!variations.length)return;
      const unlocked=Math.min(variations.length-1,state.completedVariations.length);
      if(state.variationIndex>unlocked)state.variationIndex=unlocked;
      tabs.innerHTML="";
      variations.forEach((item,index)=>{
        const button=make("button","variation-tab"+(index===state.variationIndex?" active":"")+(has(state.completedVariations,index)?" complete":""),(has(state.completedVariations,index)?"✓ ":"")+(item.label||item.title));button.type="button";button.disabled=index>unlocked;
        button.addEventListener("click",()=>{state.variationIndex=index;save();renderVariation();});tabs.append(button);
      });
      const item=variations[state.variationIndex],completed=has(state.completedVariations,state.variationIndex),hintCount=Number(state.variationHints[item.id]||0);
      if(title)title.textContent=item.title;if(description)description.textContent=item.prompt;if(progress)progress.textContent=`母题与三变 ${state.completedVariations.length} / ${variations.length}`;
      if(visual){visual.innerHTML="";visual.append(visualElement(item.visual||lesson.visual));}
      if(answer){answer.innerHTML="";if(!completed){answer.append(buildResponseControls(item,(response,trigger)=>{
        if(correctResponse(item,response)){
          addUnique(state.completedVariations,state.variationIndex);state.stars+=1;if(state.completedVariations.length===variations.length)completeStep(4);save();renderVariation();renderDiagnosis();
        }else{
          if(trigger&&trigger.classList)trigger.classList.add("wrong");
          addError(item.label||"一题三变",misconceptionFor(item,response),`${item.id}:${String(response)}`);
          const currentHints=Number(state.variationHints[item.id]||0);
          if(feedback){feedback.className="feedback bad";feedback.textContent=currentHints<Number(item.hint_limit||0)?"答案还不对，可以先使用下一条提示。":"答案还不对，请重新检查关键关系。";}
        }
      }));}}
      if(hints){hints.innerHTML="";(item.hints||[]).slice(0,hintCount).forEach((hint,index)=>hints.append(make("div","hint-item show",`提示 ${index+1}：${hint}`)));}
      if(feedback){feedback.className="feedback"+(completed?" good":"");feedback.textContent=completed?(item.explanation||"本题已完成。"):("先独立想一想，再决定是否需要提示。");}

      let hintButton=qs("#variationHintBtn");
      if(hintButton){
        const fresh=hintButton.cloneNode(true);hintButton.replaceWith(fresh);hintButton=fresh;
        hintButton.disabled=completed||hintCount>=Number(item.hint_limit||0);
        hintButton.textContent=Number(item.hint_limit||0)===0?"本题独立完成":hintCount>=Number(item.hint_limit||0)?"提示已全部显示":"给我一个提示";
        hintButton.addEventListener("click",()=>{state.variationHints[item.id]=Math.min(Number(item.hint_limit||0),hintCount+1);save();renderVariation();});
      }
      if(submitButton)submitButton.style.display="none";
      let nextButton=qs("#variationNextBtn");
      if(nextButton){
        const fresh=nextButton.cloneNode(true);nextButton.replaceWith(fresh);nextButton=fresh;
        nextButton.style.display=completed?"inline-flex":"none";
        nextButton.textContent=state.variationIndex===variations.length-1?"查看预习成果单":"下一题";
        nextButton.addEventListener("click",()=>{if(state.variationIndex<variations.length-1){state.variationIndex+=1;save();renderVariation();}else setStep(5);});
      }
      if(continueArea){continueArea.innerHTML="";if(state.completedVariations.length===variations.length){const go=make("button","btn btn-primary","进入第六步：定重点");go.type="button";go.addEventListener("click",()=>setStep(5));continueArea.append(go);}}
    }

    function traffic(){
      const thresholds=diagnosis.thresholds||{green_max:2,yellow_max:6};
      const count=state.errors.length;
      if(count<=Number(thresholds.green_max??2))return{label:"绿灯",className:"",message:diagnosis.green||"已经建立初步理解。"};
      if(count<=Number(thresholds.yellow_max??6))return{label:"黄灯",className:"yellow",message:diagnosis.yellow||"概念还需要再巩固。"};
      return{label:"红灯",className:"red",message:diagnosis.red||"建议先复习前置知识。"};
    }

    function understoodItems(){
      const goals=review.mastery_goals||[];
      if(!goals.length)return["继续完成前五步后，这里会自动汇总已经建立的认识。"];
      let count=0;
      if(has(state.completedSteps,0))count=Math.max(count,1);
      if(has(state.completedSteps,2))count=Math.max(count,Math.min(2,goals.length));
      if(has(state.completedSteps,3))count=Math.max(count,Math.min(3,goals.length));
      if(has(state.completedSteps,4))count=goals.length;
      return count?goals.slice(0,count):["继续完成前五步后，这里会自动汇总已经建立的认识。"];
    }

    function attentionItems(){
      const entries=groupedErrors().slice(0,3).map(([type,detail])=>`${type}：${[...detail.messages][0]}`);
      return entries.length?entries:(review.attention_fallback||["暂未发现集中错因，按1-3-7计划再次回忆与检测。"]);
    }

    function renderReview(){
      const understood=qs("#understoodList"),attention=qs("#attentionList"),focus=qs("#formalClassFocusList"),metricSteps=qs("#metricSteps"),metricStars=qs("#metricStars"),metricTraffic=qs("#metricTraffic"),teacher=qs("#teacherQuestion"),plan=qs("#reviewPlan"),finish=qs("#finishAllBtn");
      if(understood)understood.innerHTML=understoodItems().map(item=>`<div class="review-item"><span class="review-dot">✓</span><span>${escapeHTML(item)}</span></div>`).join("");
      if(attention)attention.innerHTML=attentionItems().map(item=>`<div class="review-item"><span class="review-dot">!</span><span>${escapeHTML(item)}</span></div>`).join("");
      if(focus)focus.innerHTML=(review.formal_class_focus||diagnosis.formal_class_focus||[]).map(item=>`<li>${escapeHTML(item)}</li>`).join("");
      if(metricSteps)metricSteps.textContent=`${state.completedSteps.length} / 6`;if(metricStars)metricStars.textContent=String(state.stars);
      const result=traffic();if(metricTraffic){metricTraffic.textContent=state.finished?state.level:result.label;metricTraffic.className=`traffic ${result.className}`.trim();}
      if(teacher){
        teacher.placeholder=review.teacher_question_prompt||"我还不明白的是……";
        if(root.getRootNode().activeElement!==teacher)teacher.value=state.teacherQuestion||"";
        if(teacher.dataset.bound!=="true"){
          teacher.addEventListener("input",()=>{state.teacherQuestion=teacher.value;save();buildPrintContent();});
          teacher.dataset.bound="true";
        }
      }
      if(plan){plan.innerHTML="";(review.review_plan||[]).forEach((item,index)=>{const label=make("label","plan-row");const checkbox=make("input");checkbox.type="checkbox";checkbox.checked=has(state.reviewChecks,index);checkbox.addEventListener("change",()=>{if(checkbox.checked)addUnique(state.reviewChecks,index);else state.reviewChecks=state.reviewChecks.filter(x=>x!==index);save();});label.append(checkbox,make("span","",item));plan.append(label);});}
      if(finish){finish.disabled=!has(state.completedSteps,4)||state.finished;finish.textContent=state.finished?`重点已确定：${state.level}`:(has(state.completedSteps,4)?"完成本次六步预习":"完成前五步后确定重点");}
      buildPrintContent();updateProgress();
    }

    function escapeHTML(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));}

    function buildPrintContent(){
      const printCards=qs("#printCards"),printDiagnosis=qs("#printDiagnosis"),printVariations=qs("#printVariations"),printResult=qs("#printResult");
      if(printCards)printCards.innerHTML=`<h2 class="print-title">${escapeHTML(data.book?.title||"")} · ${escapeHTML(unit.title||"")}知识卡</h2><div class="print-card-grid">${cards.map(card=>`<article class="print-knowledge"><h3>${escapeHTML(card.title)}</h3><p><strong>核心知识：</strong>${escapeHTML(card.core_idea)}</p><p><strong>关键词：</strong>${escapeHTML((card.keywords||[]).join("、"))}</p><p><strong>易错点：</strong>${escapeHTML(card.misconception)}</p><p><strong>预习问题：</strong>${escapeHTML(card.preview_question)}</p><p>教材第 ${escapeHTML((card.source_pages||[]).join("、"))} 页</p></article>`).join("")}</div>`;
      const entries=groupedErrors(),result=traffic();
      if(printDiagnosis)printDiagnosis.innerHTML=`<h2 class="print-title">我的错因诊断卡</h2><div class="print-block"><h3>本次预习结果：${escapeHTML(state.finished?state.level:result.label)}</h3><p>${escapeHTML(result.message)}</p><p>本次记录具体错误或表达不完整：${state.errors.length} 次。</p></div>${entries.length?entries.map(([type,detail])=>`<div class="print-block"><h3>${escapeHTML(type)}（${detail.count}次）</h3><p>${escapeHTML([...detail.messages][0])}</p></div>`).join(""):`<div class="print-block"><h3>暂未发现集中错因</h3><p>${escapeHTML((review.attention_fallback||[])[0]||"建议按1-3-7计划再次回忆。")}</p></div>`}`;
      if(printVariations)printVariations.innerHTML=`<h2 class="print-title">母题与一题三变练习单</h2>${variations.map((item,index)=>`<div class="print-block"><h3>${index+1}. ${escapeHTML(item.title)}</h3><p>${escapeHTML(item.prompt)}</p><div class="print-lines"></div></div>`).join("")}`;
      if(printResult)printResult.innerHTML=`<h2 class="print-title">我的预习成果单与课堂准备</h2><div class="print-block"><h3>我已经理解</h3>${understoodItems().map(item=>`<p>□ ${escapeHTML(item)}</p>`).join("")}</div><div class="print-block"><h3>我还需要关注</h3>${attentionItems().map(item=>`<p>□ ${escapeHTML(item)}</p>`).join("")}</div><div class="print-block"><h3>正式上课重点听</h3>${(review.formal_class_focus||diagnosis.formal_class_focus||[]).map(item=>`<p>• ${escapeHTML(item)}</p>`).join("")}</div><div class="print-block"><h3>我还想问老师的问题</h3><p>${escapeHTML(state.teacherQuestion||"_______________________________________________")}</p><div class="print-lines"></div></div><div class="print-block"><h3>1—3—7复习计划</h3>${(review.review_plan||[]).map(item=>`<p>□ ${escapeHTML(item)}</p>`).join("")}</div>`;
    }

    function printMode(mode){buildPrintContent();body.dataset.printMode=mode;window.print();}
    function printCurrentCard(card){
      const printCards=qs("#printCards");if(!printCards)return;
      printCards.innerHTML=`<h2 class="print-title">当前知识卡</h2><article class="print-knowledge"><h3>${escapeHTML(card.title)}</h3><p><strong>核心知识：</strong>${escapeHTML(card.core_idea)}</p><p><strong>关键词：</strong>${escapeHTML((card.keywords||[]).join("、"))}</p><p><strong>易错点：</strong>${escapeHTML(card.misconception)}</p><p><strong>预习问题：</strong>${escapeHTML(card.preview_question)}</p><p>教材第 ${escapeHTML((card.source_pages||[]).join("、"))} 页</p></article>`;
      body.dataset.printMode="cards";window.print();
    }
    window.addEventListener("afterprint",()=>{delete body.dataset.printMode;buildPrintContent();});

    qsa(".print-action").forEach(button=>button.addEventListener("click",()=>printMode(button.dataset.printMode||"all")));
    const completeOverview=qs("#completeOverviewBtn");if(completeOverview)completeOverview.addEventListener("click",()=>{completeStep(0);setStep(1);});
    const finish=qs("#finishAllBtn");if(finish)finish.addEventListener("click",()=>{
      if(!has(state.completedSteps,4)||state.finished)return;
      const result=traffic();state.finished=true;state.level=result.label;completeStep(5);save();renderReview();
    });
    const reset=qs("#resetUnit");if(reset){let armed=false;reset.addEventListener("click",()=>{
      if(!armed){armed=true;reset.textContent="再次点击确认重置";reset.classList.add("btn-danger");return;}
      removeProgress(unit.unit_id);location.reload();
    });}

    renderStepNav();renderKnowledge();renderPretest();renderSocratic();renderChallenges();renderDiagnosis();renderVariation();renderReview();updateProgress();setStep(Math.max(0,Math.min(5,Number(state.activeStep||0))));
  }
  initMode();
  initUnit();

  };

  class SixStepPreview extends HTMLElement {
    connectedCallback() {
      if(this._mounted) return;
      this._mounted = true;
      const shadow = this.attachShadow({mode:"open"});
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "assets/css/six-step-preview.css";
      const root = document.createElement("div");
      root.className = "six-step-host";
      shadow.append(link, root);
      const mount = () => window.mountSixStepPreview(root, window.PREVIEW_DEMO_DATA, {
        childName:this.getAttribute("child-name") || "小明",
        mascotName:this.getAttribute("mascot-name") || "探索龙 Dino"
      });
      if(window.PREVIEW_DEMO_DATA) mount();
      else window.addEventListener("preview-demo-data-ready", mount, {once:true});
    }
  }

  if(!customElements.get("six-step-preview")) customElements.define("six-step-preview", SixStepPreview);
})();
