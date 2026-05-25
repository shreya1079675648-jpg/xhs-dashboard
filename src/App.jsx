import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as db from "./lib/db";
import * as storage from "./lib/storage";
import { supabase } from "./lib/supabase";

/* ═══════════════════════════════ CONFIG ═══════════════════════════════ */
const ACCENT = "#C8FF00";
const BG = "#0a0a0a";
const CARD = "#141414";
const BORDER = "#1e1e1e";
const MUTED = "#555";
const PILLARS = ["全部","人生重铸","奥德赛模板","身体重铸","副业实验","北漂生活","AI工具"];
const STATUSES = ["灵感池","待写","写作中","待发布","已发布"];

/* ═══════════════════════════ REVIEW: CONSTANTS ══════════════════════════ */
const ST = {
  HOT:       {emoji:"🔥",label:"爆款",      bg:"rgba(127,29,29,0.85)", color:"#fca5a5"},
  EXCELLENT: {emoji:"⭐",label:"优质",      bg:"rgba(29,78,216,0.55)", color:"#93c5fd"},
  POTENTIAL: {emoji:"📈",label:"潜力",      bg:"rgba(20,83,45,0.65)",  color:"#86efac"},
  TOPICAL:   {emoji:"💬",label:"话题型",    bg:"rgba(76,29,149,0.55)", color:"#c4b5fd"},
  LONGTAIL:  {emoji:"🌱",label:"长尾型",    bg:"rgba(19,78,74,0.55)",  color:"#5eead4"},
  UNDERPERF: {emoji:"⚠️", label:"待优化",   bg:"rgba(120,53,15,0.65)", color:"#fcd34d"},
  COLDFAIL:  {emoji:"❄️", label:"冷启动失败",bg:"rgba(31,41,55,0.9)",  color:"#9ca3af"},
  REPETITIVE:{emoji:"🔄",label:"重复疲劳",  bg:"rgba(67,20,7,0.65)",   color:"#fb923c"},
  PENDING:   {emoji:"⏳",label:"待观察",    bg:"rgba(17,24,39,0.9)",   color:"#6b7280"},
};
const PRIORITY = {
  immediate:{label:"立即",color:"#ef4444",bg:"rgba(127,29,29,0.5)"},
  today:    {label:"今天",color:"#f59e0b",bg:"rgba(120,53,15,0.5)"},
  this_week:{label:"本周",color:"#6b7280",bg:"rgba(31,41,55,0.7)"},
};
const JUDGMENT = {
  exceeded:{label:"超预期",   bg:ACCENT,                       color:"black"},
  met:     {label:"符合预期", bg:"rgba(255,255,255,0.1)",      color:"white"},
  below:   {label:"低于预期", bg:"rgba(127,29,29,0.6)",        color:"#fca5a5"},
  abnormal:{label:"数据异常", bg:"rgba(120,53,15,0.6)",        color:"#fcd34d"},
};

/* ═══════════════════════════ CALENDAR: CONSTANTS ════════════════════════ */
const TYPE_COLOR = {
  人生重铸:  "#DDF76A",
  奥德赛模板:"#DCD7F4",
  身体重铸:  "#D8E8EF",
  副业实验:  "#F0D5C5",
  北漂生活:  "#DDEDE3",
};
const STATUS_DOT = {
  已发布:"#C8FF00", 待发布:"#ffffff", 草稿:"#8A8E86", 待写:"#8A8E86",
};
const WEEKDAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MONTH_NAMES = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
const CAL_TYPE_GROUPS = {
  "全部":    [],
  "人生设计":["人生重铸","奥德赛模板"],
  "生活实验":["身体重铸","北漂生活"],
  "探索区":  ["副业实验","AI工具"],
};

/* ════════════════════════ INDEXEDDB IMAGE STORE ═════════════════════════ */
/* Stores per-note image arrays separately from topics (base64 dataURLs are huge) */
const IDB_NAME="xhs_images_db";
const IDB_STORE="note_images";
const openImgDB=()=>new Promise((res,rej)=>{
  const req=indexedDB.open(IDB_NAME,1);
  req.onupgradeneeded=()=>req.result.createObjectStore(IDB_STORE);
  req.onsuccess=()=>res(req.result);
  req.onerror=()=>rej(req.error);
});
const idbSaveImages=async(noteId,images)=>{
  try{
    const db=await openImgDB();
    return new Promise((res,rej)=>{
      const tx=db.transaction(IDB_STORE,"readwrite");
      const store=tx.objectStore(IDB_STORE);
      if(!images||images.length===0)store.delete(noteId);
      else store.put(images,noteId);
      tx.oncomplete=()=>res();
      tx.onerror=()=>rej(tx.error);
    });
  }catch(e){console.warn("[idb] save failed",e);}
};
const idbLoadAllImages=async()=>{
  try{
    const db=await openImgDB();
    return new Promise((res,rej)=>{
      const tx=db.transaction(IDB_STORE,"readonly");
      const store=tx.objectStore(IDB_STORE);
      const result={};
      const cursorReq=store.openCursor();
      cursorReq.onsuccess=()=>{
        const cur=cursorReq.result;
        if(cur){result[cur.key]=cur.value;cur.continue();}
        else res(result);
      };
      cursorReq.onerror=()=>rej(cursorReq.error);
    });
  }catch(e){console.warn("[idb] load failed",e);return{};}
};
const idbDeleteImages=async(noteId)=>{
  try{
    const db=await openImgDB();
    return new Promise((res)=>{
      const tx=db.transaction(IDB_STORE,"readwrite");
      tx.objectStore(IDB_STORE).delete(noteId);
      tx.oncomplete=()=>res();
    });
  }catch(e){}
};

/* Cover image stored under key `cover_${noteId}` in same IDB store */
const idbSaveCover=async(noteId,dataUrl)=>{
  try{
    const db=await openImgDB();
    return new Promise((res,rej)=>{
      const tx=db.transaction(IDB_STORE,"readwrite");
      const store=tx.objectStore(IDB_STORE);
      if(!dataUrl)store.delete(`cover_${noteId}`);
      else store.put(dataUrl,`cover_${noteId}`);
      tx.oncomplete=()=>res();
      tx.onerror=()=>rej(tx.error);
    });
  }catch(e){console.warn("[idb] cover save failed",e);}
};

/* ═══════════════════════════════ UTILITIES ══════════════════════════════ */
const uid = () => Math.random().toString(36).slice(2,10);
const countChars = (s) => (s||"").replace(/\s/g,"").length;
const hasConflict = (s) => ["以为","没想到","不是","才发现","终于","不再","却","反而","原来"].some(w=>(s||"").includes(w));
const fmtRate = (n,d) => d>0?(n/d*100).toFixed(1):"0.0";
const fmtNum = (n) => (+n||0).toLocaleString();
const devPct = (actual,expected) => expected>0?Math.round((actual-expected)/expected*100):0;

const computeStatusTags = (note) => {
  if (!note.snapshots?.length) return ["PENDING"];
  const latest = note.snapshots[note.snapshots.length-1];
  const first1h = note.snapshots.find(s=>s.type==="1h");
  const tags=[];
  const pred = note.aiPrediction?.predictions;
  const lr = latest.views>0?latest.likes/latest.views*100:0;
  const cr = latest.views>0?latest.collects/latest.views*100:0;
  const cmr= latest.views>0?latest.comments/latest.views*100:0;
  if (first1h && first1h.views < 500) tags.push("COLDFAIL");
  if (pred) {
    if (latest.views >= pred.views.max*1.5) tags.push("HOT");
    else if (latest.views >= pred.views.median && (lr>=6.0||cr>=5.0)) tags.push("EXCELLENT");
    else if (latest.views < pred.views.min && !tags.includes("COLDFAIL")) tags.push("UNDERPERF");
    else if (cr>=5.0 && !tags.length) tags.push("POTENTIAL");
  }
  if (cmr>=1.8) tags.push("TOPICAL");
  return tags.length?tags:["PENDING"];
};

/* Board utilities (existing) */
const judgePost=(p)=>{const v=+p.views||0,s=+p.saves||0,c=+p.comments||0,f=+p.followers||0;if(v>=8000||f>=50||(v>0&&c/v>=0.005))return"超预期";if(v>=2500||(v>0&&s/v>=0.04))return"符合预期";return"待优化";};
const statusColor=(s)=>{const m={"灵感池":{bg:"#1e1e1e",color:"#888"},"待写":{bg:"rgba(88,28,135,0.4)",color:"#c4b5fd"},"写作中":{bg:"rgba(29,78,216,0.4)",color:"#93c5fd"},"待发布":{bg:"rgba(120,53,15,0.4)",color:"#fcd34d"},"已发布":{bg:"rgba(200,255,0,0.15)",color:"#C8FF00"},"超预期":{bg:"#C8FF00",color:"black"},"符合预期":{bg:"rgba(255,255,255,0.1)",color:"white"},"待优化":{bg:"rgba(127,29,29,0.4)",color:"#fca5a5"}};return m[s]||{bg:"#1e1e1e",color:"#888"};};
const generateCover=(title)=>{if(!title)return"30+\n人生草稿";if(title.includes("巴西")||title.includes("外派"))return"以为是镀金\n没想到熔掉我";if(title.includes("北漂"))return"30岁北漂\n不是因为勇敢";if(title.includes("奥德赛")||title.includes("版本"))return"不是迷茫\n是没版本";if(title.includes("AI"))return"AI不是焦虑\n是工具箱";if(title.includes("健身")||title.includes("攀岩")||title.includes("变瘦"))return"不是变小\n是变强";return title.length>10?`${title.slice(0,6)}\n${title.slice(6,14)}`:title;};
const generateBody=(title)=>`${title||"这篇笔记"}\n\n我最近一直在想一件事：30岁以后，很多变化不是突然发生的，而是你终于不想再按默认设置活了。\n\n以前我总觉得，人生应该有一条比较标准的路线。可是在巴西外派一年后，我发现自己被彻底打开了。\n\n所以这篇想记录一个真实过程：我怎么从原来的惯性生活里走出来。\n\n不是逆袭，也不是鸡血。只是一个普通女生，开始认真把自己当成一个长期项目来经营。`;
const compressBody=(b)=>{if(!b||b.length<=520)return b||"";return b.slice(0,500)+"\n\n如果你也在30岁左右卡住，可以先问自己：我是不是还有另一种人生版本没有写出来？";};
const addEmotion=(b)=>{if(!b)return"";if(b.includes("重新长出来"))return b;return"我以前一直以为，30岁之后就该把自己定下来。\n\n后来我才发现，我真正需要的不是定型，而是重新长出来。\n\n"+b;};
const addEnding=(b)=>{if(!b)return"";if(b.includes("评论区"))return b;return b+"\n\n你们有没有类似的时刻：突然发现自己不想再按原来的生活方式继续了？评论区告诉我。";};
const titleSuggestions=(base)=>{const pool=["以为外派镀金却熔掉我","30岁北漂不是因为勇敢","不是迷茫是没有版本","我终于不想装稳了","30岁不是截止日期","不想变瘦只想变强","学AI不是为了更卷","我开始重写人生草稿"];if(base?.includes("巴西"))pool.unshift("巴西没镀金而是熔掉了我","外派后我不想装稳了");if(base?.includes("北漂"))pool.unshift("北漂不是逃离是重启","有房有车30岁北漂她们说我疯了");if(base?.includes("AI"))pool.unshift("普通人也该学AI","AI让我重铸了工作方式");return[...new Set(pool)].filter(t=>countChars(t)>=8&&countChars(t)<=18).slice(0,8);};

/* ════════════════════════ CALENDAR HELPERS ════════════════════════════ */
const groupNotesByDate=(notes)=>{const r={};notes.forEach(n=>{const d=n.publish_date||"";if(!r[d])r[d]=[];r[d].push(n);});return r;};
const buildCalendarCells=(year,monthIndex)=>{const firstDay=new Date(year,monthIndex,1).getDay();const daysInMonth=new Date(year,monthIndex+1,0).getDate();const cells=[];for(let i=0;i<firstDay;i++)cells.push(null);for(let day=1;day<=daysInMonth;day++)cells.push(day);return cells;};
const formatDateKey=(year,monthIndex,day)=>`${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
const getTodayStr=()=>{const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;};
const getMonthNotes=(notes,year,monthIndex)=>notes.filter(n=>{if(!n.publish_date)return false;const d=new Date(`${n.publish_date}T00:00:00`);return d.getFullYear()===year&&d.getMonth()===monthIndex;}).sort((a,b)=>(a.publish_date||"").localeCompare(b.publish_date||""));
const getCalDisplayDate=(note,todayStr)=>{if(note.status==="待发布"&&note.publish_date>todayStr)return"待定";return(note.publish_date||"").slice(5).replace("-","/");};

/* ════════════════════════════ SEED DATA ════════════════════════════════ */
const SEED_TOPICS=[
  /* ── 已发布：带完整复盘数据 ── */
  {
    id:uid(),title:"我以为外派是镀金，没想到把我整个人熔掉了",
    pillar:"人生重铸",status:"已发布",score:92,goal:"人设/共鸣",tag:"置顶候选",
    noteType:"image",publishTime:"2026-05-19T21:00:00",
    tags:["人生感悟","30岁","外派经历","女性成长"],coverText:"以为是镀金\n没想到熔掉我",
    aiPrediction:{confidence:0.72,predictions:{views:{min:3200,median:5400,max:8500},likeRate:{min:4.2,median:5.5,max:6.8},collectRate:{min:3.5,median:4.5,max:5.5},commentRate:{min:0.8,median:1.1,max:1.5},newFollowers:{min:15,median:25,max:40}},
      reasons:[{type:"title",score:8.2,baseline:7.8,desc:"标题情绪强度8.2，高于你的爆款均值7.8"},{type:"time_slot",score:null,baseline:null,desc:"周一21:00，你历史数据的TOP2发布时段"},{type:"structure",score:null,baseline:null,desc:"痛点→转折→感悟，命中账号爆款模式#3"}],
      risks:["封面文字偏多，移动端小屏可读性弱","与4月29日一篇内容主题重合度约55%"]},
    snapshots:[
      {id:uid(),type:"1h",time:"2026-05-19T22:00:00",views:58,likes:2,collects:0,comments:1,shares:0,newFollowers:0,
        aiDiagnosis:{overallJudgment:"below",deviationPct:-89,keyInsight:"1h仅58浏览 = 平台初始推荐池极小。冷启动失败，内容未获初始分发，需立即干预提升互动密度。",
          metricAnalysis:[{metric:"浏览",actual:58,expected:300,deviationPct:-81,interpretation:"推荐池极小"},{metric:"评论",actual:1,expected:3,deviationPct:-67,interpretation:"互动信号不足"}],
          issueDiagnosis:[{probability:70,issue:"发布瞬间互动信号不足",detail:"平台在发布后1h内评估互动率，互动不足则减少后续推荐",evidence:"1h内评论仅1条，点赞2个"},{probability:20,issue:"话题标签进不了大流量池",detail:"#外派经历 搜索量极低，无法通过标签发现",evidence:"流量来源分析"},{probability:10,issue:"发布时段竞争激烈",detail:"同时段有同类内容在竞争推荐位",evidence:"小概率因素"}],
          actions:[{priority:"immediate",action:"置顶评论激活互动",detail:"立即发评论：「30岁以后你们有没有类似的时刻？想听你们的故事」",expectedEffect:"激活评论信号，触发平台重新评估推荐"},{priority:"immediate",action:"私信5位好友请求互动",detail:"请亲密好友点赞+收藏，提升初始互动密度到平台推荐阈值",expectedEffect:"突破冷启动，触发平台二次推荐"},{priority:"today",action:"更换话题标签",detail:"把 #外派经历 改为 #女性成长 #30岁 #人生感悟（搜索量各增5-50倍）",expectedEffect:"进入更大流量池"}],
          historicalReference:null}},
      {id:uid(),type:"24h",time:"2026-05-20T21:00:00",views:2100,likes:143,collects:87,comments:24,shares:5,newFollowers:8,
        aiDiagnosis:{overallJudgment:"below",deviationPct:-61,keyInsight:"流量低+互动高 = 内容质量过关，但平台未给足推荐池。判断为冷启动失败，内容本身有潜力可挖。",
          metricAnalysis:[{metric:"浏览",actual:2100,expected:5400,deviationPct:-61,interpretation:"流量池偏小"},{metric:"点赞率",actual:6.8,expected:5.5,deviationPct:24,interpretation:"内容质量高于预期"},{metric:"藏阅比",actual:4.1,expected:4.5,deviationPct:-9,interpretation:"干货感基本到位"},{metric:"评阅比",actual:1.14,expected:1.1,deviationPct:4,interpretation:"互动正常"},{metric:"新增粉丝",actual:8,expected:25,deviationPct:-68,interpretation:"流量不够带不动"}],
          issueDiagnosis:[{probability:72,issue:"标题关键词不在搜索池",detail:"'熔掉我'词组搜索量极低，用户无法通过搜索找到这篇笔记，流量完全依赖推荐",evidence:"流量来源分析：>95%来自关注者推送，搜索流量≈0"},{probability:21,issue:"话题标签竞争过卷",detail:"#职场话题日发帖量超5万条，新账号难以在这个标签下获得曝光",evidence:"互动率高但总流量没起来，说明内容本身没问题"},{probability:7,issue:"发布时间竞争",detail:"同时段有大V发布相似主题，分走了部分推荐流量",evidence:"小概率因素"}],
          actions:[{priority:"immediate",action:"修改标题增加搜索词",detail:"改为「30岁女生外派一年：以为镀金，没想到把我整个人改变了」，加入高搜索量关键词",expectedEffect:"搜索流量提升5-10倍"},{priority:"immediate",action:"置顶互动引导评论",detail:"「你们30岁有没有一个让你完全改变的时刻？」",expectedEffect:"提升话题热度，触发平台二次推荐"},{priority:"today",action:"更换3个话题标签",detail:"删掉 #外派经历，换成 #女性成长 #30岁的人生思考 #人生感悟",expectedEffect:"进入搜索量更大的流量池"},{priority:"this_week",action:"发布第二条系列笔记",detail:"「在巴西我才发现，我一直把自己当员工在活」作为系列续集",expectedEffect:"引流到第一条，带动整体数据"}],
          historicalReference:{similarity:"与4月17日笔记24h数据完全吻合（同样-55%偏差，但互动率异常高）",outcome:"改标题后72h浏览从2800反弹到7800，最终突破爆款线",successRate:68}}}],
  },
  {
    id:uid(),title:"北漂第一年：我以为我很勇敢，才发现我只是在逃跑",
    pillar:"北漂生活",status:"已发布",score:87,goal:"涨粉/共鸣",tag:"爆款",
    noteType:"image",publishTime:"2026-05-15T21:00:00",
    tags:["北漂","30岁","女性成长","人生感悟"],coverText:"30岁北漂\n不是因为勇敢",
    aiPrediction:{confidence:0.68,predictions:{views:{min:2800,median:4200,max:7000},likeRate:{min:4.0,median:5.2,max:7.0},collectRate:{min:3.0,median:4.2,max:5.8},commentRate:{min:0.9,median:1.3,max:2.0},newFollowers:{min:10,median:20,max:35}},
      reasons:[{type:"title",score:8.5,baseline:7.8,desc:"双冲突词'以为+才发现'，情绪张力高于均值"},{type:"tag",score:null,baseline:null,desc:"#北漂 话题活跃，月搜索量50万+"},{type:"cover",score:7.2,baseline:6.8,desc:"封面文字精炼，移动端可读性好"}],
      risks:["北漂话题同质化严重，需要强差异化切入点"]},
    snapshots:[
      {id:uid(),type:"1h",time:"2026-05-15T22:00:00",views:420,likes:28,collects:15,comments:6,shares:2,newFollowers:3,aiDiagnosis:null},
      {id:uid(),type:"24h",time:"2026-05-16T21:00:00",views:6800,likes:408,collects:312,comments:89,shares:22,newFollowers:38,
        aiDiagnosis:{overallJudgment:"exceeded",deviationPct:62,keyInsight:"藏阅比4.6%+评阅比1.3%双超预期 = 内容既有干货价值又引发强共鸣，平台判断为优质内容持续加推。",
          metricAnalysis:[{metric:"浏览",actual:6800,expected:4200,deviationPct:62,interpretation:"超预期爆发"},{metric:"点赞率",actual:6.0,expected:5.2,deviationPct:15,interpretation:"内容共鸣强"},{metric:"藏阅比",actual:4.6,expected:4.2,deviationPct:10,interpretation:"干货价值充足"},{metric:"评阅比",actual:1.31,expected:1.3,deviationPct:1,interpretation:"符合预期"},{metric:"新增粉丝",actual:38,expected:20,deviationPct:90,interpretation:"人设转化力强"}],
          issueDiagnosis:[],
          actions:[{priority:"immediate",action:"立即跟进第二条系列笔记",detail:"发布「在北漂第二年，我才明白为什么来」，趁流量窗口开24-48h",expectedEffect:"顺势再带200-500新粉丝"},{priority:"today",action:"置顶最有共鸣的评论",detail:"找到评论中最多人回复的那条，置顶并认真回复一段话",expectedEffect:"持续活跃评论区，维持推荐热度"},{priority:"this_week",action:"提炼爆款结构复用",detail:"这篇爆款的结构是'反预期标题+以为→才发现的反转+具体经历'，下周复用到身体重铸主题",expectedEffect:"成功率预计60-70%"}],
          historicalReference:null}},
      {id:uid(),type:"72h",time:"2026-05-18T21:00:00",views:11200,likes:672,collects:520,comments:145,shares:38,newFollowers:62,aiDiagnosis:null}],
  },
  {
    id:uid(),title:"不是为了变瘦，是为了不再讨厌自己的身体",
    pillar:"身体重铸",status:"已发布",score:91,goal:"涨粉/共鸣",tag:"爆款",
    noteType:"image",publishTime:"2026-05-08T21:00:00",
    tags:["健身","女性成长","身体自信","30岁"],coverText:"不是变小\n是变强",
    aiPrediction:{confidence:0.65,predictions:{views:{min:2000,median:3500,max:6000},likeRate:{min:5.0,median:6.5,max:8.5},collectRate:{min:4.5,median:5.8,max:7.5},commentRate:{min:1.2,median:1.8,max:2.8},newFollowers:{min:8,median:18,max:30}},
      reasons:[{type:"title",score:7.8,baseline:7.8,desc:"情绪转折词有力，身体自信赛道受众精准"},{type:"cover",score:8.1,baseline:6.8,desc:"封面简洁有力，移动端识别度高"}],
      risks:["健身赛道竞争激烈，需要强化个人故事差异化"]},
    snapshots:[
      {id:uid(),type:"1h",time:"2026-05-08T22:00:00",views:680,likes:52,collects:38,comments:11,shares:4,newFollowers:5,aiDiagnosis:null},
      {id:uid(),type:"24h",time:"2026-05-09T21:00:00",views:8900,likes:623,collects:712,comments:187,shares:45,newFollowers:71,
        aiDiagnosis:{overallJudgment:"exceeded",deviationPct:154,keyInsight:"藏阅比高达8.0%，远超预期5.8% = 用户把这篇当'资料'收藏而非单纯欣赏，意味着强干货属性，平台持续分发。",
          metricAnalysis:[{metric:"浏览",actual:8900,expected:3500,deviationPct:154,interpretation:"爆款级别"},{metric:"点赞率",actual:7.0,expected:6.5,deviationPct:8,interpretation:"高于预期"},{metric:"藏阅比",actual:8.0,expected:5.8,deviationPct:38,interpretation:"干货爆款"},{metric:"评阅比",actual:2.1,expected:1.8,deviationPct:17,interpretation:"话题热度高"},{metric:"新增粉丝",actual:71,expected:18,deviationPct:294,interpretation:"强人设转化"}],
          issueDiagnosis:[],
          actions:[{priority:"immediate",action:"这篇的成功模式要记录到爆款库",detail:"结构：反预期标题+身体观念颠覆+具体改变过程，这个模式在身体重铸赛道验证有效",expectedEffect:"指导下篇身体主题选题"},{priority:"today",action:"在评论区回复有深度的问题",detail:"针对问'怎么做到的'的评论详细回复，扩展评论串长度",expectedEffect:"触发更多人参与，维持热度"}],
          historicalReference:null}}],
  },
  /* ── 未发布笔记 ── */
  {id:uid(),title:"在巴西我才发现，我一直把自己当员工在活",pillar:"人生重铸",status:"待发布",score:90,goal:"人设/共鸣",tag:"第二条"},
  {id:uid(),title:"那个让我一夜不焦虑的人生规划模板",pillar:"奥德赛模板",status:"待写",score:88,goal:"模板转化",tag:"转化主推"},
  {id:uid(),title:"全世界都是草台班子",pillar:"人生重铸",status:"待写",score:85,goal:"涨粉/共鸣",tag:"养号"},
  {id:uid(),title:"健身不是为了把自己缩小",pillar:"身体重铸",status:"灵感池",score:81,goal:"涨粉/共鸣",tag:"涨粉"},
  {id:uid(),title:"28岁我才第一次认真想钱要怎么管",pillar:"人生重铸",status:"灵感池",score:80,goal:"收藏/引流",tag:"理财"},
  {id:uid(),title:"我做了一个奥德赛人生推演小游戏",pillar:"副业实验",status:"灵感池",score:79,goal:"评论/测试",tag:"产品验证"},
  {id:uid(),title:"女生北漂租房必查20项",pillar:"北漂生活",status:"灵感池",score:85,goal:"搜索/收藏",tag:"好物铺垫"},
];
const SEED_COMMENTS=[
  {id:uid(),scene:"求模板",reply:"模板整理好了～私信发你完整版！麻烦点个关注方便后续找到我哦",tag:"引流"},
  {id:uid(),scene:"好勇敢",reply:"不是勇敢哈哈，是被熔掉之后就没法假装没变过了",tag:"人设"},
  {id:uid(),scene:"我也想北漂",reply:"如果你也在纠结，推荐你先做一个奥德赛计划，把几种可能的人生都写出来再决定",tag:"转化"},
  {id:uid(),scene:"怎么做到的",reply:"其实就是在巴西认识了不同圈子的人，发现信息差真的很大，回来就不想再待在原来的频道了",tag:"人设"},
];
const WEEK_SLOTS=[{day:"周二",time:"21:00",type:"人生重铸"},{day:"周四",time:"21:00",type:"观点/干货"},{day:"周六",time:"21:00",type:"副线/运动"},{day:"周日",time:"20:30",type:"周复盘"}];

const SEED_CAL_NOTES = [
  {id:"c1",title:"我以为外派是镀金，没想到把我整个人熔掉了",publish_date:"2026-05-19",status:"已发布",type:"人生重铸"},
  {id:"c2",title:"不是为了变瘦，是为了不再讨厌自己的身体",  publish_date:"2026-05-08",status:"已发布",type:"身体重铸"},
  {id:"c3",title:"北漂第一年：我以为我很勇敢，才发现我只是在逃跑",publish_date:"2026-05-15",status:"已发布",type:"北漂生活"},
  {id:"c4",title:"在巴西我才发现，我一直把自己当员工在活",  publish_date:"2026-05-22",status:"待发布",type:"人生重铸"},
  {id:"c5",title:"那个让我一夜不焦虑的人生规划模板",        publish_date:"2026-05-27",status:"待发布",type:"奥德赛模板"},
  {id:"c6",title:"副业第3个月：我到底赚到了什么",            publish_date:"2026-05-29",status:"待发布",type:"副业实验"},
  {id:"c7",title:"全世界都是草台班子",                       publish_date:"2026-05-31",status:"草稿",   type:"人生重铸"},
  {id:"c8",title:"女生北漂租房必查20项",                     publish_date:"2026-06-05",status:"待发布",type:"北漂生活"},
  {id:"c9",title:"学AI不是为了更卷",                         publish_date:"2026-06-10",status:"草稿",   type:"副业实验"},
];

/* ─── REVIEW: ACCOUNT PROFILE ─── */
const ACCOUNT_PROFILE_DATA = {
  medianViews: 4200,
  baselineLikeRate: 5.5,
  baselineCollectRate: 4.2,
  baselineCommentRate: 1.1,
  hitRate: 28,
  bestPostTimes: ["周一 21:00","周四 20:30","周六 21:00"],
  totalNotes: 12,
  totalFollowers: 342,
};

/* ─── PATTERN REPORT MOCK ─── */
const PATTERN_REPORT = {
  periodSummary:{totalNotes:12,hitCount:3,excellentCount:4,underperfCount:2},
  hitPatterns:{
    title:"100%使用双冲突结构（以为…才发现 / 不是…而是），字数集中在14-18字",
    cover:"封面文字≤10字，对比色背景+白色大字，统一有「@Shreya」署名",
    structure:"痛点开篇→转折经历（占60%篇幅）→方法论/感悟→互动引导",
    time_slot:"周一/周四 21:00 命中爆款概率最高（周六略低）",
    length:"正文700-900字，分段均匀，段落≤5行",
    tag_combo:"「女性成长」+「30岁」组合使用时，搜索流量明显更高",
  },
  failPatterns:{
    title:"标题过度文艺，缺少明确搜索关键词，导致搜索流量为0",
    cover:"封面信息量过多（>15字），移动端识别度低",
    structure:"开头过于平铺直叙，缺少强钩子，滑走率偏高",
    time_slot:"周三发布的3篇均表现平平",
    length:"超过1100字的笔记完读率明显下降",
    tag_combo:"单独使用「职场」大标签时，新号竞争不过头部账号",
  },
  strategies:[
    {priority:1,strategy:"下周优先发身体重铸系列第二篇",rationale:"身体类内容本月爆款率100%（2/2），赛道验证成功",expectedImpact:"预计浏览6000-12000"},
    {priority:2,strategy:"所有标题加入「30岁女生」或「女性」定语",rationale:"数据显示加了人群定语的标题CTR高出28%",expectedImpact:"整体浏览量提升15-25%"},
    {priority:3,strategy:"将北漂笔记做成系列（至少3篇）",rationale:"爆款笔记已验证人群匹配，系列化可快速扩粉",expectedImpact:"系列3篇合计涨粉预计200-400"},
    {priority:4,strategy:"建立「改标题」SOP，每篇笔记发布后24h必查",rationale:"2篇冷启动失败案例都通过改标题显著反弹",expectedImpact:"减少失败率约40%"},
    {priority:5,strategy:"封面风格标准化，固定「深色背景+大字+署名」模板",rationale:"已验证成功的3篇爆款封面风格高度一致",expectedImpact:"封面统一后账号辨识度提升，老用户复访率+"},
  ],
  skillEvolution:{
    mastered:["冲突标题写法","身体主题切入","评论区互动引导"],
    improving:["北漂/生活类叙事","AI工具题材","话题标签选择"],
    weakAreas:["搜索SEO优化（关键词研究）","视频笔记制作","对标账号学习"],
  },
};

/* ═══════════════════════════ SHARED COMPONENTS ═══════════════════════════ */
const Badge=({children,style={},className=""})=>(
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ${className}`} style={style}>{children}</span>
);
const StatusBadge=({status})=>{const c=statusColor(status);return <Badge style={{backgroundColor:c.bg,color:c.color}}>{status}</Badge>;};
const Pill=({active,children,onClick})=>(
  <button onClick={onClick} className="px-3 py-1.5 rounded-full text-[11px] font-black tracking-wide transition-all duration-150"
    style={{backgroundColor:active?ACCENT:CARD,color:active?"black":MUTED}}>{children}</button>
);
const Btn=({children,accent,small,className="",style={},disabled,...props})=>(
  <button disabled={disabled}
    className={`inline-flex items-center justify-center font-black tracking-wide transition-all duration-150 active:scale-[0.97] disabled:opacity-40 ${small?"text-[10px] px-3 py-1.5 rounded-lg":"text-xs px-4 py-2.5 rounded-xl"} ${className}`}
    style={{backgroundColor:accent?ACCENT:"#1a1a1a",color:accent?"black":"#aaa",border:accent?"none":"1px solid #2a2a2a",...style}} {...props}>{children}</button>
);
const Input=({className="",...props})=>(
  <input className={`w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444] outline-none transition ${className}`}
    style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a"}} {...props}/>
);
const Textarea=({className="",...props})=>(
  <textarea className={`w-full rounded-xl px-4 py-3 text-sm text-white placeholder-[#444] outline-none transition leading-relaxed ${className}`}
    style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a"}} {...props}/>
);
const MetricBox=({label,value,sub})=>(
  <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
    <div className="text-[10px] font-black text-[#555] tracking-widest uppercase">{label}</div>
    <div className="text-3xl font-black text-white mt-2">{value}</div>
    {sub&&<div className="text-[10px] text-[#444] mt-2">{sub}</div>}
  </div>
);
const Check=({ok,label})=>(
  <div className="flex items-center gap-3 py-2">
    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
      style={{backgroundColor:ok?ACCENT:"#2a2a2a",color:ok?"black":"#555"}}>{ok?"✓":"!"}</div>
    <span className="text-xs" style={{color:ok?"#aaa":"#666"}}>{label}</span>
  </div>
);

/* ─── REVIEW-SPECIFIC COMPONENTS ─── */
const StTag=({tagKey})=>{
  const t=ST[tagKey]||ST.PENDING;
  return <Badge style={{backgroundColor:t.bg,color:t.color}}>{t.emoji} {t.label}</Badge>;
};

const MetricRow=({label,actual,expected,deviationPct})=>{
  const isPos=deviationPct>=0;
  return(
    <div className="grid grid-cols-4 gap-2 items-center py-2.5 border-b" style={{borderColor:BORDER}}>
      <span className="text-xs font-black text-[#888]">{label}</span>
      <span className="text-sm font-black text-white text-center">{fmtNum(actual)}{typeof actual==="number"&&actual<100&&label.includes("率")?"%":""}</span>
      <span className="text-xs text-center" style={{color:"#555"}}>{fmtNum(expected)}{typeof expected==="number"&&expected<100&&label.includes("率")?"%":""}</span>
      <span className={`text-xs font-black text-center rounded-lg px-2 py-1`}
        style={{color:isPos?"#86efac":"#fca5a5",backgroundColor:isPos?"rgba(20,83,45,0.4)":"rgba(127,29,29,0.4)"}}>
        {isPos?"+":""}{deviationPct}%
      </span>
    </div>
  );
};

const ProbBar=({probability,issue,detail})=>(
  <div className="mb-3 p-3 rounded-xl" style={{backgroundColor:"#111",border:`1px solid ${BORDER}`}}>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-black text-white">{issue}</span>
      <span className="text-[10px] font-black" style={{color:ACCENT}}>{probability}%</span>
    </div>
    <div className="h-1.5 rounded-full mb-2" style={{backgroundColor:"#2a2a2a"}}>
      <div className="h-full rounded-full transition-all duration-500" style={{width:`${probability}%`,backgroundColor:probability>=60?ACCENT:probability>=30?"#f59e0b":"#6b7280"}}/>
    </div>
    <p className="text-[11px]" style={{color:"#666"}}>{detail}</p>
  </div>
);

const ActionItem=({action,checked,onToggle})=>{
  const pc=PRIORITY[action.priority]||PRIORITY.this_week;
  return(
    <div className="flex gap-3 p-3 rounded-xl mb-2 cursor-pointer group" style={{backgroundColor:checked?"rgba(200,255,0,0.05)":"#111",border:`1px solid ${checked?ACCENT+"33":BORDER}`}}
      onClick={onToggle}>
      <div className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all"
        style={{backgroundColor:checked?ACCENT:"transparent",borderColor:checked?ACCENT:"#444"}}>
        {checked&&<span className="text-[8px] font-black text-black">✓</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[9px] font-black rounded-full px-2 py-0.5" style={{backgroundColor:pc.bg,color:pc.color}}>{pc.label}</span>
          <span className="text-xs font-bold" style={{color:checked?"#555":"white",textDecoration:checked?"line-through":"none"}}>{action.action}</span>
        </div>
        <p className="text-[11px]" style={{color:"#666"}}>{action.detail}</p>
        {action.expectedEffect&&<p className="text-[10px] mt-1 font-black" style={{color:"#C8FF00"}}>{action.expectedEffect}</p>}
      </div>
    </div>
  );
};

const RangeBar=({label,min,median,max,unit=""})=>(
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1.5">
      <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">{label}</span>
      <span className="text-xs font-black" style={{color:ACCENT}}>{fmtNum(median)}{unit}</span>
    </div>
    <div className="relative h-2 rounded-full" style={{backgroundColor:"#2a2a2a"}}>
      <div className="absolute h-full rounded-full" style={{
        left:`${Math.max(0,(min/(max*1.2))*100)}%`,
        width:`${Math.min(100,((max-min)/(max*1.2))*100)}%`,
        backgroundColor:"rgba(200,255,0,0.25)"
      }}/>
      <div className="absolute w-2 h-2 rounded-full -translate-y-0 top-0" style={{
        left:`${Math.min(96,(median/(max*1.2))*100)}%`,
        backgroundColor:ACCENT,boxShadow:`0 0 6px ${ACCENT}`
      }}/>
    </div>
    <div className="flex justify-between mt-1">
      <span className="text-[9px]" style={{color:"#444"}}>{fmtNum(min)}</span>
      <span className="text-[9px]" style={{color:"#444"}}>{fmtNum(max)}</span>
    </div>
  </div>
);

const SnapshotPill=({snap,active,onClick})=>{
  const hasD=!!snap.aiDiagnosis;
  return(
    <button onClick={onClick}
      className="flex flex-col items-center px-4 py-2 rounded-xl text-[10px] font-black transition-all"
      style={{backgroundColor:active?ACCENT:"#1a1a1a",color:active?"black":"#888",border:`1px solid ${active?ACCENT:BORDER}`}}>
      <span>{snap.type}</span>
      {hasD&&<span className="text-[8px] mt-0.5" style={{color:active?"black":"#C8FF00"}}>已诊断</span>}
    </button>
  );
};

/* ═══════════════════════════ CALENDAR COMPONENTS ═══════════════════════════ */
const NoteChip=({note,todayStr,onClick,onDragStart})=>{
  const color=TYPE_COLOR[note.type]||ACCENT;
  const dot=STATUS_DOT[note.status]||"#8A8E86";
  return(
    <button draggable
      onClick={e=>{e.stopPropagation();onClick(note);}}
      onDragStart={e=>onDragStart(e,note)}
      className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-black tracking-tight transition hover:brightness-125"
      style={{backgroundColor:note.status==="已发布"?"rgba(200,255,0,0.14)":"rgba(255,255,255,0.07)",color:note.status==="已发布"?ACCENT:color}}
      title={note.title}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full opacity-70" style={{backgroundColor:dot}}/>
      <span className="min-w-0 flex-1 truncate">{note.title}</span>
    </button>
  );
};

const DayCell=({day,dateStr,notes,isToday,todayStr,onNoteClick,onDragStart,onDrop})=>{
  const [isDragOver,setIsDragOver]=useState(false);
  if(!day) return <div className="min-h-[96px]"/>;
  const isPast=dateStr<todayStr;
  const hasNotes=notes.length>0;
  return(
    <div
      onDragOver={e=>{e.preventDefault();setIsDragOver(true);}}
      onDragLeave={()=>setIsDragOver(false)}
      onDrop={e=>{setIsDragOver(false);onDrop(e,dateStr);}}
      className="relative min-h-[96px] rounded-xl p-2 transition-all duration-150"
      style={{
        backgroundColor:isDragOver?"rgba(200,255,0,0.08)":hasNotes?"rgba(255,255,255,0.03)":"transparent",
        outline:isDragOver?`1px solid ${ACCENT}`:"none",
        opacity:isPast?0.4:1,
      }}>
      {/* Date number */}
      <div className="mb-2">
        <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full text-[15px] font-black px-1"
          style={{backgroundColor:isToday?ACCENT:"transparent",color:isToday?"black":"rgba(255,255,255,0.28)"}}>
          {day}
        </span>
      </div>
      {/* Note chips */}
      <div className="space-y-1">
        {notes.slice(0,2).map(n=>(
          <NoteChip key={n.id} note={n} todayStr={todayStr} onClick={onNoteClick} onDragStart={onDragStart}/>
        ))}
        {notes.length>2&&(
          <div className="px-1 text-[10px] font-bold" style={{color:"rgba(255,255,255,0.28)"}}>+{notes.length-2}</div>
        )}
      </div>
      {isDragOver&&(
        <div className="absolute top-1 right-1">
          <span className="rounded-full px-1.5 py-0.5 text-[8px] font-black text-black" style={{backgroundColor:ACCENT}}>→</span>
        </div>
      )}
    </div>
  );
};

const CalStatCard=({label,value,highlight=false,active=false,onClick})=>(
  <div onClick={onClick}
    className="rounded-3xl p-5 transition-all"
    style={{
      backgroundColor:highlight?ACCENT:active?"rgba(200,255,0,0.08)":CARD,
      color:highlight?"black":"white",
      border:highlight?"none":active?`1px solid ${ACCENT}66`:`1px solid ${BORDER}`,
      boxShadow:highlight?`0 18px 34px rgba(200,255,0,0.14)`:active?"0 0 0 1px rgba(200,255,0,0.2)":"none",
      cursor:onClick?"pointer":"default",
    }}>
    <div className="text-4xl font-black">{value}</div>
    <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] flex items-center gap-1.5"
      style={{color:highlight?"rgba(0,0,0,0.55)":active?ACCENT:"rgba(255,255,255,0.42)"}}>
      {label}
      {onClick&&!highlight&&<span className="text-[8px] opacity-60">→</span>}
    </div>
  </div>
);

/* ═══════════════════════════ CAL NOTE MODAL ════════════════════════════════ */
const CAL_STATUS_OPTIONS=["待写","草稿","待发布","已发布"];
const CalNoteModal=({note,onClose,onUpdate})=>{
  const color=TYPE_COLOR[note.type]||"#C8FF00";
  const [editStatus,setEditStatus]=useState(note.status);
  const [editDate,setEditDate]=useState(note.publish_date||"");
  const [editTitle,setEditTitle]=useState(note.title);
  const [editNote,setEditNote]=useState(note.notes||"");
  const todayStr=getTodayStr();
  const isPast=(note.publish_date||"")<=todayStr&&note.publish_date;
  const save=()=>{
    onUpdate(note.id,{title:editTitle,status:editStatus,publish_date:editDate,notes:editNote});
    onClose();
  };
  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{backgroundColor:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{backgroundColor:"#111",border:"1px solid #1e1e1e",maxHeight:"90vh",overflowY:"auto"}}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{borderBottom:"1px solid #1e1e1e"}}>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-3 py-1 text-[11px] font-black"
              style={{backgroundColor:`${color}22`,color}}>{note.type}</span>
            <span className="rounded-full px-3 py-1 text-[11px] font-black"
              style={statusColor(editStatus)}>{editStatus}</span>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-lg transition hover:opacity-70"
            style={{backgroundColor:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.4)"}}>✕</button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="text-[9px] font-black tracking-widest mb-2 block" style={{color:"#444"}}>笔记标题</label>
            <textarea rows={2} value={editTitle}
              onChange={e=>setEditTitle(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm font-bold leading-relaxed resize-none outline-none"
              style={{backgroundColor:"rgba(255,255,255,0.04)",border:"1px solid #1e1e1e",color:"white"}}/>
          </div>
          {/* Date + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black tracking-widest mb-2 block" style={{color:"#444"}}>发布日期</label>
              <input type="date" value={editDate}
                onChange={e=>setEditDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{backgroundColor:"rgba(255,255,255,0.04)",border:"1px solid #1e1e1e",color:editDate?  "white":"#555",colorScheme:"dark"}}/>
            </div>
            <div>
              <label className="text-[9px] font-black tracking-widest mb-2 block" style={{color:"#444"}}>状态</label>
              <select value={editStatus} onChange={e=>setEditStatus(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{backgroundColor:"rgba(255,255,255,0.04)",border:"1px solid #1e1e1e",color:"white",colorScheme:"dark"}}>
                {CAL_STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {/* Stats strip (published only) */}
          {note.status==="已发布"&&(
            <div className="rounded-2xl p-4 grid grid-cols-3 gap-3 text-center"
              style={{backgroundColor:"rgba(200,255,0,0.05)",border:"1px solid rgba(200,255,0,0.1)"}}>
              {[{label:"浏览",value:note.views||"—"},{label:"点赞",value:note.likes||"—"},{label:"收藏",value:note.collects||"—"}].map(s=>(
                <div key={s.label}>
                  <div className="text-xl font-black text-white">{typeof s.value==="number"?s.value.toLocaleString():s.value}</div>
                  <div className="text-[9px] font-black mt-0.5" style={{color:"rgba(200,255,0,0.5)"}}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {/* Timeline pill */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1" style={{backgroundColor:"#1e1e1e"}}/>
            <span className="text-[10px] font-black px-3 py-1 rounded-full"
              style={{backgroundColor:isPast?"rgba(200,255,0,0.1)":"rgba(255,255,255,0.05)",color:isPast?"#C8FF00":"#555"}}>
              {isPast?"已过期日期":"未来排期"}
            </span>
            <div className="h-px flex-1" style={{backgroundColor:"#1e1e1e"}}/>
          </div>
          {/* Notes field */}
          <div>
            <label className="text-[9px] font-black tracking-widest mb-2 block" style={{color:"#444"}}>备注 / 创作思路</label>
            <textarea rows={3} value={editNote} placeholder="写点思路、灵感或发布计划..."
              onChange={e=>setEditNote(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-xs leading-relaxed resize-none outline-none"
              style={{backgroundColor:"rgba(255,255,255,0.04)",border:"1px solid #1e1e1e",color:"rgba(255,255,255,0.7)"}}/>
          </div>
        </div>
        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-black transition hover:opacity-70"
            style={{backgroundColor:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)"}}>取消</button>
          <button onClick={save}
            className="flex-1 py-3 rounded-2xl text-sm font-black transition hover:brightness-110"
            style={{backgroundColor:"#C8FF00",color:"black"}}>保存更改</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════ SCORE COMPONENTS ══════════════════════════════ */
const TIER_META={
  "🔥":{color:"#C8FF00",   bg:"rgba(200,255,0,0.1)",   label:"高潜爆款", action:"立即发布 · 发布后1h重点监控 · 必要时投少量薯条放大"},
  "⭐":{color:"#93c5fd",   bg:"rgba(147,197,253,0.1)", label:"优质内容", action:"直接发布 · 按常规节奏监控数据"},
  "📈":{color:"#fcd34d",   bg:"rgba(252,211,77,0.1)",  label:"合格可发", action:"优化1-2项最弱维度再发"},
  "⚠": {color:"#fb923c",   bg:"rgba(251,146,60,0.1)",  label:"风险较大", action:"至少重做封面或标题再发"},
  "❌":{color:"#fca5a5",   bg:"rgba(252,165,165,0.1)", label:"不建议发", action:"建议重新构思，本篇大概率扑街"},
};

const ScoreDimRow=({label,score,max,color})=>(
  <div className="flex items-center gap-2">
    <div className="shrink-0 text-[10px] font-bold" style={{width:"7rem",color:"rgba(255,255,255,0.4)"}}>{label}</div>
    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{backgroundColor:"rgba(255,255,255,0.06)"}}>
      <div className="h-full rounded-full" style={{width:`${(score/max)*100}%`,backgroundColor:color,transition:"width 0.7s ease"}}/>
    </div>
    <div className="shrink-0 text-[11px] font-black" style={{color,width:"2.5rem",textAlign:"right"}}>{score}<span className="text-[9px] font-bold" style={{color:"rgba(255,255,255,0.25)"}}>/{max}</span></div>
  </div>
);

const SCORE_CATS=[
  {key:"title",label:"标题",max:40,detailKey:"title_score",dims:[
    {k:"keyword_search",l:"关键词搜索量",m:10},{k:"emotion_hook",l:"情绪/钩子强度",m:10},
    {k:"specificity",l:"数字与具体性",m:8},{k:"identity_scene",l:"身份/场景代入",m:7},{k:"length",l:"长度与可读性",m:5},
  ]},
  {key:"cover",label:"封面",max:35,detailKey:"cover_score",dims:[
    {k:"visual_impact",l:"第一视觉冲击",m:10},{k:"text_density",l:"文字信息密度",m:8},
    {k:"color_contrast",l:"色彩与对比度",m:7},{k:"subject_clarity",l:"人物/主体清晰度",m:5},{k:"composition",l:"构图与一致性",m:5},
  ]},
  {key:"content",label:"正文",max:25,detailKey:"content_score",dims:[
    {k:"opening_hook",l:"开头钩子",m:6},{k:"structure",l:"结构清晰度",m:6},
    {k:"info_value",l:"信息密度与价值",m:5},{k:"engagement",l:"互动引导",m:4},{k:"seo_tags",l:"标签与SEO",m:4},
  ]},
];

const ScorePanel=({result,loading,error,onScore,hasKey,onApply,onSaveScore,scoreSavedAt})=>{
  const [open,setOpen]=useState({});
  const getTier=(tier="")=>{const e=(tier.match(/[🔥⭐📈⚠❌]/u)||["📈"])[0];return TIER_META[e]||TIER_META["📈"];};

  if(!hasKey)return(
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div><div className="text-3xl mb-3">🔑</div>
      <div className="text-[12px]" style={{color:"#444"}}>先在「AI对话」标签配置 API Key</div></div>
    </div>
  );
  if(loading)return(
    <div className="flex-1 flex items-center justify-center gap-1 p-6">
      {[0,120,240].map(d=><span key={d} className="text-2xl animate-bounce" style={{animationDelay:`${d}ms`,color:"#444"}}>·</span>)}
      <span className="text-[11px] ml-2" style={{color:"#555"}}>AI 评分中…</span>
    </div>
  );
  if(!result)return(
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
      <div className="text-center">
        <div className="text-4xl mb-3">📊</div>
        <div className="text-sm font-black text-white mb-1">笔记爆款潜力评分</div>
        <div className="text-[11px]" style={{color:"#444"}}>标题×40% + 封面×35% + 正文×25%，满分 100</div>
      </div>
      <button onClick={onScore} className="px-6 py-3 rounded-2xl text-sm font-black transition hover:brightness-110" style={{backgroundColor:ACCENT,color:"black"}}>开始 AI 评分</button>
      {error&&<div className="text-[11px] px-3 py-2 rounded-xl text-center" style={{backgroundColor:"rgba(127,29,29,0.4)",color:"#fca5a5"}}>⚠ {error}</div>}
    </div>
  );

  const tm=getTier(result.tier);
  const pm=result.predicted_metrics;
  const fmtN=(n)=>(+n||0).toLocaleString();
  return(
    <div className="flex flex-col overflow-y-auto" style={{maxHeight:"480px"}}>
      <div className="p-4 space-y-3">
        {/* Total score */}
        <div className="rounded-2xl p-4" style={{backgroundColor:tm.bg,border:`1px solid ${tm.color}44`}}>
          <div className="flex items-center gap-4 mb-2">
            <div className="text-5xl font-black" style={{color:tm.color}}>{result.total_score}</div>
            <div>
              <div className="text-[10px] font-black tracking-widest" style={{color:"rgba(255,255,255,0.3)"}}>/ 100</div>
              <div className="text-sm font-black mt-0.5" style={{color:tm.color}}>{result.tier}</div>
            </div>
            <div className="flex-1"/>
            {onSaveScore&&(
              <button onClick={()=>onSaveScore(result.total_score)}
                className="text-[10px] font-black px-3 py-1.5 rounded-full transition hover:brightness-110"
                style={{backgroundColor:ACCENT,color:"black"}}
                title={scoreSavedAt?`上次保存：${new Date(scoreSavedAt).toLocaleString("zh-CN")}`:"将此评分写入笔记的 AI 分数字段"}>
                💾 保存到笔记
              </button>
            )}
            <button onClick={onScore} className="text-[10px] font-black px-3 py-1.5 rounded-full transition hover:opacity-70" style={{backgroundColor:"rgba(255,255,255,0.06)",color:"#555"}}>重新评分</button>
          </div>
          {tm.action&&(
            <div className="text-[11px] font-bold mt-1 pt-2" style={{borderTop:`1px solid ${tm.color}33`,color:tm.color}}>
              → {tm.action}
            </div>
          )}
        </div>
        {/* Single-item veto warnings */}
        {(()=>{
          const vetoes=[];
          if((result.title_score?.total??99)<15) vetoes.push("标题 "+result.title_score.total+"/40 低于否决线(15)，流量起跑慢");
          if((result.cover_score?.total??99)<12)  vetoes.push("封面 "+result.cover_score.total+"/35 低于否决线(12)，信息流曝光受阻");
          if((result.content_score?.total??99)<8)  vetoes.push("正文 "+result.content_score.total+"/25 低于否决线(8)，互动率低无二次推荐");
          return vetoes.length>0?(
            <div className="rounded-xl px-4 py-3 space-y-1.5" style={{backgroundColor:"rgba(127,29,29,0.35)",border:"1px solid rgba(252,165,165,0.2)"}}>
              <div className="text-[9px] font-black tracking-widest" style={{color:"rgba(252,165,165,0.6)"}}>⛔ 单项否决线触发</div>
              {vetoes.map(v=><div key={v} className="text-[11px] font-bold" style={{color:"#fca5a5"}}>{v}</div>)}
            </div>
          ):null;
        })()}
        {/* Category bars */}
        {SCORE_CATS.map(cat=>{
          const catData=result[cat.detailKey]||{};
          const score=catData.total??0;
          const pct=(score/cat.max)*100;
          const barColor=pct>=70?ACCENT:pct>=50?"#fcd34d":"#fb923c";
          const isOpen=open[cat.key];
          return(
            <div key={cat.key} className="rounded-2xl overflow-hidden" style={{backgroundColor:"rgba(255,255,255,0.03)",border:`1px solid ${BORDER}`}}>
              <button className="w-full flex items-center gap-3 px-4 py-3" onClick={()=>setOpen(o=>({...o,[cat.key]:!o[cat.key]}))}>
                <span className="text-[12px] font-black text-white" style={{width:"2rem"}}>{cat.label}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{backgroundColor:"rgba(255,255,255,0.06)"}}>
                  <div className="h-full rounded-full" style={{width:`${pct}%`,backgroundColor:barColor,transition:"width 0.7s ease"}}/>
                </div>
                <span className="text-sm font-black shrink-0" style={{color:barColor}}>{score}<span className="text-[10px] font-bold" style={{color:"rgba(255,255,255,0.25)"}}>/{cat.max}</span></span>
                <span className="text-[9px]" style={{color:"#444"}}>{isOpen?"▲":"▼"}</span>
              </button>
              {isOpen&&catData.details&&(
                <div className="px-4 pb-4 space-y-2 pt-2" style={{borderTop:`1px solid ${BORDER}`}}>
                  {cat.dims.map(d=>{
                    const dd=catData.details[d.k]||{};
                    return(
                      <div key={d.k}>
                        <ScoreDimRow label={d.l} score={dd.score??0} max={d.m} color={barColor}/>
                        {dd.reason&&<div className="text-[9px] mt-0.5 pl-28 leading-relaxed" style={{color:"rgba(255,255,255,0.25)"}}>{dd.reason}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Predicted metrics */}
        {pm&&(
          <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${BORDER}`}}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{backgroundColor:"rgba(255,255,255,0.03)",borderBottom:`1px solid ${BORDER}`}}>
              <span className="text-[9px] font-black tracking-widest" style={{color:"rgba(255,255,255,0.3)"}}>发布后 7 天预估数据</span>
              <span className="text-[9px]" style={{color:"#333"}}>中位数 / 区间</span>
            </div>
            <div className="grid grid-cols-3" style={{borderColor:BORDER}}>
              {[
                {label:"浏览量",emoji:"👁",d:pm.views,  color:ACCENT},
                {label:"点赞量",emoji:"👍",d:pm.likes,  color:"#93c5fd"},
                {label:"收藏量",emoji:"⭐",d:pm.saves,  color:"#fcd34d"},
              ].map(({label,emoji,d,color},i)=>(
                <div key={label} className="px-3 py-3 text-center" style={{borderLeft:i>0?`1px solid ${BORDER}`:"none"}}>
                  <div className="text-[9px] font-black tracking-wide mb-1.5" style={{color:"rgba(255,255,255,0.25)"}}>{emoji} {label}</div>
                  <div className="text-lg font-black" style={{color}}>{fmtN(d?.median)}</div>
                  <div className="text-[9px] mt-0.5 font-bold" style={{color:"rgba(255,255,255,0.2)"}}>
                    {fmtN(d?.min)} – {fmtN(d?.max)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI-rewritten content */}
        {(result.improved_title||result.improved_cover)&&(
          <div className="space-y-2">
            <div className="text-[9px] font-black tracking-widest" style={{color:"#444"}}>AI 改写建议（可一键应用）</div>
            {result.improved_title&&(
              <div className="rounded-xl p-3" style={{backgroundColor:"rgba(200,255,0,0.05)",border:"1px solid rgba(200,255,0,0.15)"}}>
                <div className="text-[9px] font-black tracking-wide mb-2" style={{color:"rgba(200,255,0,0.5)"}}>✦ 改写标题</div>
                <div className="text-[13px] font-bold text-white mb-2.5 leading-snug">{result.improved_title}</div>
                {onApply&&(
                  <button onClick={()=>onApply({type:"title",label:"标题",value:result.improved_title})}
                    className="rounded-full px-3 py-1 text-[10px] font-black transition hover:brightness-110"
                    style={{backgroundColor:ACCENT,color:"black"}}>✓ 应用标题</button>
                )}
              </div>
            )}
            {result.improved_cover&&(
              <div className="rounded-xl p-3" style={{backgroundColor:"rgba(200,255,0,0.03)",border:"1px solid rgba(200,255,0,0.1)"}}>
                <div className="text-[9px] font-black tracking-wide mb-2" style={{color:"rgba(200,255,0,0.4)"}}>✦ 改写封面文案</div>
                <div className="text-[13px] font-bold text-white mb-2.5 leading-snug">{result.improved_cover}</div>
                {onApply&&(
                  <button onClick={()=>onApply({type:"cover",label:"封面",value:result.improved_cover})}
                    className="rounded-full px-3 py-1 text-[10px] font-black transition hover:brightness-110"
                    style={{backgroundColor:ACCENT,color:"black"}}>✓ 应用封面</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Weakest dimension */}
        {result.weakest_dimension&&(
          <div className="rounded-xl px-4 py-2 text-[10px] font-bold" style={{backgroundColor:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.18)",color:"rgba(251,146,60,0.8)"}}>
            ⚡ 最弱维度：{result.weakest_dimension}
          </div>
        )}
        {/* Disclaimer */}
        <div className="rounded-xl px-4 py-3 text-[10px] leading-relaxed" style={{backgroundColor:"rgba(255,255,255,0.025)",color:"rgba(255,255,255,0.25)"}}>
          📌 这是概率工具，不是预言机。85分也可能扑街，55分也可能爆款。评分的真正价值是"投入哪20%的时间能换80%的提升"——重点看最弱维度和Top 3建议。
        </div>
        {/* Top 3 suggestions */}
        {result.top_3_suggestions?.length>0&&(
          <div className="space-y-2">
            <div className="text-[9px] font-black tracking-widest" style={{color:"#444"}}>TOP 3 优化建议</div>
            {result.top_3_suggestions.map((s,i)=>(
              <div key={i} className="rounded-xl p-3" style={{backgroundColor:"rgba(255,255,255,0.03)",border:`1px solid ${BORDER}`}}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-4 w-4 rounded-full text-[9px] font-black flex items-center justify-center shrink-0" style={{backgroundColor:ACCENT,color:"black"}}>{i+1}</span>
                  <span className="text-[10px] font-black" style={{color:ACCENT}}>{s.dimension}</span>
                  {s.expected_lift&&<span className="text-[9px] font-bold ml-auto" style={{color:"rgba(200,255,0,0.5)"}}>预计 +{s.expected_lift}</span>}
                </div>
                <div className="text-[10px] pl-6 mb-0.5" style={{color:"#555"}}>现状：{s.current}</div>
                <div className="text-[11px] font-bold pl-6" style={{color:"rgba(255,255,255,0.75)"}}>{s.suggestion}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════ MAIN APP ══════════════════════════════════ */
export default function App({user,onLogout}={}){
  /* ── Board state ── */
  const [tab,setTab]=useState("board");
  // Mobile preview mode — renders the app inside an iframe so Tailwind sm:/md: breakpoints
  // actually fire (iframe viewport = 393px regardless of outer browser width).
  // When loaded as iframe (?embedded=1) we hide the preview button to avoid recursion.
  const isEmbedded=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("embedded")==="1";
  const [mobilePreview,setMobilePreview]=useState(()=>{
    if(isEmbedded)return false;
    try{return localStorage.getItem("xhs_mobile_preview")==="1";}catch(e){return false;}
  });
  useEffect(()=>{if(!isEmbedded)try{localStorage.setItem("xhs_mobile_preview",mobilePreview?"1":"0");}catch(e){}},[mobilePreview,isEmbedded]);
  // ═══ Data state — hydrated from Supabase on mount ═══
  // Start with empty arrays; useEffect below populates from cloud (or migrates from localStorage)
  const [topics,setTopics]=useState([]);
  const [comments,setComments]=useState([]);
  const [imgStoreReady,setImgStoreReady]=useState(false);
  const [cloudReady,setCloudReady]=useState(false); // becomes true after Supabase hydration completes
  const [migrationInfo,setMigrationInfo]=useState(null); // {migratedTopics, migratedComments} or null
  const [persistError,setPersistError]=useState("");
  const userId=user?.id;
  const [selected,setSelected]=useState(null);
  const [pillarFilter,setPillarFilter]=useState("全部");
  const [statusFilter,setStatusFilter]=useState("全部");
  const [search,setSearch]=useState("");
  const [weeklyTarget,setWeeklyTarget]=useState(3);
  const [draft,setDraft]=useState({title:"",cover:"",body:""});
  const [suggestions,setSuggestions]=useState([]);
  const [aiMsg,setAiMsg]=useState("选一个选题，或新建笔记开始创作。");
  const [newComment,setNewComment]=useState({scene:"",reply:"",tag:"人设"});
  const [editingComment,setEditingComment]=useState(null); // {id,scene,reply,tag}

  /* ── Review state — derived from topics (Board = single source of truth) ── */
  const reviewNotes=useMemo(()=>topics.filter(t=>t.status==="已发布"),[topics]);
  // Live computed period summary from reviewNotes
  const livePeriodSummary=useMemo(()=>{
    let hit=0,excellent=0,underperf=0;
    reviewNotes.forEach(n=>{
      const tags=computeStatusTags(n);
      if(tags.includes("HOT"))hit++;
      else if(tags.includes("EXCELLENT"))excellent++;
      if(tags.includes("UNDERPERF")||tags.includes("COLDFAIL"))underperf++;
    });
    return {totalNotes:reviewNotes.length,hitCount:hit,excellentCount:excellent,underperfCount:underperf};
  },[reviewNotes]);

  // Live computed account profile from reviewNotes
  const accountProfile=useMemo(()=>{
    const withSnap=reviewNotes.filter(n=>n.snapshots?.length>0);
    if(withSnap.length===0){
      return {medianViews:0,baselineLikeRate:"0.0",baselineCollectRate:"0.0",baselineCommentRate:"0.0",hitRate:0,bestPostTimes:[],totalNotes:reviewNotes.length,totalFollowers:0,sampleSize:0};
    }
    // median views (latest snapshot per note)
    const viewsArr=withSnap.map(n=>n.snapshots[n.snapshots.length-1]?.views||0).sort((a,b)=>a-b);
    const median=viewsArr.length%2===1?viewsArr[(viewsArr.length-1)/2]:Math.round((viewsArr[viewsArr.length/2-1]+viewsArr[viewsArr.length/2])/2);
    // average rates (weighted by views)
    let totV=0,totL=0,totC=0,totCm=0;
    withSnap.forEach(n=>{
      const s=n.snapshots[n.snapshots.length-1];
      totV+=s?.views||0;totL+=s?.likes||0;totC+=s?.collects||0;totCm+=s?.comments||0;
    });
    const lr=totV>0?(totL/totV*100).toFixed(1):"0.0";
    const cr=totV>0?(totC/totV*100).toFixed(1):"0.0";
    const cmr=totV>0?(totCm/totV*100).toFixed(1):"0.0";
    // hit rate
    const hitCount=withSnap.filter(n=>{
      const tags=computeStatusTags(n);return tags.includes("HOT")||tags.includes("EXCELLENT");
    }).length;
    const hitRate=Math.round(hitCount/withSnap.length*100);
    // Total new followers (sum across all snapshots)
    const totalFollowers=reviewNotes.reduce((a,n)=>a+(n.snapshots||[]).reduce((b,s)=>b+(s.newFollowers||0),0),0);
    // Best post times — group HOT/EXCELLENT notes by weekday+hour, rank by frequency
    const wdNames=["周日","周一","周二","周三","周四","周五","周六"];
    const slotCount={};
    withSnap.forEach(n=>{
      const tags=computeStatusTags(n);
      if(!(tags.includes("HOT")||tags.includes("EXCELLENT")))return;
      if(!n.publishTime)return;
      const d=new Date(n.publishTime);
      const slot=`${wdNames[d.getDay()]} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      slotCount[slot]=(slotCount[slot]||0)+1;
    });
    const bestPostTimes=Object.entries(slotCount).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([s])=>s);
    return {
      medianViews:median,baselineLikeRate:lr,baselineCollectRate:cr,baselineCommentRate:cmr,
      hitRate,bestPostTimes,totalNotes:reviewNotes.length,totalFollowers,sampleSize:withSnap.length,
    };
  },[reviewNotes]);
  const [reviewView,setReviewView]=useState("list");  // list | note-detail | diagnosis | pattern
  // Pattern report (AI-generated insights) — hydrated from Supabase on cloud-ready
  const [patternAI,setPatternAI]=useState(null);
  const [patternLoading,setPatternLoading]=useState(false);
  const [patternError,setPatternError]=useState("");
  const [reviewModal,setReviewModal]=useState(null);  // null | screenshot | new-note
  const [selNote,setSelNote]=useState(null);
  const [selSnap,setSelSnap]=useState(null);
  const [editingSnap,setEditingSnap]=useState(false);
  const [snapDraft,setSnapDraft]=useState({});
  const [actionChecked,setActionChecked]=useState({});
  // Screenshot modal state
  const [uploadStep,setUploadStep]=useState(0);  // 0:drop 1:processing 2:result
  const [uploadProgress,setUploadProgress]=useState(0);
  const [ocrNote,setOcrNote]=useState(null);  // which note the OCR matched
  const [ocrData,setOcrData]=useState({views:0,likes:0,collects:0,comments:0,shares:0,newFollowers:0,type:"24h"});
  const [ocrPreviewUrl,setOcrPreviewUrl]=useState("");
  const [ocrError,setOcrError]=useState("");
  const screenshotFileRef=useRef(null);
  // New note modal state
  const [newNoteForm,setNewNoteForm]=useState({title:"",pillar:"人生重铸",tags:"",publishTime:"",noteType:"image"});
  const [predStep,setPredStep]=useState(0);  // 0:form 1:predicting 2:result
  const [predNote,setPredNote]=useState(null);

  /* ── AI Chat state ── */
  const [chatMsgs,setChatMsgs]=useState([]);
  const [chatInput,setChatInput]=useState("");
  const [chatLoading,setChatLoading]=useState(false);
  const [chatError,setChatError]=useState("");
  const [aiProvider,setAiProvider]=useState(()=>localStorage.getItem("xhs_ai_provider")||"claude"); // "claude"|"openai"|"gemini"
  const [claudeKey,setClaudeKey]=useState(()=>localStorage.getItem("xhs_claude_key")||"");
  const [openaiKey,setOpenaiKey]=useState(()=>localStorage.getItem("xhs_openai_key")||"");
  const [geminiKey,setGeminiKey]=useState(()=>localStorage.getItem("xhs_gemini_key")||"");
  const [keyDraft,setKeyDraft]=useState("");
  const [setupProvider,setSetupProvider]=useState("claude"); // which provider key we're setting up
  const [editorPanel,setEditorPanel]=useState("check"); // "check" | "chat" | "score" | "cover"
  const [scoreResult,setScoreResult]=useState(null);
  const [scoreLoading,setScoreLoading]=useState(false);
  const [scoreError,setScoreError]=useState("");
  const chatEndRef=useRef(null);
  const activeKey=aiProvider==="claude"?claudeKey:aiProvider==="openai"?openaiKey:geminiKey;

  // ── Cover design AI state ──
  const [coverMsgs,setCoverMsgs]=useState([]);
  const [coverInput,setCoverInput]=useState("");
  const [coverLoading,setCoverLoading]=useState(false);
  const [coverRefImg,setCoverRefImg]=useState(null); // {base64,mimeType,preview}
  const [coverBgUrl,setCoverBgUrl]=useState("");     // applied AI-generated image
  const [genImgLoading,setGenImgLoading]=useState(false);
  const coverFileRef=useRef(null);
  const noteImgFileRef=useRef(null);
  const [imgLightbox,setImgLightbox]=useState(null); // {images:[], index}
  const [imgDragOver,setImgDragOver]=useState(false);
  const [imgSaving,setImgSaving]=useState(false);
  // Helpers for drag-drop image upload
  const handleImgDragOver=(e)=>{e.preventDefault();e.stopPropagation();setImgDragOver(true);};
  const handleImgDragLeave=(e)=>{e.preventDefault();e.stopPropagation();setImgDragOver(false);};
  const handleImgDrop=(noteId,e)=>{
    e.preventDefault();e.stopPropagation();setImgDragOver(false);
    const files=Array.from(e.dataTransfer?.files||[]).filter(f=>f.type.startsWith("image/"));
    if(files.length>0&&noteId)addNoteImages(noteId,files);
  };
  const coverChatEndRef=useRef(null);

  /* ── Calendar state ── */
  // calNotes is DERIVED from topics — every topic with publishTime gets a calendar entry.
  // Calendar mutations write back to topics.
  const calNotes=useMemo(()=>{
    return topics.filter(t=>t.publishTime).map(t=>({
      id:t.id,
      title:t.title,
      publish_date:t.publishTime.slice(0,10),
      status:t.status,
      type:t.pillar,
    }));
  },[topics]);
  const [calDetailNote,setCalDetailNote]=useState(null);
  const [calYear,setCalYear]=useState(new Date().getFullYear());
  const [calMonth,setCalMonth]=useState(new Date().getMonth());
  const [draggingNote,setDraggingNote]=useState(null);
  const [calTypeFilter,setCalTypeFilter]=useState("全部");
  const [calStatusFilter,setCalStatusFilter]=useState("全部");
  const calDragMonthTimer=useRef(null);
  const scheduleListRef=useRef(null);
  const [dropFeedback,setDropFeedback]=useState(null); // {noteId, dateStr}

  // Calendar mutations route back to topics. Translates calNote fields → topic fields.
  const updateCalendarNote=(id,patch)=>{
    setTopics(prev=>prev.map(t=>{
      if(t.id!==id)return t;
      const next={...t};
      if(patch.title!==undefined)next.title=patch.title;
      if(patch.status!==undefined)next.status=patch.status;
      if(patch.type!==undefined)next.pillar=patch.type; // calNote.type ↔ topic.pillar
      if(patch.publish_date!==undefined){
        // Preserve existing time-of-day if present, else default 21:00
        const existingTime=t.publishTime&&t.publishTime.includes("T")?t.publishTime.slice(11):"21:00:00";
        next.publishTime=`${patch.publish_date}T${existingTime}`;
      }
      return next;
    }));
  };

  const handleCalDrop=(e,dateStr)=>{
    e.preventDefault();
    const id=e.dataTransfer.getData("noteId");
    if(!id)return;
    const todayStr=getTodayStr();
    const newStatus=dateStr>todayStr?"待发布":undefined;
    updateCalendarNote(id,{publish_date:dateStr,...(newStatus?{status:newStatus}:{})});
    setDraggingNote(null);
    setDropFeedback({noteId:id,dateStr});
    setTimeout(()=>setDropFeedback(null),1800);
  };

  /* ── Derived ── */
  const published=topics.filter(t=>t.status==="已发布").length;
  const progress=Math.min(100,Math.round((published/Math.max(1,weeklyTarget))*100));
  const filtered=useMemo(()=>topics.filter(t=>{
    const q=search.trim().toLowerCase();
    const matchQ=!q||t.title.toLowerCase().includes(q)||t.pillar.includes(q)||t.tag.includes(q);
    const matchP=pillarFilter==="全部"||t.pillar===pillarFilter;
    const matchS=statusFilter==="全部"||t.status===statusFilter;
    return matchQ&&matchP&&matchS;
  }),[topics,search,pillarFilter,statusFilter]);
  const titleLen=countChars(draft.title);
  const bodyLen=countChars(draft.body);
  const checklist=[
    {label:"标题8-18字 + 冲突词",ok:titleLen>=8&&titleLen<=18&&hasConflict(draft.title)},
    {label:"正文≤1000字",ok:bodyLen>0&&bodyLen<=1000},
    {label:"包含个人经历",ok:draft.body.includes("我")||draft.body.includes("巴西")},
    {label:"结尾有互动",ok:draft.body.includes("？")||draft.body.includes("评论区")},
    {label:"封面文案已填",ok:countChars(draft.cover)>=4},
  ];
  const allPass=checklist.every(c=>c.ok);

  /* ── Board handlers ── */
  const openEditor=useCallback((topic)=>{
    setSelected(topic);
    setDraft({
      title:topic.title||"",
      cover:topic.coverText||generateCover(topic.title),
      body:topic.body||"",
    });
    setSuggestions(titleSuggestions(topic.title));setAiMsg(`已加载「${topic.title}」，可以开始创作。`);setTab("editor");
    // Restore persisted cover image for this note (if any)
    setCoverBgUrl(topic.coverImage||"");
    // ⚠ Clear stale per-note state from previous editing session
    setScoreResult(null);setScoreError("");setScoreLoading(false);
    setCoverMsgs([]);setCoverInput("");setCoverRefImg(null);
    setChatMsgs([]);setChatInput("");setChatError("");
    setEditorPanel("check"); // jump back to check tab as a fresh start
  },[]);

  // Save draft back to selected topic (writes title/coverText/body)
  const saveDraftToTopic=useCallback(()=>{
    if(!selected)return;
    const patch={title:draft.title,coverText:draft.cover,body:draft.body};
    setTopics(prev=>prev.map(t=>t.id===selected.id?{...t,...patch}:t));
    setSelected(prev=>prev?{...prev,...patch}:prev);
    setAiMsg("✓ 已保存到笔记，Board / Review 已同步");
  },[draft,selected]);

  // Track if draft differs from selected (unsaved indicator)
  const draftDirty=selected&&(
    draft.title!==(selected.title||"")||
    draft.cover!==(selected.coverText||generateCover(selected.title))||
    draft.body!==(selected.body||"")
  );
  const addTopic=()=>{
    // Auto-schedule new topics 14 days out so they appear on calendar
    const d=new Date();d.setDate(d.getDate()+14);
    const publishTime=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T21:00:00`;
    const t={id:uid(),title:"未命名新笔记",pillar:"人生重铸",status:"待写",score:60,goal:"人设/共鸣",tag:"新建",publishTime,autoScheduled:true};
    setTopics(prev=>[t,...prev]);openEditor(t);
  };
  const updateTopicStatus=(id,status)=>setTopics(prev=>prev.map(t=>t.id===id?{...t,status}:t));
  const updateTopicImages=(id,images)=>{
    setTopics(prev=>prev.map(t=>t.id===id?{...t,images}:t));
    setSelNote(prev=>prev?.id===id?{...prev,images}:prev);
    setSelected(prev=>prev?.id===id?{...prev,images}:prev);
  };
  // Image operations now go through Supabase Storage. Each image is uploaded as
  // {userId}/topics/{topicId}/images/{imageId}.{ext}, and a row inserted into note_images.
  const addNoteImages=async(noteId,files)=>{
    if(!userId){setPersistError("⚠ 请先登录");return;}
    setImgSaving(true);
    try{
      const arr=Array.from(files).slice(0,18);
      const current=topics.find(t=>t.id===noteId);
      if(!current){console.warn("[xhs] addNoteImages: topic not found",noteId);return;}
      const startOrder=(current.images||[]).length;
      const uploaded=[];
      for(let i=0;i<arr.length;i++){
        const f=arr[i];
        const imageId=uid();
        const path=await storage.uploadNoteImage(f,{userId,topicId:noteId,imageId});
        const signedUrl=await storage.getSignedUrl(path);
        await storage.insertNoteImageRow({
          id:imageId,topicId:noteId,userId,storagePath:path,
          displayOrder:startOrder+i,name:f.name,size:f.size,
        });
        uploaded.push({id:imageId,storagePath:path,dataUrl:signedUrl,name:f.name,size:f.size});
      }
      const nextImages=[...(current.images||[]),...uploaded].slice(0,18);
      setTopics(prev=>prev.map(t=>t.id===noteId?{...t,images:nextImages}:t));
      setSelNote(prev=>prev?.id===noteId?{...prev,images:nextImages}:prev);
      setSelected(prev=>prev?.id===noteId?{...prev,images:nextImages}:prev);
      console.log(`[xhs] uploaded ${uploaded.length} image(s) to cloud for note ${noteId}`);
    }catch(e){
      console.error("[xhs] addNoteImages failed:",e);
      setPersistError(`⚠ 图片上传失败：${e.message}`);
    }finally{setImgSaving(false);}
  };
  const removeNoteImage=async(noteId,imgId)=>{
    setImgSaving(true);
    try{
      const current=topics.find(t=>t.id===noteId);
      if(!current)return;
      const removed=(current.images||[]).find(i=>i.id===imgId);
      const nextImages=(current.images||[]).filter(i=>i.id!==imgId);
      setTopics(prev=>prev.map(t=>t.id===noteId?{...t,images:nextImages}:t));
      setSelNote(prev=>prev?.id===noteId?{...prev,images:nextImages}:prev);
      setSelected(prev=>prev?.id===noteId?{...prev,images:nextImages}:prev);
      // Async cleanup (don't block UI)
      if(removed){
        await storage.deleteStoragePath(removed.storagePath);
        await storage.deleteNoteImageRow(imgId);
      }
    }catch(e){console.error("[xhs] removeNoteImage failed:",e);}
    finally{setImgSaving(false);}
  };
  const moveNoteImage=async(noteId,imgId,dir)=>{
    setImgSaving(true);
    try{
      const current=topics.find(t=>t.id===noteId);
      if(!current)return;
      const imgs=[...(current.images||[])];
      const i=imgs.findIndex(x=>x.id===imgId);
      if(i<0)return;
      const j=dir==="up"?i-1:i+1;
      if(j<0||j>=imgs.length)return;
      [imgs[i],imgs[j]]=[imgs[j],imgs[i]];
      setTopics(prev=>prev.map(t=>t.id===noteId?{...t,images:imgs}:t));
      setSelNote(prev=>prev?.id===noteId?{...prev,images:imgs}:prev);
      setSelected(prev=>prev?.id===noteId?{...prev,images:imgs}:prev);
      // Persist new ordering
      await Promise.all(imgs.map((img,idx)=>storage.updateNoteImageOrder(img.id,idx)));
    }catch(e){console.error("[xhs] moveNoteImage failed:",e);}
    finally{setImgSaving(false);}
  };
  const deleteTopic=(id)=>{
    const topic=topics.find(t=>t.id===id);
    setTopics(prev=>prev.filter(t=>t.id!==id));
    // Clean up cloud: delete topic row (CASCADE removes note_images), then storage files
    db.deleteTopicRow(id).catch(e=>console.warn("[xhs] cloud delete topic failed",e));
    if(topic){
      (topic.images||[]).forEach(img=>{
        if(img.storagePath)storage.deleteStoragePath(img.storagePath);
      });
      if(topic.coverImagePath)storage.deleteStoragePath(topic.coverImagePath);
    }
    // Legacy local cleanup
    idbDeleteImages(id);idbSaveCover(id,null);
    if(selected?.id===id){setSelected(null);setTab("board");}
  };
  // Set/clear cover for a note. Uploads to Supabase Storage, stores path on topic.
  const setNoteCover=async(noteId,dataUrl)=>{
    if(!noteId||!userId)return;
    setImgSaving(true);
    try{
      let coverPath=null,signedUrl="";
      if(dataUrl){
        coverPath=await storage.uploadCoverFromDataUrl(dataUrl,{userId,topicId:noteId});
        signedUrl=await storage.getSignedUrl(coverPath);
      } else {
        // Clear: delete old cover from storage
        const current=topics.find(t=>t.id===noteId);
        if(current?.coverImagePath){
          await storage.deleteStoragePath(current.coverImagePath);
        }
      }
      // Update topic: coverImagePath (DB) + coverImage (display URL)
      setTopics(prev=>prev.map(t=>t.id===noteId?{...t,coverImagePath:coverPath,coverImage:signedUrl}:t));
      setSelected(prev=>prev?.id===noteId?{...prev,coverImagePath:coverPath,coverImage:signedUrl}:prev);
      setCoverBgUrl(signedUrl);
      // Trigger topics auto-save (which will push coverImagePath to Supabase)
      console.log(`[xhs] cover ${dataUrl?"uploaded":"cleared"} for note ${noteId}`);
    }catch(e){
      console.error("[xhs] setNoteCover failed:",e);
      setPersistError(`⚠ 封面保存失败：${e.message}`);
    }finally{setImgSaving(false);}
  };
  const addCommentTemplate=()=>{if(!newComment.scene.trim())return;setComments(prev=>[{id:uid(),...newComment},...prev]);setNewComment({scene:"",reply:"",tag:"人设"});};
  const deleteComment=(id)=>{
    setComments(prev=>prev.filter(c=>c.id!==id));
    db.deleteCommentRow(id).catch(e=>console.warn("[xhs] cloud delete comment failed",e));
  };
  const saveEditComment=()=>{if(!editingComment)return;setComments(prev=>prev.map(c=>c.id===editingComment.id?{...editingComment}:c));setEditingComment(null);};

  // ═══ CLOUD HYDRATION: fetch topics + comments from Supabase on mount ═══
  // Uses a per-user flag in localStorage so seeding never runs twice for the same account.
  useEffect(()=>{
    if(!userId){setCloudReady(true);return;} // No user — keep state empty
    let cancelled=false;
    const seededKey=`xhs_seeded_${userId}`;
    (async()=>{
      try{
        // 1. Try local-storage migration (no-op if cloud has data OR already migrated)
        const migrated=await db.migrateLocalToSupabase(userId);
        if(migrated.migratedTopics>0||migrated.migratedComments>0){
          console.log(`[xhs] Migrated to cloud: ${migrated.migratedTopics} topics, ${migrated.migratedComments} comments`);
          if(!cancelled)setMigrationInfo(migrated);
          try{localStorage.setItem(seededKey,"1");}catch(e){}
        }
        // 2. Fetch from cloud (topics + comments + pattern report)
        const [cloudTopics,cloudComments,cloudReport]=await Promise.all([
          db.fetchTopics(),
          db.fetchComments(),
          db.fetchPatternReport(),
        ]);
        if(cancelled)return;
        if(cloudReport)setPatternAI(cloudReport);
        // 3. Dedupe by title (defensive: if old duplicates exist locally, keep first)
        const seenTitles=new Set();
        const dedupedTopics=[];
        for(const t of cloudTopics){
          const key=`${t.title}|${t.pillar||""}`;
          if(seenTitles.has(key))continue;
          seenTitles.add(key);
          dedupedTopics.push(t);
        }
        // 4. Seed initial data ONLY if cloud empty + never seeded for this user before
        let finalTopics=dedupedTopics;
        let finalComments=cloudComments;
        const alreadySeeded=(()=>{try{return localStorage.getItem(seededKey)==="1";}catch(e){return false;}})();
        if(dedupedTopics.length===0&&migrated.migratedTopics===0&&!alreadySeeded){
          const enrichWithCal=(arr)=>{
            const STATUS_OFFSET={"已发布":0,"待发布":3,"写作中":7,"待写":14,"灵感池":21};
            let unscheduledIdx=0;
            return arr.map(t=>{
              if(t.publishTime)return t;
              const cal=SEED_CAL_NOTES.find(c=>c.title===t.title);
              if(cal&&cal.publish_date)return {...t,publishTime:`${cal.publish_date}T21:00:00`};
              const baseDays=STATUS_OFFSET[t.status]??14;
              const offset=baseDays+(unscheduledIdx++);
              const d=new Date();d.setDate(d.getDate()+offset);
              const dateStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
              return {...t,publishTime:`${dateStr}T21:00:00`,autoScheduled:true};
            });
          };
          finalTopics=enrichWithCal(SEED_TOPICS);
          await db.upsertTopicsBatch(finalTopics,userId);
          try{localStorage.setItem(seededKey,"1");}catch(e){}
          console.log("[xhs] Seeded initial data for new user");
        }
        if(cloudComments.length===0&&migrated.migratedComments===0&&!alreadySeeded){
          finalComments=SEED_COMMENTS;
          for(const c of finalComments){await db.upsertComment(c,userId);}
        }
        // 5. Hydrate images + cover URLs from Supabase Storage
        let hydratedTopics=finalTopics;
        try{
          hydratedTopics=await storage.hydrateTopicImages(finalTopics);
        }catch(e){
          console.warn("[xhs] image hydration failed (continuing without):",e);
        }
        if(!cancelled){
          setTopics(hydratedTopics);
          setComments(finalComments);
        }
      }catch(e){
        console.error("[xhs] Cloud hydration failed:",e);
        if(!cancelled)setPersistError(`⚠ 云端同步失败：${e.message}`);
      }finally{
        if(!cancelled)setCloudReady(true);
      }
    })();
    return()=>{cancelled=true;};
  },[userId]);

  // ═══ Legacy IDB hydration disabled — cloud Storage is now source of truth ═══
  useEffect(()=>{setImgStoreReady(true);},[]);

  // ═══ Auto-push topics to Supabase (debounced, source of truth = cloud) ═══
  // Also keep localStorage as offline cache for fast initial paint next visit.
  const topicsSaveTimer=useRef(null);
  useEffect(()=>{
    if(!cloudReady||!userId)return;
    if(topicsSaveTimer.current)clearTimeout(topicsSaveTimer.current);
    topicsSaveTimer.current=setTimeout(async()=>{
      try{
        await db.upsertTopicsBatch(topics,userId);
        // Local backup (without heavy fields)
        const slim=topics.map(({images,coverImage,...rest})=>rest);
        try{localStorage.setItem("xhs_topics_v1",JSON.stringify(slim));}catch(e){}
        setPersistError("");
      }catch(e){
        console.error("[xhs] cloud topics push failed",e);
        setPersistError(`⚠ 云端保存失败：${e.message}`);
      }
    },800); // 800ms debounce — coalesce rapid edits
    return()=>{if(topicsSaveTimer.current)clearTimeout(topicsSaveTimer.current);};
  },[topics,cloudReady,userId]);

  // ═══ Auto-push comments to Supabase ═══
  const commentsSaveTimer=useRef(null);
  useEffect(()=>{
    if(!cloudReady||!userId)return;
    if(commentsSaveTimer.current)clearTimeout(commentsSaveTimer.current);
    commentsSaveTimer.current=setTimeout(async()=>{
      try{
        // Upsert each comment (no batch helper for simplicity)
        for(const c of comments){await db.upsertComment(c,userId);}
        try{localStorage.setItem("xhs_comments_v1",JSON.stringify(comments));}catch(e){}
      }catch(e){
        console.error("[xhs] cloud comments push failed",e);
      }
    },800);
    return()=>{if(commentsSaveTimer.current)clearTimeout(commentsSaveTimer.current);};
  },[comments,cloudReady,userId]);

  // calNotes is derived from topics — no separate persistence needed.
  // Clean up legacy storage from earlier version (one-time)
  useEffect(()=>{try{localStorage.removeItem("xhs_cal_notes_v1");}catch(e){}},[]);

  // Auto-scroll cover design chat
  useEffect(()=>{
    if(coverMsgs.length>0)setTimeout(()=>coverChatEndRef.current?.scrollIntoView({behavior:"smooth"}),60);
  },[coverMsgs]);

  /* ── Cover download ── */
  const downloadCover=()=>{
    // If an SVG cover is active, download it directly as SVG
    if(coverBgUrl&&coverBgUrl.startsWith("data:image/svg+xml")){
      const svgStr=decodeURIComponent(coverBgUrl.replace("data:image/svg+xml;charset=utf-8,",""));
      const blob=new Blob([svgStr],{type:"image/svg+xml"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`cover-${Date.now()}.svg`;a.click();
      URL.revokeObjectURL(url);
      return;
    }
    // Otherwise use canvas for text-based preview
    const W=1080,H=1440;
    const canvas=document.createElement("canvas");
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext("2d");
    const grad=ctx.createLinearGradient(0,0,W,H);
    grad.addColorStop(0,"#1a1520");grad.addColorStop(0.5,"#201a28");grad.addColorStop(1,"#1a1520");
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#333";ctx.font="bold 38px sans-serif";ctx.textAlign="left";
    ctx.fillText("30+ 人生草稿",70,80);
    ctx.fillStyle="#f0ebe6";ctx.font="bold 108px sans-serif";ctx.textAlign="left";
    const lines=(draft.cover||"封面大字").split("\n");
    lines.forEach((ln,i)=>ctx.fillText(ln,70,580+i*150));
    ctx.fillStyle=ACCENT;ctx.font="bold 42px sans-serif";ctx.textAlign="right";
    ctx.fillText("@Shreya",W-70,H-70);
    canvas.toBlob(blob=>{
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=`cover-${Date.now()}.png`;a.click();
      URL.revokeObjectURL(url);
    },"image/png");
  };

  /* ── Review handlers ── */
  const openNoteDetail=(note)=>{setSelNote(note);setSelSnap(note.snapshots[note.snapshots.length-1]);setReviewView("note-detail");};
  const openDiagnosis=(snap)=>{setSelSnap(snap);setReviewView("diagnosis");};
  const updateSnapData=(noteId,snapId,patch)=>{
    setTopics(prev=>prev.map(n=>{
      if(n.id!==noteId)return n;
      const newSnaps=(n.snapshots||[]).map(s=>s.id===snapId?{...s,...patch}:s);
      return {...n,snapshots:newSnaps};
    }));
    setSelNote(prev=>{
      if(!prev||prev.id!==noteId)return prev;
      const newSnaps=(prev.snapshots||[]).map(s=>s.id===snapId?{...s,...patch}:s);
      return {...prev,snapshots:newSnaps};
    });
    setSelSnap(prev=>prev?.id===snapId?{...prev,...patch}:prev);
  };
  const deleteSnapshot=(noteId,snapId)=>{
    setTopics(prev=>prev.map(n=>{
      if(n.id!==noteId)return n;
      return {...n,snapshots:(n.snapshots||[]).filter(s=>s.id!==snapId)};
    }));
    setSelNote(prev=>{
      if(!prev||prev.id!==noteId)return prev;
      return {...prev,snapshots:(prev.snapshots||[]).filter(s=>s.id!==snapId)};
    });
    setSelSnap(prev=>prev?.id===snapId?null:prev);
  };
  const goBackToList=()=>{setReviewView("list");setSelNote(null);setSelSnap(null);};
  const goBackToNote=()=>{setReviewView("note-detail");};

  const toggleAction=(snapshotId,idx)=>{
    const key=`${snapshotId}-${idx}`;
    setActionChecked(prev=>({...prev,[key]:!prev[key]}));
  };

  /* Real screenshot upload OCR via AI vision */
  const processScreenshot=async(file)=>{
    if(!file)return;
    if(!activeKey){setOcrError("⚠ 请先在「AI对话」面板配置 API Key（需支持视觉的模型）");return;}
    setUploadStep(1);setUploadProgress(0);setOcrError("");
    // Read file as base64
    const dataUrl=await new Promise(res=>{
      const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file);
    });
    setOcrPreviewUrl(dataUrl);
    const base64=dataUrl.split(",")[1];
    const mimeType=file.type||"image/png";
    // Fake progress for UX
    const progTimer=setInterval(()=>{
      setUploadProgress(p=>p>=90?90:p+5);
    },150);
    const sys=`你是小红书数据识别助手。用户上传了一张小红书创作中心的笔记数据截图。
请提取截图中的数据，输出严格的 JSON 格式（用 \`\`\`json ... \`\`\` 包裹）：
{
  "title": "笔记标题（如截图可见）",
  "views": 浏览量数字,
  "likes": 点赞数字,
  "collects": 收藏数字,
  "comments": 评论数字,
  "shares": 分享数字（如无则0）,
  "newFollowers": 新增粉丝数字（如无则0）,
  "type": "快照类型，根据发布时长判断：1h/24h/72h/7d 其中之一"
}
注意：
- 数字直接输出阿拉伯数字，不要带 k/w 后缀（10w = 100000，1.5k = 1500）
- 如果某项数据截图中没有，填 0
- 字符串值用英文双引号，不要用中文引号
- 只输出 JSON，不要其他解释`;
    try{
      let reply="";
      if(aiProvider==="claude"){
        const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":claudeKey,"anthropic-version":"2023-06-01","content-type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
          body:JSON.stringify({model:"claude-opus-4-5",max_tokens:1000,system:sys,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mimeType,data:base64}},{type:"text",text:"请识别这张小红书数据截图。"}]}]})});
        if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`HTTP ${res.status}`);}
        const d=await res.json();reply=d.content?.[0]?.text||"";
      } else if(aiProvider==="openai"){
        const res=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${openaiKey}`,"Content-Type":"application/json"},
          body:JSON.stringify({model:"gpt-4o",max_tokens:1000,messages:[{role:"system",content:sys},{role:"user",content:[{type:"image_url",image_url:{url:dataUrl}},{type:"text",text:"请识别这张小红书数据截图。"}]}]})});
        if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`HTTP ${res.status}`);}
        const d=await res.json();reply=d.choices?.[0]?.message?.content||"";
      } else {
        const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({system_instruction:{parts:[{text:sys}]},contents:[{role:"user",parts:[{inline_data:{mime_type:mimeType,data:base64}},{text:"请识别这张小红书数据截图。"}]}]})});
        if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`HTTP ${res.status}`);}
        const d=await res.json();reply=d.candidates?.[0]?.content?.parts?.[0]?.text||"";
      }
      clearInterval(progTimer);setUploadProgress(100);
      // Parse JSON using robust parser (smart quotes, trailing commas, newlines)
      const parsed=parseScoreJSON(reply);
      // Try to match note by title
      let matched=null;
      if(parsed.title){
        const t=parsed.title.toLowerCase();
        matched=reviewNotes.find(n=>n.title.toLowerCase().includes(t.slice(0,8))||t.includes(n.title.toLowerCase().slice(0,8)));
      }
      setOcrNote(matched||reviewNotes[0]||null);
      setOcrData({
        views:+parsed.views||0,
        likes:+parsed.likes||0,
        collects:+parsed.collects||0,
        comments:+parsed.comments||0,
        shares:+parsed.shares||0,
        newFollowers:+parsed.newFollowers||0,
        type:parsed.type||"24h",
      });
      setUploadStep(2);
    }catch(err){
      clearInterval(progTimer);
      setOcrError(`⚠ 识别失败：${err.message}`);
      setUploadStep(0);
    }
  };

  /* Confirm OCR → add snapshot using actual edited data. Supports auto-creating a new topic. */
  const confirmOCR=()=>{
    if(!ocrNote){setOcrError("⚠ 请选择要附加快照的笔记");return;}
    const newSnap={
      id:uid(),type:ocrData.type,time:new Date().toISOString(),
      views:+ocrData.views||0,likes:+ocrData.likes||0,collects:+ocrData.collects||0,
      comments:+ocrData.comments||0,shares:+ocrData.shares||0,newFollowers:+ocrData.newFollowers||0,
      aiDiagnosis:null,
    };
    if(ocrNote.id==="__NEW__"){
      // Create a new topic with this snapshot
      const newTopic={
        id:uid(),
        title:ocrNote.title||"未命名笔记",
        pillar:ocrNote.pillar||"人生重铸",
        status:"已发布",
        score:70,goal:"数据回填",tag:"OCR录入",
        noteType:"image",
        publishTime:new Date().toISOString(),
        tags:[],coverText:"",
        snapshots:[newSnap],
      };
      setTopics(prev=>[newTopic,...prev]);
    } else {
      setTopics(prev=>prev.map(n=>n.id===ocrNote.id?{...n,snapshots:[...(n.snapshots||[]),newSnap]}:n));
    }
    setReviewModal(null);setUploadStep(0);setOcrNote(null);setOcrPreviewUrl("");setOcrError("");
  };

  /* Simulate AI prediction for new note */
  const generatePrediction=()=>{
    if(!newNoteForm.title.trim())return;
    setPredStep(1);
    setTimeout(()=>{
      const pt=newNoteForm.publishTime?new Date(newNoteForm.publishTime):null;
      const isPublished=pt&&pt<=new Date();
      const mockNote={
        id:uid(),title:newNoteForm.title,pillar:newNoteForm.pillar,
        status:isPublished?"已发布":"预测中",
        noteType:newNoteForm.noteType,
        publishTime:newNoteForm.publishTime||new Date().toISOString(),
        tags:newNoteForm.tags.split(/[,，\s]+/).filter(Boolean),
        coverText:generateCover(newNoteForm.title),
        aiPrediction:{
          confidence:0.68,
          predictions:{
            views:       {min:2800,median:4500,max:7200},
            likeRate:    {min:4.5, median:5.8, max:7.2},
            collectRate: {min:3.8, median:5.0, max:6.5},
            commentRate: {min:0.9, median:1.3, max:1.9},
            newFollowers:{min:12,  median:22,  max:38},
          },
          reasons:[
            {type:"title", score:hasConflict(newNoteForm.title)?8.3:6.5, baseline:7.8,
              desc:hasConflict(newNoteForm.title)?"标题含冲突词，情绪张力高于均值7.8":"标题缺乏冲突词，建议加入「以为/才发现」等词提升张力"},
            {type:"time_slot",score:null,baseline:null,desc:"建议发布时间：周一/周四 21:00，你的TOP2时段"},
            {type:"structure",score:null,baseline:null,desc:`选题「${newNoteForm.pillar}」历史爆款率${newNoteForm.pillar==="身体重铸"?"100%":"28%"}`},
          ],
          risks:[
            "确保封面文字不超过10字，提升移动端可读性",
            "发布后第一小时内安排好友互动，避免冷启动",
          ],
        },
        snapshots:[],
      };
      setPredNote(mockNote);setPredStep(2);
    },1500);
  };

  const confirmNewNote=()=>{
    if(!predNote)return;
    // Add to topics (Board = source of truth); reviewNotes auto-derives from topics
    setTopics(prev=>[{...predNote,score:predNote.aiPrediction?.confidence?Math.round(predNote.aiPrediction.confidence*100):70,goal:"人设/共鸣",tag:"新建"},...prev]);
    setReviewModal(null);setPredStep(0);setPredNote(null);
    setNewNoteForm({title:"",pillar:"人生重铸",tags:"",publishTime:"",noteType:"image"});
  };

  /* ── AI Chat helpers ── */
  const parseApplyBlocks=(content)=>{
    const blocks=[];
    const m=(tag)=>{const r=new RegExp(`【${tag}】([\\s\\S]*?)【/${tag}】`);const x=content.match(r);return x?x[1].trim():null;};
    const t=m("标题");const b=m("正文");const c=m("封面");
    if(t)blocks.push({type:"title",label:"标题",value:t});
    if(b)blocks.push({type:"body",label:"正文",value:b});
    if(c)blocks.push({type:"cover",label:"封面",value:c});
    return blocks;
  };

  // Save total AI score to selected topic + record timestamp
  const saveScoreToNote=(score)=>{
    if(!selected||!score)return;
    const now=new Date().toISOString();
    setTopics(prev=>prev.map(t=>t.id===selected.id?{...t,score:Math.round(score),scoredAt:now}:t));
    setSelected(prev=>prev?{...prev,score:Math.round(score),scoredAt:now}:prev);
  };

  const applyBlock=(block)=>{
    if(block.type==="title")setDraft(d=>({...d,title:block.value,cover:generateCover(block.value)}));
    if(block.type==="body")setDraft(d=>({...d,body:block.value}));
    if(block.type==="cover")setDraft(d=>({...d,cover:block.value}));
    setChatMsgs(prev=>[...prev,{role:"assistant",content:`✓ 已应用${block.label}。`,_sys:true}]);
  };

  const saveKey=()=>{
    const k=keyDraft.trim();if(!k)return;
    if(setupProvider==="claude"){localStorage.setItem("xhs_claude_key",k);setClaudeKey(k);}
    else if(setupProvider==="openai"){localStorage.setItem("xhs_openai_key",k);setOpenaiKey(k);}
    else{localStorage.setItem("xhs_gemini_key",k);setGeminiKey(k);}
    localStorage.setItem("xhs_ai_provider",setupProvider);setAiProvider(setupProvider);
    setKeyDraft("");
  };

  const clearKey=(provider)=>{
    if(provider==="claude"){localStorage.removeItem("xhs_claude_key");setClaudeKey("");}
    else if(provider==="openai"){localStorage.removeItem("xhs_openai_key");setOpenaiKey("");}
    else{localStorage.removeItem("xhs_gemini_key");setGeminiKey("");}
    setChatMsgs([]);
  };

  const switchProvider=(p)=>{
    setAiProvider(p);localStorage.setItem("xhs_ai_provider",p);setChatError("");
  };

  const sendAiChat=async()=>{
    if(!chatInput.trim()||chatLoading)return;
    const key=aiProvider==="claude"?claudeKey:aiProvider==="openai"?openaiKey:geminiKey;
    const providerLabel=aiProvider==="claude"?"Anthropic":aiProvider==="openai"?"OpenAI":"Google";
    if(!key){setChatError(`请先输入 ${providerLabel} API Key`);return;}
    const userMsg={role:"user",content:chatInput.trim()};
    const historyMsgs=[...chatMsgs.filter(m=>!m._sys),userMsg];
    setChatMsgs(prev=>[...prev,userMsg]);
    setChatInput("");setChatLoading(true);setChatError("");
    const systemPrompt=`你是小红书（XHS）内容创作助手，帮助用户打磨笔记。当前草稿内容如下：\n\n【当前标题】${draft.title||"（空）"}\n【当前正文】${draft.body||"（空）"}\n【当前封面文案】${draft.cover||"（空）"}\n\n当你给出可应用的修改内容时，请用以下标记包裹：\n- 修改标题：【标题】新标题内容【/标题】\n- 修改正文：【正文】新正文内容【/正文】\n- 修改封面：【封面】封面文案【/封面】\n\n标记内只放最终内容，不放解释。解释放在标记外面。用中文简洁回答。`;
    try{
      let resp,acc="";
      setChatMsgs(prev=>[...prev,{role:"assistant",content:""}]);
      if(aiProvider==="claude"){
        resp=await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",
          headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
          body:JSON.stringify({model:"claude-opus-4-5",max_tokens:1500,stream:true,system:systemPrompt,messages:historyMsgs.map(m=>({role:m.role,content:m.content}))}),
        });
        if(!resp.ok){const e=await resp.json();throw new Error(e.error?.message||`HTTP ${resp.status}`);}
        const reader=resp.body.getReader();const dec=new TextDecoder();
        while(true){
          const{done,value}=await reader.read();if(done)break;
          for(const line of dec.decode(value).split("\n").filter(l=>l.startsWith("data: "))){
            const raw=line.slice(6);if(raw==="[DONE]")continue;
            try{const p=JSON.parse(raw);if(p.type==="content_block_delta"&&p.delta?.type==="text_delta"){acc+=p.delta.text;setChatMsgs(prev=>{const u=[...prev];u[u.length-1]={role:"assistant",content:acc};return u;});}}catch{}
          }
        }
      } else if(aiProvider==="openai") {
        // OpenAI
        const oaMsgs=[{role:"system",content:systemPrompt},...historyMsgs.map(m=>({role:m.role,content:m.content}))];
        resp=await fetch("https://api.openai.com/v1/chat/completions",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
          body:JSON.stringify({model:"gpt-4o",max_tokens:1500,stream:true,messages:oaMsgs}),
        });
        if(!resp.ok){const e=await resp.json();throw new Error(e.error?.message||`HTTP ${resp.status}`);}
        const reader=resp.body.getReader();const dec=new TextDecoder();
        while(true){
          const{done,value}=await reader.read();if(done)break;
          for(const line of dec.decode(value).split("\n").filter(l=>l.startsWith("data: "))){
            const raw=line.slice(6);if(raw==="[DONE]")continue;
            try{const p=JSON.parse(raw);const t=p.choices?.[0]?.delta?.content;if(t){acc+=t;setChatMsgs(prev=>{const u=[...prev];u[u.length-1]={role:"assistant",content:acc};return u;});}}catch{}
          }
        }
      } else {
        // Gemini
        const geminiMsgs=historyMsgs.map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
        resp=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            system_instruction:{parts:[{text:systemPrompt}]},
            contents:geminiMsgs,
            generationConfig:{maxOutputTokens:1500},
          }),
        });
        if(!resp.ok){const e=await resp.json();throw new Error(e.error?.message||`HTTP ${resp.status}`);}
        const reader=resp.body.getReader();const dec=new TextDecoder();
        while(true){
          const{done,value}=await reader.read();if(done)break;
          for(const line of dec.decode(value).split("\n").filter(l=>l.startsWith("data: "))){
            const raw=line.slice(6);
            try{const p=JSON.parse(raw);const t=p.candidates?.[0]?.content?.parts?.[0]?.text;if(t){acc+=t;setChatMsgs(prev=>{const u=[...prev];u[u.length-1]={role:"assistant",content:acc};return u;});}}catch{}
          }
        }
      }
      setTimeout(()=>chatEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
    }catch(err){
      setChatError(err.message);
      setChatMsgs(prev=>prev[prev.length-1]?.content===""?prev.slice(0,-1):prev);
    }finally{setChatLoading(false);}
  };

  /* ── Score helpers ── */
  /* ══════════ COVER DESIGN AI ══════════ */
  const COVER_SYSTEM=`你是专业的小红书封面设计顾问AI。帮用户设计高点击率、高质感封面。每次回复简洁有力，给出：配色方案、排版建议、关键文案方向。当用户上传参考图时，分析风格特点并结合到设计建议中。用户可点击「生成封面图」按钮让你直接输出 SVG 封面代码。`;

  const handleCoverFile=(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const dataUrl=ev.target.result;
      const base64=dataUrl.split(",")[1];
      const mimeType=file.type||"image/jpeg";
      setCoverRefImg({base64,mimeType,preview:dataUrl,name:file.name});
    };
    reader.readAsDataURL(file);
    e.target.value="";
  };

  const sendCoverMsg=async()=>{
    const text=coverInput.trim();
    if(!text&&!coverRefImg)return;
    if(!activeKey){setCoverMsgs(p=>[...p,{role:"assistant",content:"⚠ 请先在「AI对话」面板配置 API Key。"}]);return;}
    const userMsg={role:"user",content:text,refImage:coverRefImg||null};
    setCoverMsgs(p=>[...p,userMsg]);
    setCoverInput("");
    const pendingRef=coverRefImg;
    setCoverRefImg(null);
    setCoverLoading(true);
    // Build history for API (last 10 messages)
    const history=[...coverMsgs.slice(-10),userMsg];
    try{
      let reply="";
      if(aiProvider==="claude"){
        const msgs=history.map(m=>{
          if(m.refImage){
            return{role:"user",content:[
              {type:"image",source:{type:"base64",media_type:m.refImage.mimeType,data:m.refImage.base64}},
              {type:"text",text:m.content||"请分析这张参考图的封面设计风格"},
            ]};
          }
          return{role:m.role,content:m.content};
        });
        const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":claudeKey,"anthropic-version":"2023-06-01","content-type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
          body:JSON.stringify({model:"claude-opus-4-5",max_tokens:800,system:COVER_SYSTEM,messages:msgs})});
        const data=await res.json();
        reply=data.content?.[0]?.text||"出错了，请重试";
      } else if(aiProvider==="openai"){
        const msgs=[{role:"system",content:COVER_SYSTEM},...history.map(m=>{
          if(m.refImage){
            return{role:"user",content:[
              {type:"image_url",image_url:{url:`data:${m.refImage.mimeType};base64,${m.refImage.base64}`}},
              {type:"text",text:m.content||"请分析这张参考图的封面设计风格"},
            ]};
          }
          return{role:m.role,content:m.content};
        })];
        const res=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${openaiKey}`,"Content-Type":"application/json"},
          body:JSON.stringify({model:"gpt-4o",max_tokens:800,messages:msgs})});
        const data=await res.json();
        reply=data.choices?.[0]?.message?.content||"出错了，请重试";
      } else {
        const parts_arr=history.map(m=>{
          if(m.refImage){
            return{role:"user",parts:[
              {inline_data:{mime_type:m.refImage.mimeType,data:m.refImage.base64}},
              {text:m.content||"请分析这张参考图的封面设计风格"},
            ]};
          }
          return{role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]};
        });
        const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({system_instruction:{parts:[{text:COVER_SYSTEM}]},contents:parts_arr})});
        const data=await res.json();
        reply=data.candidates?.[0]?.content?.parts?.[0]?.text||"出错了，请重试";
      }
      setCoverMsgs(p=>[...p,{role:"assistant",content:reply}]);
      setCoverLoading(false);
    }catch(err){
      setCoverMsgs(p=>[...p,{role:"assistant",content:`⚠ 错误：${err.message}`}]);
      setCoverLoading(false);
    }
  };

  /* SVG fallback (used when no Gemini key) */
  const SVG_COVER_SYSTEM=`你是专业的小红书封面SVG设计师。
任务：输出一段完整可渲染的 SVG 代码作为封面（viewBox="0 0 1080 1440"，竖版3:4）。
设计要求：
- 极简高级感，暗色调为主（背景可用渐变或深色纯色）
- 主标题文字要大且有视觉冲击力（font-size 120-180）
- 可使用几何图形、线条等装饰元素
- 固定包含：主标题（来自用户内容）、作者署名 @Shreya（右下角，accent色 #C8FF00）
- 必须用 \`\`\`svg ... \`\`\` 包裹输出，不要其他解释`;

  /* 设计 prompt 工程：把用户输入 + 对话历史 + 参考图描述 → 生成超丰富的图像 prompt */
  const buildImagePrompt=(coverMainText,descText)=>{
    // 提取最近 6 条对话作为设计语境
    const ctx=coverMsgs.slice(-6).filter(m=>!m.isGenerating&&!m.svgCode&&!m.imageUrl)
      .map(m=>`${m.role==="user"?"用户":"AI"}: ${m.content}`).join("\n");
    return `Design a high-end Xiaohongshu (小红书) cover image, vertical 3:4 ratio (1080x1440).

MAIN TEXT to display prominently on cover: "${coverMainText}"
${descText?`USER STYLE REQUEST: ${descText}\n`:""}${ctx?`DESIGN CONTEXT FROM PRIOR CHAT:\n${ctx}\n`:""}
DESIGN REQUIREMENTS:
- Premium, magazine-quality aesthetic with strong visual hierarchy
- Bold, large Chinese typography as the focal point (the main text above must be clearly readable, large, beautifully kerned)
- Sophisticated color palette: warm muted tones OR moody dark with one accent color
- Negative space, balanced composition, editorial feel
- Texture/grain/film aesthetic if appropriate
- Small "@Shreya" signature in bottom-right corner in neon yellow-green (#C8FF00)
- Tiny "30+ 人生草稿" label top-left in subtle gray
- NO watermarks, NO logos, NO stock-photo look
- Style references: Kinfolk magazine, Aesop branding, MUJI minimalism, Japanese 杂志 design

The image MUST contain the Chinese main text rendered legibly as part of the visual design (not as overlay).`;
  };

  const generateCoverImg=async()=>{
    if(!geminiKey){
      setCoverMsgs(p=>[...p,{role:"assistant",content:"⚠ 真实图像生成需要 Gemini API Key（免费申请：aistudio.google.com）。请在「AI对话」面板配置 Gemini Key 后重试。\n\n💡 如果只有 Claude key，会自动降级为 SVG 矢量封面（设计感有限）。"}]);
      // Fall back to SVG generation via active AI
      if(activeKey)await generateSVGCover();
      return;
    }
    const descText=coverInput.trim();
    const coverMainText=draft.cover||draft.title||"封面标题";
    if(descText){
      setCoverMsgs(p=>[...p,{role:"user",content:descText}]);
      setCoverInput("");
    }
    setGenImgLoading(true);
    const refNote=coverRefImg?"（基于参考图风格）":"";
    setCoverMsgs(p=>[...p,{role:"assistant",content:`🎨 Gemini 正在生成封面图${refNote}…`,isGenerating:true}]);

    const imagePrompt=buildImagePrompt(coverMainText,descText);
    // Build multimodal parts: text prompt + optional reference image
    const parts=[{text:imagePrompt}];
    if(coverRefImg){
      parts.unshift({inline_data:{mime_type:coverRefImg.mimeType,data:coverRefImg.base64}});
      // also append explicit style transfer instruction
      parts.push({text:"\nUse the attached reference image as the primary visual style inspiration: match its color palette, mood, composition style, and texture. Adapt these qualities to the cover design while including the Chinese text above."});
    }
    setCoverRefImg(null);

    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${geminiKey}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          contents:[{role:"user",parts}],
          generationConfig:{responseModalities:["IMAGE","TEXT"],temperature:1.0},
        }),
      });
      const data=await res.json();
      if(!res.ok){
        const errMsg=data?.error?.message||`HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      // Find image part in response
      const respParts=data?.candidates?.[0]?.content?.parts||[];
      const imgPart=respParts.find(p=>p.inlineData||p.inline_data);
      const textPart=respParts.find(p=>p.text);
      if(imgPart){
        const inline=imgPart.inlineData||imgPart.inline_data;
        const mime=inline.mimeType||inline.mime_type||"image/png";
        const imageUrl=`data:${mime};base64,${inline.data}`;
        const noteText=textPart?.text||"✦ 封面图已生成";
        setCoverMsgs(p=>[...p.filter(m=>!m.isGenerating),{role:"assistant",content:noteText,imageUrl}]);
      } else {
        const errText=textPart?.text||"⚠ 未返回图像，可能被安全策略拦截，请换一种描述方式。";
        setCoverMsgs(p=>[...p.filter(m=>!m.isGenerating),{role:"assistant",content:errText}]);
      }
    }catch(err){
      setCoverMsgs(p=>[...p.filter(m=>!m.isGenerating),{role:"assistant",content:`⚠ Gemini 生成失败：${err.message}`}]);
    }finally{setGenImgLoading(false);}
  };

  /* Fallback: SVG cover generator (when only Claude/GPT available) */
  const generateSVGCover=async()=>{
    const descText=coverInput.trim();
    const coverMainText=draft.cover||draft.title||"封面标题";
    if(descText){setCoverMsgs(p=>[...p,{role:"user",content:descText}]);setCoverInput("");}
    setGenImgLoading(true);
    setCoverMsgs(p=>[...p,{role:"assistant",content:"🎨 正在生成 SVG 矢量封面…",isGenerating:true}]);
    const req=`请为以下小红书封面生成 SVG 代码。\n封面主标题：「${coverMainText}」\n${descText?`用户补充：${descText}`:""}\n输出完整 SVG，用\`\`\`svg ... \`\`\`包裹。`;
    try{
      let reply="";
      if(aiProvider==="claude"){
        const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":claudeKey,"anthropic-version":"2023-06-01","content-type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
          body:JSON.stringify({model:"claude-opus-4-5",max_tokens:2000,system:SVG_COVER_SYSTEM,messages:[{role:"user",content:req}]})});
        const d=await res.json();reply=d.content?.[0]?.text||"";
      } else if(aiProvider==="openai"){
        const res=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${openaiKey}`,"Content-Type":"application/json"},
          body:JSON.stringify({model:"gpt-4o",max_tokens:2000,messages:[{role:"system",content:SVG_COVER_SYSTEM},{role:"user",content:req}]})});
        const d=await res.json();reply=d.choices?.[0]?.message?.content||"";
      }
      const svgMatch=reply.match(/```svg\s*([\s\S]*?)\s*```/i)||reply.match(/(<svg[\s\S]*?<\/svg>)/i);
      if(svgMatch){
        setCoverMsgs(p=>[...p.filter(m=>!m.isGenerating),{role:"assistant",content:"✦ SVG 封面已生成",svgCode:svgMatch[1].trim()}]);
      } else {
        setCoverMsgs(p=>[...p.filter(m=>!m.isGenerating),{role:"assistant",content:reply||"⚠ 未能提取 SVG。"}]);
      }
    }catch(err){
      setCoverMsgs(p=>[...p.filter(m=>!m.isGenerating),{role:"assistant",content:`⚠ 生成失败：${err.message}`}]);
    }finally{setGenImgLoading(false);}
  };

  /* ── Pattern Report: AI regenerate from live reviewNotes ── */
  const analyzePatternsAI=async()=>{
    if(!activeKey){setPatternError("⚠ 请先在「AI对话」面板配置 API Key");return;}
    if(reviewNotes.length===0){setPatternError("⚠ 暂无已发布笔记，无法分析");return;}
    setPatternLoading(true);setPatternError("");
    // Build compact data snapshot for AI
    const notesData=reviewNotes.map(n=>{
      const latest=n.snapshots?.[n.snapshots.length-1];
      const lr=latest?.views>0?(latest.likes/latest.views*100).toFixed(1):0;
      const cr=latest?.views>0?(latest.collects/latest.views*100).toFixed(1):0;
      return {
        title:n.title,pillar:n.pillar,publishTime:n.publishTime?.slice(0,10),
        tags:n.tags,coverText:n.coverText,
        views:latest?.views||0,likes:latest?.likes||0,collects:latest?.collects||0,
        comments:latest?.comments||0,newFollowers:latest?.newFollowers||0,
        likeRate:lr,collectRate:cr,statusTags:computeStatusTags(n),
      };
    });
    const sys=`你是小红书数据分析师。分析用户的近期已发布笔记数据，输出 JSON 格式的规律报告。

⚠ JSON 输出严格规则（违反会导致解析失败）：
1. 所有字符串值使用英文双引号 " 包裹，绝对禁止使用中文引号 " " ' '
2. 字符串内部不能有未转义的换行符，必须用 \\n 转义或写在一行
3. 不要有尾随逗号
4. 数组和对象的最后一个元素后不加逗号
5. 字符串内部如果需要引用中文短语，请使用中文书名号《》或方括号【】，避免使用引号

严格按以下结构输出（用 \`\`\`json ... \`\`\` 包裹）：
{
  "hitPatterns": {
    "title": "爆款标题的共性（一句话，<60字）",
    "cover": "爆款封面共性",
    "structure": "爆款内容结构共性",
    "time_slot": "爆款发布时段规律",
    "length": "爆款字数规律",
    "tag_combo": "爆款标签组合规律"
  },
  "failPatterns": {同上6个字段，描述失败/低表现笔记的共性},
  "strategies": [
    {"priority":1,"strategy":"具体可执行的下周策略","rationale":"基于数据的理由","expectedImpact":"预期效果"},
    ...(共5条，按优先级)
  ],
  "skillEvolution": {
    "mastered": ["已掌握的能力","..."],
    "improving": ["进步中","..."],
    "weakAreas": ["待突破","..."]
  }
}
分析要基于实际数据，不要泛泛而谈。只输出 JSON，不要其他解释。`;
    const userMsg=`请分析以下 ${notesData.length} 篇已发布笔记数据，输出规律报告：\n\n${JSON.stringify(notesData,null,2)}`;
    try{
      let reply="";
      if(aiProvider==="claude"){
        const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":claudeKey,"anthropic-version":"2023-06-01","content-type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
          body:JSON.stringify({model:"claude-opus-4-5",max_tokens:3000,system:sys,messages:[{role:"user",content:userMsg}]})});
        if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`HTTP ${res.status}`);}
        const d=await res.json();reply=d.content?.[0]?.text||"";
      } else if(aiProvider==="openai"){
        const res=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${openaiKey}`,"Content-Type":"application/json"},
          body:JSON.stringify({model:"gpt-4o",max_tokens:3000,messages:[{role:"system",content:sys},{role:"user",content:userMsg}]})});
        if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`HTTP ${res.status}`);}
        const d=await res.json();reply=d.choices?.[0]?.message?.content||"";
      } else {
        const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({system_instruction:{parts:[{text:sys}]},contents:[{role:"user",parts:[{text:userMsg}]}]})});
        if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`HTTP ${res.status}`);}
        const d=await res.json();reply=d.candidates?.[0]?.content?.parts?.[0]?.text||"";
      }
      // Parse JSON — multi-pass cleaning to handle AI quirks
      const cb=reply.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      let raw=cb?cb[1]:reply;
      const s=raw.indexOf("{"),e=raw.lastIndexOf("}");
      if(s===-1||e===-1)throw new Error("AI 响应中未找到 JSON");
      let jsonStr=raw.slice(s,e+1);
      // CLEAN_START
      const SMART_DOUBLE=new RegExp(String.fromCharCode(0x201C)+"|"+String.fromCharCode(0x201D),"g");
      const SMART_SINGLE=new RegExp(String.fromCharCode(0x2018)+"|"+String.fromCharCode(0x2019),"g");
      const NBSP=new RegExp(String.fromCharCode(0x00A0),"g");
      const LINE_SEP=new RegExp(String.fromCharCode(0x2028)+"|"+String.fromCharCode(0x2029),"g");
      const TRAILING_COMMA=/,(\s*[}\]])/g;
      jsonStr=jsonStr
        .replace(SMART_DOUBLE,'"')
        .replace(SMART_SINGLE,"'")
        .replace(TRAILING_COMMA,"$1")
        .replace(NBSP," ")
        .replace(LINE_SEP,"\\n");
      // CLEAN_END
      /* legacy block (broken regex literals removed below) */
      let parsed;
      try{
        parsed=JSON.parse(jsonStr);
      }catch(parseErr){
        // Fallback: try to escape unescaped newlines inside strings
        const fixed=jsonStr.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g,(m,inner)=>{
          return '"'+inner.replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\t/g,"\\t")+'"';
        });
        try{parsed=JSON.parse(fixed);}
        catch(e2){
          console.error("[pattern] JSON parse failed. Raw:",jsonStr);
          throw new Error(`JSON 解析失败：${parseErr.message}。已打印原始响应到 console，可截图反馈。`);
        }
      }
      const result={
        ...parsed,
        analyzedAt:new Date().toISOString(),
        analyzedCount:reviewNotes.length,
      };
      setPatternAI(result);
      // Persist to Supabase (per-user); localStorage kept as offline backup
      try{localStorage.setItem("xhs_pattern_ai_v1",JSON.stringify(result));}catch(e){}
      if(userId){
        try{await db.upsertPatternReport(result,userId);}
        catch(e){console.error("[xhs] cloud pattern report push failed",e);}
      }
    }catch(err){
      setPatternError(`⚠ AI 分析失败：${err.message}`);
    }finally{setPatternLoading(false);}
  };

  // Robust JSON extractor — handles AI quirks: smart quotes, trailing commas,
  // unescaped newlines/tabs inside strings, paragraph/line separators.
  const parseScoreJSON=(text)=>{
    const cb=text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const raw=cb?cb[1]:text;
    const s=raw.indexOf("{"),e=raw.lastIndexOf("}");
    if(s===-1||e===-1)throw new Error("未找到 JSON，请重试");
    let jsonStr=raw.slice(s,e+1);
    // Clean common AI quirks (unicode chars via fromCharCode to avoid JS parser issues)
    const SMART_DOUBLE=new RegExp(String.fromCharCode(0x201C)+"|"+String.fromCharCode(0x201D),"g");
    const SMART_SINGLE=new RegExp(String.fromCharCode(0x2018)+"|"+String.fromCharCode(0x2019),"g");
    const NBSP=new RegExp(String.fromCharCode(0x00A0),"g");
    const LINE_SEP=new RegExp(String.fromCharCode(0x2028)+"|"+String.fromCharCode(0x2029),"g");
    jsonStr=jsonStr
      .replace(SMART_DOUBLE,'"')
      .replace(SMART_SINGLE,"'")
      .replace(/,(\s*[}\]])/g,"$1")
      .replace(NBSP," ")
      .replace(LINE_SEP,"\\n");
    try{return JSON.parse(jsonStr);}
    catch(e1){
      // Fallback: escape unescaped \n \r \t inside string values
      const fixed=jsonStr.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g,(m,inner)=>{
        return '"'+inner.replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\t/g,"\\t")+'"';
      });
      try{return JSON.parse(fixed);}
      catch(e2){
        console.error("[xhs] JSON parse failed. Raw:",jsonStr);
        throw new Error(`AI 返回 JSON 解析失败：${e1.message}（已打印原始响应到 Console）`);
      }
    }
  };

  const SCORING_PROMPT=`你是小红书爆款评分专家。请严格按以下完整规则打分，只输出 JSON，不输出任何其他内容。

总分 = 标题×0.4 + 封面×0.35 + 正文×0.25，满分100。

══════════ 标题分（满分40）══════════

① 关键词搜索量（0-10分）
标题中含有的最高搜索量关键词的月搜索量：
≥10万/月 → 10分（如：早C晚A、多巴胺穿搭）
1万-10万 → 7-9分
1千-1万 → 4-6分
<1千 → 0-3分（极小众词）

② 情绪/钩子强度（0-10分）
判断标题是否含有以下"钩子"元素，每项+2分，封顶10分：
- 痛点直击（例："干皮再也不脱皮了"）
- 反常识（例："越贵的面霜越没用"）
- 悬念（例："我用3天就……"）
- 对比/落差（例："从月薪3k到3w我做了…"）
- 紧迫感（例："再不学就晚了"）

③ 数字与具体性（0-8分）
含有具体数字（5个、3天、1分钟）→ +4分
含有具体价格（99元、白菜价）→ +2分
含有具体时间/期限 → +2分

④ 身份/场景代入（0-7分）
明确身份标签（学生党/打工人/i人/30+） → +3分
具体场景（通勤/约会/出差/居家） → +2分
直接称呼用户（"姐妹们"/"集美们"/"你"） → +2分

⑤ 长度与可读性（0-5分）
12-18字 → 5分（小红书最佳区间）
8-12字 或 18-22字 → 3分
<8字 或 >22字 → 1分

══════════ 封面分（满分35，无封面图则基于封面文案评估）══════════

① 第一视觉冲击（0-10分）
把封面缩小到手机信息流尺寸，3秒内能否看清主题：
一眼能看清+想点 → 9-10分
能看清但平平 → 6-8分
要细看才懂 → 3-5分
缩小后看不清 → 0-2分
视觉冲击关键元素（每个+2分）：
- 大字标题（占封面1/4以上）
- 高对比度（黄黑、红白、撞色）
- 强表情或动作（夸张表情、对比图）
- 留白合理（不要全塞满）

② 文字信息密度（0-8分）
封面有大字+小字组合，主标题≤10字 → 7-8分
只有大字标题，简洁有力 → 5-7分
文字太少，没传达价值 → 2-4分
文字过多（>30字），密集压抑 → 0-3分
完全没有文字 → 1-3分（除非是纯视觉系）

③ 色彩与对比度（0-7分）
主色调鲜明（最多3种主色） → +3分
字体与背景高对比 → +2分
符合品类调性（美妆=粉/白，美食=暖色，知识=深色） → +2分

④ 人物/主体清晰度（0-5分）
有清晰人脸/人物 → 5分（人脸是点击率最强信号）
有清晰物品主体 → 3-4分
模糊或杂乱 → 0-2分

⑤ 构图与一致性（0-5分）
构图工整（居中/三分法/对称） → +2分
与账号其他封面风格一致（建立辨识度） → +2分
边角无干扰元素 → +1分

══════════ 正文分（满分25）══════════

① 开头钩子（0-6分）
前3行有以下任一元素 → 5-6分：
- 强痛点共鸣（"我也经历过……"）
- 强结果展示（"3天后我……"）
- 强悬念抛出（"千万别再做XX了"）
- 强情绪表达（"真的太离谱了！"）
平庸的开头（如"今天给大家分享…"）→ 0-2分

② 结构清晰度（0-6分）
用emoji/数字/小标题分段 → +2分
段落短（每段≤3行）→ +2分
结尾有总结/金句 → +2分

③ 信息密度与价值（0-5分）
可操作干货（步骤、工具、链接）→ 4-5分
经验分享（个人故事+总结）→ 3-4分
单纯情绪输出 → 1-2分

④ 互动引导（0-4分）
结尾有提问（引导评论）→ +2分
提示"收藏/保存"→ +1分
提示"关注，下篇讲XX"→ +1分

⑤ 标签与SEO（0-4分）
含1个大热度词（>50万笔记）→ +1分
含2-3个中等竞争词（5-50万笔记）→ +2分
含1个小众精准词（<5万笔记）→ +1分

══════════ 综合判断 ══════════

档位：85-100=🔥高潜爆款 | 70-84=⭐优质内容 | 55-69=📈合格 | 40-54=⚠风险 | <40=❌不建议

单项否决线（触发时在tier字段末尾加"（单项过低降级）"）：
标题<15分 → 整体降一档
封面<12分 → 整体降一档
正文<8分 → 整体降一档

top_3_suggestions 要求：
1. 每条必须具体可执行（"把'心得'换成'干皮急救'"而不是"标题要更吸引人"）
2. current字段描述现状不足，suggestion字段给出具体修改方案
3. expected_lift填写预计提升分数（如"+8分"）

额外输出要求：
1. improved_title：根据top_3_suggestions直接改写出一个更优的标题（字符串，不加引号说明）
2. improved_cover：根据建议改写封面文案（字符串，≤10字，简洁有力）
3. predicted_metrics：基于当前总分和内容特征，给出发布后7天的预估数据范围（三个字段各含min/median/max整数）
   - 浏览量参考：❌<40分→500-2000，⚠40-54→1500-5000，📈55-69→3000-8000，⭐70-84→5000-15000，🔥85+→8000-50000
   - 点赞量≈浏览量×4-7%，收藏量≈浏览量×3-6%

输出严格JSON（字段名不变，不输出任何其他文字）：
{"title_score":{"total":int,"details":{"keyword_search":{"score":int,"reason":"str"},"emotion_hook":{"score":int,"reason":"str"},"specificity":{"score":int,"reason":"str"},"identity_scene":{"score":int,"reason":"str"},"length":{"score":int,"reason":"str"}}},"cover_score":{"total":int,"details":{"visual_impact":{"score":int,"reason":"str"},"text_density":{"score":int,"reason":"str"},"color_contrast":{"score":int,"reason":"str"},"subject_clarity":{"score":int,"reason":"str"},"composition":{"score":int,"reason":"str"}}},"content_score":{"total":int,"details":{"opening_hook":{"score":int,"reason":"str"},"structure":{"score":int,"reason":"str"},"info_value":{"score":int,"reason":"str"},"engagement":{"score":int,"reason":"str"},"seo_tags":{"score":int,"reason":"str"}}},"total_score":int,"tier":"str","weakest_dimension":"str","top_3_suggestions":[{"dimension":"str","current":"str","suggestion":"str","expected_lift":"str"}],"improved_title":"str","improved_cover":"str","predicted_metrics":{"views":{"min":int,"median":int,"max":int},"likes":{"min":int,"median":int,"max":int},"saves":{"min":int,"median":int,"max":int}}}`;

  const scoreNote=async()=>{
    const key=aiProvider==="claude"?claudeKey:aiProvider==="openai"?openaiKey:geminiKey;
    if(!key){setScoreError("请先配置 API Key");setEditorPanel("score");return;}
    setScoreLoading(true);setScoreError("");setScoreResult(null);
    // Pull cover image from selected topic (persisted) OR current coverBgUrl (session)
    const coverImg=selected?.coverImage||coverBgUrl||"";
    const hasCoverImg=!!coverImg;
    const textPrompt=`请评分：
标题：${draft.title||"（未填写）"}
封面文案：${draft.cover||"（未填写）"}
正文：${draft.body||"（未填写）"}
${hasCoverImg?"封面图：已附图，请用 Vision 实际观察图像评估「封面分」5 个维度（视觉冲击/文字密度/色彩对比/主体清晰度/构图）。":"封面图：未上传，仅基于封面文案给出估算。"}

⚠ 关于「关键词搜索量」评估（标题分①项）：
请使用 web search 工具，搜索 "小红书 [关键词]" 看实际相关笔记数量作为热度参考：
- 搜索 "site:xiaohongshu.com [关键词]" 或 "小红书 [关键词] 笔记数"
- 笔记数 ≥ 50万 → 大热词，10分
- 10-50万 → 7-9分
- 1-10万 → 4-6分
- < 1万 → 0-3分
在 reason 字段标注 "（已联网核实：约 N 万笔记）"，不要再猜测月搜索量。`;
    // Convert data URL to base64 + mime for multimodal payload
    let base64="",mimeType="image/png";
    if(hasCoverImg&&coverImg.startsWith("data:")){
      const m=coverImg.match(/^data:([^;]+);(?:base64,|charset=[^,]+,)(.*)$/);
      if(m){mimeType=m[1];base64=m[1].includes("svg")?btoa(unescape(decodeURIComponent(m[2]))):m[2];}
    }
    try{
      let text="";
      if(aiProvider==="claude"){
        const content=hasCoverImg&&base64
          ?[{type:"image",source:{type:"base64",media_type:mimeType,data:base64}},{type:"text",text:textPrompt}]
          :textPrompt;
        const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":claudeKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({
          model:"claude-opus-4-5",max_tokens:3000,system:SCORING_PROMPT,
          messages:[{role:"user",content}],
          tools:[{type:"web_search_20250305",name:"web_search",max_uses:3}],
        })});
        if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}
        const d=await r.json();
        // Claude may return multiple content blocks (tool_use + text). Concatenate text blocks.
        text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
      }else if(aiProvider==="openai"){
        const content=hasCoverImg
          ?[{type:"image_url",image_url:{url:coverImg}},{type:"text",text:textPrompt}]
          :textPrompt;
        // GPT-4o doesn't have built-in web search via chat completions; fall back to estimation
        const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${openaiKey}`},body:JSON.stringify({model:"gpt-4o",max_tokens:2500,messages:[{role:"system",content:SCORING_PROMPT+"\n\n注意：当前模型无法联网，请基于训练知识估算关键词热度，并在 reason 中标注「AI估算」。"},{role:"user",content}]})});
        if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}
        const d=await r.json();text=d.choices?.[0]?.message?.content||"";
      }else{
        const parts=hasCoverImg&&base64
          ?[{inline_data:{mime_type:mimeType,data:base64}},{text:textPrompt}]
          :[{text:textPrompt}];
        const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          system_instruction:{parts:[{text:SCORING_PROMPT}]},
          contents:[{role:"user",parts}],
          tools:[{googleSearch:{}}],
        })});
        if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}
        const d=await r.json();text=d.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n")||"";
      }
      setScoreResult(parseScoreJSON(text));
    }catch(err){setScoreError(err.message);}
    finally{setScoreLoading(false);}
  };

  const NAV=[{id:"board",label:"看板",en:"BOARD"},{id:"editor",label:"创作台",en:"EDITOR"},{id:"calendar",label:"日历",en:"CALENDAR"},{id:"comments",label:"话术库",en:"SCRIPTS"},{id:"review",label:"复盘",en:"REVIEW"}];

  /* ─── When switching away from review, reset sub-view ─── */
  const switchTab=(id)=>{
    setTab(id);
    if(id!=="editor")setSelected(null);
    if(id!=="review"){setReviewView("list");setReviewModal(null);}
  };

  /* ════════════════════════════════ RENDER ════════════════════════════════ */
  // If mobile preview is on, render desktop UI + a floating phone-frame iframe side-by-side
  if(mobilePreview&&!isEmbedded){
    return(
      <div className="min-h-screen text-white flex" style={{backgroundColor:BG,fontFamily:"'DM Sans','Noto Sans SC',sans-serif"}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=Noto+Sans+SC:wght@400;700;900&display=swap" rel="stylesheet"/>
        {/* Left: simplified desktop with just header + toggle */}
        <div className="flex-1 flex flex-col items-center justify-center p-8" style={{backgroundColor:"#0a0a0a"}}>
          <div className="max-w-md text-center">
            <div className="text-5xl font-black mb-3" style={{color:ACCENT}}>📱</div>
            <div className="text-sm font-black mb-2 text-white">移动端预览模式</div>
            <div className="text-[12px] mb-6" style={{color:"#666"}}>
              右侧是真实 393×852 viewport 渲染（iframe 加载），所有响应式断点正常触发，可以直接交互。
            </div>
            <button onClick={()=>setMobilePreview(false)}
              className="px-6 py-3 rounded-2xl text-sm font-black transition hover:brightness-110"
              style={{backgroundColor:ACCENT,color:"black"}}>
              💻 返回桌面端
            </button>
            <div className="text-[10px] mt-6" style={{color:"#444"}}>
              💡 iframe 与桌面端共享 localStorage / IndexedDB，数据相通。<br/>
              修改后另一端需刷新才能看到。
            </div>
          </div>
        </div>
        {/* Right: phone-frame iframe */}
        <div className="flex items-center justify-center p-8" style={{backgroundColor:"#050505",borderLeft:`1px solid ${BORDER}`}}>
          <div className="relative" style={{
            width:"393px",height:"852px",
            borderRadius:"55px",
            border:"14px solid #1a1a1a",
            backgroundColor:BG,
            boxShadow:"0 30px 80px rgba(0,0,0,0.6), 0 0 0 2px #2a2a2a, inset 0 0 0 1px #333",
            overflow:"hidden",
          }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-[60] flex items-center justify-center" style={{width:"120px",height:"34px",backgroundColor:"#000",borderRadius:"0 0 22px 22px"}}>
              <div className="w-3 h-3 rounded-full" style={{backgroundColor:"#1a1a1a"}}/>
            </div>
            <iframe src="/?embedded=1" title="移动端预览"
              style={{width:"100%",height:"100%",border:"none",borderRadius:"40px",backgroundColor:BG}}/>
          </div>
        </div>
      </div>
    );
  }
  return(
    <div className="min-h-screen text-white" style={{backgroundColor:BG,fontFamily:"'DM Sans','Noto Sans SC',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=Noto+Sans+SC:wght@400;700;900&display=swap" rel="stylesheet"/>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl" style={{backgroundColor:`${BG}ee`,borderBottom:`1px solid ${BORDER}`,paddingTop:"env(safe-area-inset-top)"}}>
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between gap-1">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-black text-[10px]" style={{backgroundColor:ACCENT,color:"black"}}>XHS</div>
            <div className="hidden sm:block">
              <span className="text-white font-black text-sm tracking-tight">小红书运营</span>
              <span className="font-black text-xs ml-2 uppercase tracking-widest" style={{color:"#444"}}>Dashboard</span>
            </div>
            {/* Mobile: show current tab name instead of all tabs */}
            <span className="sm:hidden text-white font-black text-xs">{NAV.find(n=>n.id===tab)?.label}</span>
          </div>
          {/* Desktop nav (hidden on mobile — bottom nav takes over) */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>switchTab(n.id)}
                className="px-4 py-2 rounded-xl text-[11px] font-black tracking-widest transition-all duration-150"
                style={{backgroundColor:tab===n.id?ACCENT:"transparent",color:tab===n.id?"black":"#555"}}>
                {n.en}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1 shrink-0">
            {user&&(
              <div className="hidden sm:flex items-center gap-2 mr-2 px-2 py-1 rounded-lg text-[10px]" style={{backgroundColor:"rgba(255,255,255,0.04)",border:`1px solid ${BORDER}`,color:"#888"}}>
                <span style={{color:ACCENT}}>●</span>
                <span className="font-bold max-w-[140px] truncate">{user.email}</span>
              </div>
            )}
            {onLogout&&(
              <button onClick={()=>{if(confirm("退出登录？"))onLogout();}}
                title={user?`已登录 ${user.email} · 点击退出`:"退出登录"}
                className="hidden sm:flex h-8 px-2 rounded-xl items-center justify-center text-[10px] font-black transition-all hover:brightness-110"
                style={{backgroundColor:"rgba(255,255,255,0.06)",border:`1px solid ${BORDER}`,color:"#888"}}>
                退出
              </button>
            )}
            <button onClick={()=>{addTopic();}}
              title="快速新建笔记"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl flex items-center justify-center text-base sm:text-lg font-black transition-all hover:brightness-110"
              style={{backgroundColor:ACCENT,color:"black"}}>＋</button>
            <button onClick={async()=>{
              if(!confirm("⚠ 重置所有数据为初始种子？\n\n这会清除你账号下所有云端笔记、评论模板、AI 报告 + 本地图片缓存，恢复到示例数据状态。此操作不可撤销。"))return;
              try{
                // 1. Wipe cloud data (your user's rows only, RLS-protected)
                if(userId){
                  await supabase.from('topics').delete().eq('user_id',userId);
                  await supabase.from('comments').delete().eq('user_id',userId);
                  await supabase.from('pattern_reports').delete().eq('user_id',userId);
                }
                // 2. Clear local cache
                localStorage.removeItem("xhs_topics_v1");
                localStorage.removeItem("xhs_comments_v1");
                localStorage.removeItem("xhs_cal_notes_v1");
                localStorage.removeItem("xhs_pattern_ai_v1");
                if(userId)localStorage.removeItem(`xhs_seeded_${userId}`);
                // 3. Clear IndexedDB images
                const idb=await openImgDB();
                const tx=idb.transaction(IDB_STORE,"readwrite");
                tx.objectStore(IDB_STORE).clear();
                tx.oncomplete=()=>window.location.reload();
              }catch(e){alert("重置失败："+e.message);}
            }}
              title="重置为初始数据"
              className="hidden sm:flex h-8 px-2 rounded-xl items-center justify-center text-[10px] font-black transition-all hover:brightness-110"
              style={{backgroundColor:"rgba(127,29,29,0.3)",color:"#fca5a5",border:"1px solid rgba(127,29,29,0.4)"}}>🔄 重置</button>
            {!isEmbedded&&(
              <button onClick={()=>setMobilePreview(v=>!v)}
                title={mobilePreview?"退出移动端预览":"打开移动端预览（iframe 加载 393px viewport，响应式真实生效）"}
                className="hidden sm:flex h-8 px-2 rounded-xl items-center justify-center text-[10px] font-black transition-all hover:brightness-110"
                style={{backgroundColor:mobilePreview?ACCENT:"rgba(255,255,255,0.06)",color:mobilePreview?"black":"#888",border:`1px solid ${mobilePreview?ACCENT:BORDER}`}}>
                {mobilePreview?"💻 退出":"📱 移动预览"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 sm:space-y-6 pb-24" style={{paddingBottom:"calc(env(safe-area-inset-bottom) + 96px)"}}>
        {/* Cloud loading indicator */}
        {userId&&!cloudReady&&(
          <div className="rounded-xl px-3 py-2 text-[11px] font-black flex items-center gap-2"
            style={{backgroundColor:"rgba(200,255,0,0.06)",border:`1px solid ${ACCENT}33`,color:ACCENT}}>
            <span className="animate-pulse">●</span> 正在从云端加载数据…
          </div>
        )}
        {/* Migration success banner (one-time) */}
        {migrationInfo&&(migrationInfo.migratedTopics>0||migrationInfo.migratedComments>0)&&(
          <div className="rounded-xl px-3 py-2 text-[11px] font-black flex items-center justify-between"
            style={{backgroundColor:"rgba(200,255,0,0.08)",border:`1px solid ${ACCENT}66`,color:ACCENT}}>
            <span>✓ 已迁移本地数据到云端：{migrationInfo.migratedTopics} 篇笔记 · {migrationInfo.migratedComments} 条话术</span>
            <button onClick={()=>setMigrationInfo(null)} style={{color:ACCENT}}>✕</button>
          </div>
        )}
        {/* Persist error banner */}
        {persistError&&(
          <div className="rounded-xl px-3 py-2 text-[11px] font-black flex items-center justify-between"
            style={{backgroundColor:"rgba(120,53,15,0.25)",border:"1px solid rgba(251,146,60,0.3)",color:"#fcd34d"}}>
            <span>{persistError}</span>
            <button onClick={()=>setPersistError("")} style={{color:"#fcd34d"}}>✕</button>
          </div>
        )}

        {/* PAGE TITLE */}
        <div className="mb-2">
          <div className="flex items-end gap-4">
            <h1 className="text-4xl sm:text-6xl font-black text-white leading-none tracking-tight">{NAV.find(n=>n.id===tab)?.en}</h1>
            <span className="font-black text-lg mb-1" style={{color:"#333"}}>{NAV.find(n=>n.id===tab)?.label}</span>
          </div>
          <div className="w-12 h-1 rounded-full mt-3" style={{backgroundColor:ACCENT}}/>
        </div>

        {/* ══════════════════════════ BOARD ══════════════════════════════ */}
        {tab==="board"&&(
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricBox label="本周进度" value={`${published}/${weeklyTarget}`} sub={`${progress}%`}/>
              <MetricBox label="累计浏览" value={reviewNotes.filter(n=>n.status==="已发布").reduce((a,n)=>{const l=n.snapshots[n.snapshots.length-1];return a+(l?.views||0);},0).toLocaleString()} sub="已发布笔记"/>
              <MetricBox label="累计收藏" value={reviewNotes.filter(n=>n.status==="已发布").reduce((a,n)=>{const l=n.snapshots[n.snapshots.length-1];return a+(l?.collects||0);},0)} sub="干货价值"/>
              <MetricBox label="新增关注" value={reviewNotes.filter(n=>n.status==="已发布").reduce((a,n)=>a+n.snapshots.reduce((b,s)=>b+(s.newFollowers||0),0),0)} sub="人设验证"/>
            </div>
            <div className="rounded-2xl p-4" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black" style={{color:"#888"}}>本周发布目标</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{color:"#555"}}>目标</span>
                  <input type="number" min={1} value={weeklyTarget} onChange={e=>setWeeklyTarget(Math.max(1,+e.target.value||1))}
                    className="w-14 rounded-lg px-2 py-1 text-xs text-white text-center outline-none"
                    style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a"}}/>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{backgroundColor:"#1a1a1a"}}>
                <div className="h-full rounded-full transition-all duration-500" style={{width:`${progress}%`,backgroundColor:ACCENT}}/>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input placeholder="搜索选题..." value={search} onChange={e=>setSearch(e.target.value)} className="flex-1"/>
              <div className="flex flex-wrap gap-1.5">{PILLARS.map(p=><Pill key={p} active={pillarFilter===p} onClick={()=>setPillarFilter(p)}>{p}</Pill>)}</div>
            </div>
            {/* Status filter row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black tracking-widest" style={{color:"#444"}}>状态</span>
              <Pill active={statusFilter==="全部"} onClick={()=>setStatusFilter("全部")}>全部</Pill>
              {STATUSES.map(s=>(
                <Pill key={s} active={statusFilter===s} onClick={()=>setStatusFilter(s)}>{s}</Pill>
              ))}
            </div>
            {/* Filter indicator */}
            {(pillarFilter!=="全部"||statusFilter!=="全部"||search.trim())&&(
              <div className="rounded-xl px-3 py-2 flex items-center justify-between"
                style={{backgroundColor:"rgba(200,255,0,0.06)",border:`1px solid rgba(200,255,0,0.2)`}}>
                <div className="flex items-center gap-2 text-[11px] flex-wrap">
                  <span className="font-black" style={{color:ACCENT}}>🔍 筛选中</span>
                  <span style={{color:"#888"}}>显示 <span className="font-black" style={{color:"white"}}>{filtered.length}</span> / {topics.length} 条</span>
                  {pillarFilter!=="全部"&&<Badge style={{backgroundColor:"rgba(200,255,0,0.15)",color:ACCENT}}>支柱：{pillarFilter}</Badge>}
                  {statusFilter!=="全部"&&<Badge style={{backgroundColor:"rgba(200,255,0,0.15)",color:ACCENT}}>状态：{statusFilter}</Badge>}
                  {search.trim()&&<Badge style={{backgroundColor:"rgba(200,255,0,0.15)",color:ACCENT}}>搜索："{search.trim()}"</Badge>}
                </div>
                <button onClick={()=>{setPillarFilter("全部");setStatusFilter("全部");setSearch("");}}
                  className="text-[10px] font-black px-2.5 py-1 rounded-lg transition hover:brightness-110"
                  style={{backgroundColor:ACCENT,color:"black"}}>✕ 清空筛选</button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map(t=>(
                <div key={t.id} className="rounded-2xl p-5 cursor-pointer transition-all duration-150 group"
                  style={{backgroundColor:CARD,border:`1px solid ${selected?.id===t.id?ACCENT:BORDER}`}}
                  onClick={()=>openEditor(t)}>
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="shrink-0 rounded-lg overflow-hidden relative" style={{width:"44px",height:"58px",backgroundColor:"#1a1a1a",border:`1px solid ${BORDER}`}}>
                      {t.images?.[0]?(
                        <img src={t.images[0].dataUrl} alt="" className="w-full h-full object-cover"/>
                      ):t.noteType==="image"&&t.status==="已发布"?(
                        <div className="w-full h-full flex flex-col items-center justify-center" style={{color:"#444"}}>
                          <div className="text-sm">📷</div>
                          <div className="text-[7px] mt-0.5 font-black" style={{color:"#fcd34d"}}>缺图</div>
                        </div>
                      ):(
                        <div className="w-full h-full flex items-center justify-center text-sm" style={{color:"#333"}}>{t.noteType==="video"?"🎬":"📝"}</div>
                      )}
                      {t.images?.length>1&&(
                        <div className="absolute bottom-0.5 right-0.5 px-1 rounded text-[8px] font-black"
                          style={{backgroundColor:"rgba(0,0,0,0.7)",color:"white"}}>×{t.images.length}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-lime-400 transition">{t.title}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge style={{backgroundColor:"#1e1e1e",color:"#888"}}>{t.pillar}</Badge>
                        <Badge style={{backgroundColor:"#1e1e1e",color:"#888"}}>{t.goal}</Badge>
                        <span title={t.scoredAt?`AI 评分 · ${new Date(t.scoredAt).toLocaleString("zh-CN")}`:"AI 评分（mock 数据 · 去 Editor → 📊 评分 跑真实分数）"}>
                          <Badge style={{backgroundColor:t.scoredAt?"rgba(200,255,0,0.12)":"#1e1e1e",color:t.scoredAt?ACCENT:"#666"}}>
                            {t.scoredAt?"AI":"AI?"} {t.score}
                          </Badge>
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={t.status}/>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px]" style={{color:"#444"}}>{t.tag}</span>
                    <div className="flex gap-1">
                      <select value={t.status} onClick={e=>e.stopPropagation()}
                        onChange={e=>{e.stopPropagation();updateTopicStatus(t.id,e.target.value);}}
                        className="rounded-lg px-2 py-1 text-[10px] outline-none"
                        style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888"}}>
                        {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={e=>{e.stopPropagation();deleteTopic(t.id);}}
                        className="text-[10px] px-2 py-1 hover:text-red-400 transition" style={{color:"#333"}}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Btn accent onClick={addTopic} className="w-full">＋ 新建选题</Btn>
          </>
        )}

        {/* ══════════════════════════ EDITOR ══════════════════════════════ */}
        {tab==="editor"&&(
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── LEFT: writing area ── */}
            <div className="space-y-4">
              {/* Sticky save bar */}
              {selected&&(
                <div className="sticky top-12 sm:top-14 z-30 rounded-2xl p-3 flex items-center justify-between gap-2"
                  style={{
                    backgroundColor:draftDirty?"rgba(245,158,11,0.12)":"rgba(200,255,0,0.06)",
                    border:`1px solid ${draftDirty?"rgba(245,158,11,0.4)":`${ACCENT}33`}`,
                    backdropFilter:"blur(10px)",
                  }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-black" style={{color:draftDirty?"#f59e0b":ACCENT}}>
                      {draftDirty?"● 未保存":"✓ 已保存"}
                    </span>
                    <span className="text-[10px] truncate" style={{color:"#666"}}>
                      {selected.title||"未命名笔记"}
                    </span>
                  </div>
                  <button onClick={saveDraftToTopic} disabled={!draftDirty}
                    className="text-[11px] font-black px-3 py-1.5 rounded-lg transition disabled:opacity-40 hover:brightness-110 shrink-0"
                    style={{backgroundColor:draftDirty?ACCENT:"rgba(255,255,255,0.06)",color:draftDirty?"black":"#555"}}>
                    💾 保存到笔记
                  </button>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest" style={{color:"#555"}}>标题</label>
                <Input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="输入标题..."/>
                <div className="text-[10px]" style={{color:titleLen>=8&&titleLen<=18&&hasConflict(draft.title)?ACCENT:"#f59e0b"}}>
                  {titleLen}字 · 建议8-18字 + 冲突词
                </div>
                <Btn small onClick={()=>{setSuggestions(titleSuggestions(draft.title||selected?.title));setAiMsg("已生成冲突标题候选。");}}>生成冲突标题</Btn>
              </div>
              {suggestions.length>0&&(
                <div className="rounded-2xl p-3 space-y-1.5" style={{backgroundColor:"#111",border:`1px solid ${BORDER}`}}>
                  <div className="text-[10px] font-black mb-2" style={{color:"#555"}}>标题候选（点击替换）</div>
                  {suggestions.map(s=>(
                    <button key={s} onClick={()=>{setDraft({...draft,title:s,cover:generateCover(s)});setAiMsg("已替换标题。");}}
                      className="block w-full text-left px-3 py-2 rounded-lg text-xs transition" style={{color:"#aaa"}}>{s}</button>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest" style={{color:"#555"}}>正文</label>
                <Textarea rows={10} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} placeholder="写正文..."/>
                <div className="text-[10px]" style={{color:"#555"}}>{bodyLen}字 · 建议≤1000字</div>
                <div className="flex flex-wrap gap-1.5">
                  <Btn small onClick={()=>{setDraft({...draft,body:generateBody(draft.title)});setAiMsg("已生成正文草稿。");}}>生成草稿</Btn>
                  <Btn small onClick={()=>{setDraft({...draft,body:compressBody(draft.body)});setAiMsg("已压缩。");}}>压缩</Btn>
                  <Btn small onClick={()=>{setDraft({...draft,body:addEmotion(draft.body)});setAiMsg("已增强情绪开头。");}}>加情绪</Btn>
                  <Btn small onClick={()=>{setDraft({...draft,body:addEnding(draft.body)});setAiMsg("已加互动结尾。");}}>加互动</Btn>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest" style={{color:"#555"}}>封面大字</label>
                <Input value={draft.cover} onChange={e=>setDraft({...draft,cover:e.target.value})}/>
                <Btn small onClick={()=>{setDraft({...draft,cover:generateCover(draft.title)});setAiMsg("已生成封面文案。");}}>AI封面文案</Btn>
              </div>
            </div>

            {/* ── RIGHT: tabs (check | chat) ── */}
            <div className="flex flex-col gap-3">
              {/* Tab switcher */}
              <div className="grid grid-cols-4 rounded-2xl p-1 gap-0.5 sm:gap-1" style={{backgroundColor:"#111",border:`1px solid ${BORDER}`}}>
                {[{id:"check",label:"📋 检查"},{id:"chat",label:"💬 对话"},{id:"cover",label:"🎨 封面"},{id:"score",label:"📊 评分"}].map(t=>(
                  <button key={t.id} onClick={()=>setEditorPanel(t.id)}
                    className="py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-black tracking-wide transition-all whitespace-nowrap"
                    style={{backgroundColor:editorPanel===t.id?ACCENT:"transparent",color:editorPanel===t.id?"black":"#555"}}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── CHECK panel ── */}
              {editorPanel==="check"&&(
                <div className="space-y-4">
                  <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black">发布前检查</span>
                      <Badge style={allPass?{backgroundColor:ACCENT,color:"black"}:{backgroundColor:"rgba(127,29,29,0.4)",color:"#fca5a5"}}>
                        {allPass?"可发布":"未完成"}
                      </Badge>
                    </div>
                    {checklist.map(c=><Check key={c.label} ok={c.ok} label={c.label}/>)}
                  </div>
                  <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${BORDER}`}}>
                    <div className="px-3 py-2.5 flex items-center justify-between" style={{backgroundColor:CARD}}>
                      <span className="text-[10px] font-black tracking-widest" style={{color:"#555"}}>封面预览</span>
                      <button onClick={downloadCover}
                        className="flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black transition hover:brightness-110"
                        style={{backgroundColor:ACCENT,color:"black"}}>↓ 下载{coverBgUrl&&coverBgUrl.startsWith("data:image/svg+xml")?" SVG":" PNG"}</button>
                    </div>
                    <div className="relative flex flex-col justify-center overflow-hidden"
                      style={{background:"linear-gradient(135deg,#1a1520 0%,#201a28 50%,#1a1520 100%)",aspectRatio:"3/4"}}>
                      {coverBgUrl?(
                        /* SVG / image cover — show full, no text overlay */
                        <img src={coverBgUrl} alt="AI封面" className="absolute inset-0 w-full h-full object-cover"/>
                      ):(
                        /* Default text preview */
                        <div className="px-8 relative">
                          <div className="absolute top-4 left-8 text-[10px] font-black" style={{color:"#444"}}>30+ 人生草稿</div>
                          <div className="text-3xl sm:text-4xl font-black leading-tight whitespace-pre-line mt-8" style={{color:"#f0ebe6"}}>{draft.cover||"封面大字"}</div>
                          <div className="absolute bottom-4 right-8 text-[10px] font-black" style={{color:ACCENT}}>@Shreya</div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Image gallery (per-note storage) */}
                  {selected&&(
                    <div className="rounded-2xl p-4 transition" style={{
                        backgroundColor:imgDragOver?"rgba(200,255,0,0.04)":CARD,
                        border:`1px solid ${imgDragOver?ACCENT:BORDER}`,
                      }}
                      onDragOver={handleImgDragOver}
                      onDragLeave={handleImgDragLeave}
                      onDrop={(e)=>handleImgDrop(selected.id,e)}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black">📷 笔记图片 ({(selected.images||[]).length}/18) {imgSaving&&<span className="ml-2 text-[9px]" style={{color:ACCENT}}>💾 保存中…</span>}</span>
                        <input type="file" ref={noteImgFileRef} accept="image/*" multiple className="hidden"
                          onChange={e=>{if(e.target.files?.length)addNoteImages(selected.id,e.target.files);e.target.value="";}}/>
                        <Btn small accent onClick={()=>noteImgFileRef.current?.click()} disabled={imgSaving}>+ 上传</Btn>
                      </div>
                      {(selected.images||[]).length>0?(
                        <div className="grid grid-cols-3 gap-1.5">
                          {selected.images.map((img,idx)=>(
                            <div key={img.id} className="relative group rounded-lg overflow-hidden"
                              style={{aspectRatio:"3/4",border:idx===0?`2px solid ${ACCENT}`:`1px solid ${BORDER}`}}>
                              <img src={img.dataUrl} alt=""
                                onClick={()=>setImgLightbox({images:selected.images,index:idx})}
                                className="w-full h-full object-cover cursor-zoom-in"/>
                              {idx===0&&<div className="absolute top-0.5 left-0.5 px-1 rounded text-[8px] font-black" style={{backgroundColor:ACCENT,color:"black"}}>封面</div>}
                              {/* Always-visible delete button (top-right) */}
                              <button onClick={(e)=>{e.stopPropagation();if(confirm(`确认删除第 ${idx+1} 张图片？`))removeNoteImage(selected.id,img.id);}}
                                title="删除这张图片"
                                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black transition hover:brightness-110"
                                style={{backgroundColor:"rgba(0,0,0,0.7)",color:"#fca5a5",border:"1px solid rgba(252,165,165,0.4)"}}>✕</button>
                              <div className="absolute inset-x-0 bottom-0 p-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition"
                                style={{background:"linear-gradient(to top,rgba(0,0,0,0.85),transparent)"}}>
                                <button onClick={(e)=>{e.stopPropagation();moveNoteImage(selected.id,img.id,"up");}} disabled={idx===0}
                                  className="flex-1 py-0.5 rounded text-[9px] font-black transition disabled:opacity-30"
                                  style={{backgroundColor:"rgba(255,255,255,0.15)",color:"white"}}>↑</button>
                                <button onClick={(e)=>{e.stopPropagation();moveNoteImage(selected.id,img.id,"down");}} disabled={idx===selected.images.length-1}
                                  className="flex-1 py-0.5 rounded text-[9px] font-black transition disabled:opacity-30"
                                  style={{backgroundColor:"rgba(255,255,255,0.15)",color:"white"}}>↓</button>
                                <button onClick={(e)=>{e.stopPropagation();if(confirm("删除？"))removeNoteImage(selected.id,img.id);}}
                                  className="flex-1 py-0.5 rounded text-[9px] font-black transition"
                                  style={{backgroundColor:"rgba(127,29,29,0.6)",color:"#fca5a5"}}>✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ):(
                        <div onClick={()=>noteImgFileRef.current?.click()}
                          className="rounded-xl py-6 flex flex-col items-center justify-center cursor-pointer transition"
                          style={{
                            backgroundColor:imgDragOver?"rgba(200,255,0,0.08)":"rgba(255,255,255,0.02)",
                            border:`2px dashed ${imgDragOver?ACCENT:BORDER}`,
                          }}>
                          <div className="text-2xl mb-1">{imgDragOver?"📥":"📷"}</div>
                          <div className="text-[10px] font-black" style={{color:imgDragOver?ACCENT:"#888"}}>
                            {imgDragOver?"松开上传":"点击或拖拽图片到这里"}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selected&&(
                    <div className="rounded-2xl p-4" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                      <div className="text-[10px] font-black mb-2" style={{color:"#555"}}>更新状态</div>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map(s=>(
                          <Btn key={s} small accent={selected.status===s}
                            onClick={()=>{
                              if(s==="已发布"&&selected.noteType==="image"&&(!selected.images||selected.images.length===0)){
                                if(!confirm("⚠ 这是图文笔记但还没有图片，确定要标记为已发布吗？"))return;
                              }
                              updateTopicStatus(selected.id,s);setSelected({...selected,status:s});
                            }}>
                            {s}
                          </Btn>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── AI CHAT panel ── */}
              {editorPanel==="chat"&&(
                <div className="flex flex-col rounded-2xl overflow-hidden" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`,minHeight:"520px"}}>
                  {/* API Key setup — shown when active provider has no key */}
                  {!activeKey?(
                    <div className="flex flex-col items-center justify-center flex-1 p-6 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-black text-white mb-1">接入 AI</div>
                        <div className="text-[11px]" style={{color:"#555"}}>选择模型，输入 API Key 开始对话</div>
                      </div>
                      {/* Provider selector */}
                      <div className="flex w-full rounded-xl p-1 gap-1" style={{backgroundColor:"#1a1a1a"}}>
                        {[{id:"claude",label:"Claude",sub:"Anthropic"},{id:"openai",label:"ChatGPT",sub:"OpenAI"},{id:"gemini",label:"Gemini",sub:"Google"}].map(p=>(
                          <button key={p.id} onClick={()=>setSetupProvider(p.id)}
                            className="flex-1 py-2.5 rounded-lg text-[11px] font-black transition-all"
                            style={{backgroundColor:setupProvider===p.id?ACCENT:"transparent",color:setupProvider===p.id?"black":"#555"}}>
                            {p.label}<span className="block text-[9px] font-bold opacity-60">{p.sub}</span>
                          </button>
                        ))}
                      </div>
                      <div className="w-full space-y-2">
                        <input
                          type="password"
                          placeholder={setupProvider==="claude"?"sk-ant-api03-...":setupProvider==="openai"?"sk-proj-...":"AIza..."}
                          value={keyDraft}
                          onChange={e=>setKeyDraft(e.target.value)}
                          onKeyDown={e=>e.key==="Enter"&&saveKey()}
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none font-mono"
                          style={{backgroundColor:"#1a1a1a",border:`1px solid ${BORDER}`,color:"white"}}/>
                        <button onClick={saveKey}
                          className="w-full py-3 rounded-xl text-sm font-black transition"
                          style={{backgroundColor:ACCENT,color:"black"}}>
                          保存 &amp; 开始对话
                        </button>
                        {/* Quick-switch to already-saved providers */}
                        <div className="flex gap-2">
                          {setupProvider!=="claude"&&claudeKey&&<button onClick={()=>switchProvider("claude")} className="flex-1 py-2 rounded-xl text-[10px] font-black transition" style={{backgroundColor:"rgba(255,255,255,0.04)",color:"#555"}}>用 Claude Key →</button>}
                          {setupProvider!=="openai"&&openaiKey&&<button onClick={()=>switchProvider("openai")} className="flex-1 py-2 rounded-xl text-[10px] font-black transition" style={{backgroundColor:"rgba(255,255,255,0.04)",color:"#555"}}>用 GPT Key →</button>}
                          {setupProvider!=="gemini"&&geminiKey&&<button onClick={()=>switchProvider("gemini")} className="flex-1 py-2 rounded-xl text-[10px] font-black transition" style={{backgroundColor:"rgba(255,255,255,0.04)",color:"#555"}}>用 Gemini Key →</button>}
                        </div>
                      </div>
                      <div className="text-[10px] text-center" style={{color:"#333"}}>Key 仅存储在本地 localStorage，不会上传</div>
                    </div>
                  ):(
                    <>
                      {/* Chat header */}
                      <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:`1px solid ${BORDER}`}}>
                        {/* Provider toggle pills */}
                        <div className="flex items-center gap-1.5">
                          {[{id:"claude",label:"Claude",has:!!claudeKey},{id:"openai",label:"GPT-4o",has:!!openaiKey},{id:"gemini",label:"Gemini",has:!!geminiKey}].map(p=>(
                            <button key={p.id}
                              onClick={()=>p.has?switchProvider(p.id):setSetupProvider(p.id)}
                              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black transition"
                              style={{
                                backgroundColor:aiProvider===p.id?ACCENT:"rgba(255,255,255,0.06)",
                                color:aiProvider===p.id?"black":p.has?"rgba(255,255,255,0.5)":"#333",
                                outline:!p.has?"1px dashed #333":"none",
                              }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{backgroundColor:aiProvider===p.id?"black":p.has?"#C8FF00":"#444"}}/>
                              {p.has?p.label:`+ ${p.id==="claude"?"Claude":p.id==="openai"?"GPT":"Gemini"}`}
                            </button>
                          ))}
                          <span className="text-[9px] ml-1" style={{color:"#333"}}>草稿已同步</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {chatMsgs.length>0&&(
                            <button onClick={()=>setChatMsgs([])}
                              className="text-[10px] font-black transition hover:opacity-70" style={{color:"#444"}}>清空</button>
                          )}
                          <button onClick={()=>clearKey(aiProvider)}
                            className="text-[10px] font-black transition hover:text-red-400" style={{color:"#333"}}>删除Key</button>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{maxHeight:"380px"}}>
                        {chatMsgs.length===0&&(
                          <div className="space-y-2 pt-2">
                            <div className="text-[11px] font-black" style={{color:"#444"}}>你好！我已经看到你的草稿了，可以直接跟我说：</div>
                            {["帮我把标题改得更有冲突感","正文太长了，帮我压缩到500字以内","封面文案太平，帮我改得更有力量感","分析一下这篇笔记哪里还可以提升"].map(q=>(
                              <button key={q} onClick={()=>{setChatInput(q);}}
                                className="block w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-bold transition"
                                style={{backgroundColor:"rgba(255,255,255,0.04)",border:`1px solid ${BORDER}`,color:"rgba(255,255,255,0.5)"}}>
                                {q}
                              </button>
                            ))}
                          </div>
                        )}
                        {chatMsgs.map((msg,i)=>{
                          const isUser=msg.role==="user";
                          const isSys=msg._sys;
                          const blocks=(!isUser&&!isSys)?parseApplyBlocks(msg.content):[];
                          // strip apply-block tags from display text
                          const displayText=msg.content.replace(/【(标题|正文|封面)】[\s\S]*?【\/\1】/g,"").trim();
                          return(
                            <div key={i} className={`flex flex-col ${isUser?"items-end":"items-start"}`}>
                              <div className="max-w-[85%] rounded-2xl px-4 py-3 text-[12px] leading-relaxed whitespace-pre-wrap"
                                style={{
                                  backgroundColor:isSys?"rgba(200,255,0,0.08)":isUser?"rgba(200,255,0,0.18)":"rgba(255,255,255,0.06)",
                                  color:isSys?ACCENT:isUser?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.82)",
                                  borderRadius:isUser?"18px 18px 4px 18px":"18px 18px 18px 4px",
                                }}>
                                {displayText||<span style={{opacity:0.4}}>…</span>}
                              </div>
                              {/* Apply buttons */}
                              {blocks.length>0&&(
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {blocks.map(block=>(
                                    <button key={block.type} onClick={()=>applyBlock(block)}
                                      className="flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black transition hover:brightness-110"
                                      style={{backgroundColor:ACCENT,color:"black"}}>
                                      ✓ 应用{block.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {chatLoading&&(
                          <div className="flex items-start">
                            <div className="rounded-2xl px-4 py-3 text-[13px]" style={{backgroundColor:"rgba(255,255,255,0.06)",color:"#555",borderRadius:"18px 18px 18px 4px"}}>
                              <span className="inline-flex gap-1">
                                <span className="animate-bounce" style={{animationDelay:"0ms"}}>·</span>
                                <span className="animate-bounce" style={{animationDelay:"120ms"}}>·</span>
                                <span className="animate-bounce" style={{animationDelay:"240ms"}}>·</span>
                              </span>
                            </div>
                          </div>
                        )}
                        {chatError&&(
                          <div className="rounded-xl px-3 py-2 text-[11px]" style={{backgroundColor:"rgba(127,29,29,0.4)",color:"#fca5a5"}}>
                            ⚠ {chatError}
                          </div>
                        )}
                        <div ref={chatEndRef}/>
                      </div>

                      {/* Input */}
                      <div className="p-3" style={{borderTop:`1px solid ${BORDER}`}}>
                        <div className="flex gap-2">
                          <textarea
                            rows={2}
                            placeholder="跟 AI 说说你想怎么改这篇笔记..."
                            value={chatInput}
                            onChange={e=>setChatInput(e.target.value)}
                            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAiChat();}}}
                            className="flex-1 rounded-xl px-3 py-2 text-xs outline-none resize-none"
                            style={{backgroundColor:"#1a1a1a",border:`1px solid ${BORDER}`,color:"white",lineHeight:"1.5"}}/>
                          <button onClick={sendAiChat} disabled={chatLoading||!chatInput.trim()}
                            className="rounded-xl px-4 font-black text-[11px] transition disabled:opacity-30"
                            style={{backgroundColor:ACCENT,color:"black",minWidth:"52px"}}>
                            {chatLoading?"…":"发送"}
                          </button>
                        </div>
                        <div className="mt-1.5 text-[9px]" style={{color:"#333"}}>Enter 发送 · Shift+Enter 换行 · 草稿修改后自动同步给 AI</div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── SCORE panel ── */}
              {editorPanel==="score"&&(
                <div className="flex flex-col rounded-2xl overflow-hidden" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`,minHeight:"520px"}}>
                  <ScorePanel
                    result={scoreResult}
                    loading={scoreLoading}
                    error={scoreError}
                    hasKey={!!activeKey}
                    onScore={scoreNote}
                    onApply={applyBlock}
                    onSaveScore={selected?saveScoreToNote:null}
                    scoreSavedAt={selected?.scoredAt}
                  />
                </div>
              )}

              {/* ── COVER DESIGN panel ── */}
              {editorPanel==="cover"&&(
                <div className="flex flex-col rounded-2xl overflow-hidden" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`,minHeight:"560px"}}>
                  {/* Header */}
                  <div className="px-4 py-3 flex items-center justify-between" style={{borderBottom:`1px solid ${BORDER}`}}>
                    <div>
                      <span className="text-xs font-black text-white">🎨 封面设计 AI</span>
                      <span className="ml-2 text-[9px] font-bold" style={{color:"#555"}}>上传参考图 · 生成封面 · 迭代调整</span>
                    </div>
                    {coverBgUrl&&(
                      <button onClick={()=>{if(selected)setNoteCover(selected.id,null);else setCoverBgUrl("");}}
                        className="text-[10px] font-black px-2 py-1 rounded-lg transition hover:opacity-70"
                        style={{backgroundColor:"rgba(127,29,29,0.3)",color:"#fca5a5"}}>✕ 移除封面图</button>
                    )}
                  </div>

                  {/* Chat messages */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{minHeight:0,maxHeight:"360px"}}>
                    {coverMsgs.length===0&&(
                      <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-3">
                        <div className="text-3xl">🎨</div>
                        <div className="text-sm font-black text-white">AI 封面设计助手</div>
                        <div className="text-[11px] leading-relaxed max-w-[220px]" style={{color:"#555"}}>
                          描述封面风格、上传参考图，或直接点「生成封面图」
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 w-full mt-1">
                          {["帮我设计一个暗色调、大字冲击感的封面","我想要类似杂志封面的风格","参考我上传的图，帮我设计同风格"].map(s=>(
                            <button key={s} onClick={()=>setCoverInput(s)}
                              className="text-left px-3 py-2 rounded-xl text-[11px] font-bold transition hover:opacity-80"
                              style={{backgroundColor:"rgba(255,255,255,0.04)",border:`1px solid ${BORDER}`,color:"rgba(255,255,255,0.5)"}}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {coverMsgs.map((m,i)=>(
                      <div key={i} className={`flex gap-2 ${m.role==="user"?"justify-end":""}`}>
                        {m.role==="assistant"&&(
                          <div className="h-6 w-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px]"
                            style={{backgroundColor:"rgba(200,255,0,0.12)",color:ACCENT}}>✦</div>
                        )}
                        <div className={`max-w-[85%] space-y-2 ${m.role==="user"?"items-end":""} flex flex-col`}>
                          {/* Reference image thumbnail */}
                          {m.refImage&&(
                            <div className="rounded-xl overflow-hidden border" style={{borderColor:BORDER,maxWidth:"120px"}}>
                              <img src={m.refImage.preview} alt="参考图" className="w-full object-cover"/>
                              <div className="px-2 py-1 text-[9px] font-bold" style={{backgroundColor:"#111",color:"#555"}}>参考图</div>
                            </div>
                          )}
                          {/* Text content */}
                          {m.content&&(
                            <div className="px-3 py-2.5 rounded-2xl text-[12px] leading-relaxed whitespace-pre-wrap"
                              style={{
                                backgroundColor:m.role==="user"?"rgba(200,255,0,0.12)":"rgba(255,255,255,0.04)",
                                color:m.role==="user"?ACCENT:"rgba(255,255,255,0.8)",
                                border:`1px solid ${m.role==="user"?"rgba(200,255,0,0.2)":BORDER}`,
                                fontStyle:m.isGenerating?"italic":"normal",
                              }}>
                              {m.content}
                            </div>
                          )}
                          {/* Generated SVG cover */}
                          {m.svgCode&&(
                            <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${ACCENT}44`}}>
                              <div className="w-full" style={{aspectRatio:"3/4",maxHeight:"320px",overflow:"hidden"}}
                                dangerouslySetInnerHTML={{__html:m.svgCode.replace(/<svg/,`<svg style="width:100%;height:100%"`)}}/>
                              <div className="px-3 py-2 flex gap-2" style={{backgroundColor:"rgba(200,255,0,0.06)"}}>
                                <button onClick={()=>{
                                  const svgDataUrl=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(m.svgCode)}`;
                                  if(selected)setNoteCover(selected.id,svgDataUrl);else setCoverBgUrl(svgDataUrl);
                                }}
                                  className="flex-1 py-1.5 rounded-xl text-[11px] font-black transition hover:brightness-110"
                                  style={{backgroundColor:ACCENT,color:"black"}}>✓ 设为封面背景</button>
                                <button onClick={()=>{
                                  const blob=new Blob([m.svgCode],{type:"image/svg+xml"});
                                  const url=URL.createObjectURL(blob);
                                  const a=document.createElement("a");a.href=url;a.download="cover.svg";a.click();URL.revokeObjectURL(url);
                                }}
                                  className="px-3 py-1.5 rounded-xl text-[11px] font-black transition hover:opacity-70"
                                  style={{backgroundColor:"rgba(255,255,255,0.06)",color:"#888"}}>↓ SVG</button>
                              </div>
                            </div>
                          )}
                          {/* Generated raster image (Gemini) */}
                          {m.imageUrl&&(
                            <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${ACCENT}44`}}>
                              <img src={m.imageUrl} alt="AI生成封面" className="w-full" style={{display:"block",aspectRatio:"3/4",objectFit:"cover"}}/>
                              <div className="px-3 py-2 flex gap-2" style={{backgroundColor:"rgba(200,255,0,0.06)"}}>
                                <button onClick={()=>{if(selected)setNoteCover(selected.id,m.imageUrl);else setCoverBgUrl(m.imageUrl);}}
                                  className="flex-1 py-1.5 rounded-xl text-[11px] font-black transition hover:brightness-110"
                                  style={{backgroundColor:ACCENT,color:"black"}}>✓ 设为封面背景</button>
                                <button onClick={()=>{
                                  const a=document.createElement("a");a.href=m.imageUrl;a.download=`cover-${Date.now()}.png`;a.click();
                                }}
                                  className="px-3 py-1.5 rounded-xl text-[11px] font-black transition hover:opacity-70"
                                  style={{backgroundColor:"rgba(255,255,255,0.06)",color:"#888"}}>↓ PNG</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(coverLoading||genImgLoading)&&(
                      <div className="flex gap-2">
                        <div className="h-6 w-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px]"
                          style={{backgroundColor:"rgba(200,255,0,0.12)",color:ACCENT}}>✦</div>
                        <div className="flex items-center gap-1 px-3 py-2 rounded-2xl" style={{backgroundColor:"rgba(255,255,255,0.04)",border:`1px solid ${BORDER}`}}>
                          {[0,120,240].map(d=><span key={d} className="text-sm animate-bounce" style={{animationDelay:`${d}ms`,color:"#444"}}>·</span>)}
                          <span className="text-[10px] ml-1" style={{color:"#555"}}>{genImgLoading?"生成中…":"思考中…"}</span>
                        </div>
                      </div>
                    )}
                    <div ref={coverChatEndRef}/>
                  </div>

                  {/* Reference image preview bar */}
                  {coverRefImg&&(
                    <div className="px-3 py-2 flex items-center gap-2" style={{borderTop:`1px solid ${BORDER}`,backgroundColor:"rgba(200,255,0,0.04)"}}>
                      <img src={coverRefImg.preview} alt="" className="h-10 w-10 rounded-lg object-cover"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-white truncate">{coverRefImg.name}</div>
                        <div className="text-[9px]" style={{color:"#555"}}>参考图已附加，发送时一并上传</div>
                      </div>
                      <button onClick={()=>setCoverRefImg(null)} className="text-[10px]" style={{color:"#444"}}>✕</button>
                    </div>
                  )}

                  {/* Input area */}
                  <div className="px-3 pb-3 pt-2 space-y-2" style={{borderTop:`1px solid ${BORDER}`}}>
                    <textarea rows={2} value={coverInput}
                      onChange={e=>setCoverInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendCoverMsg();}}}
                      placeholder="描述封面风格、颜色、内容方向… (Enter发送)"
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none leading-relaxed"
                      style={{backgroundColor:"rgba(255,255,255,0.04)",border:`1px solid ${BORDER}`,color:"white"}}/>
                    <div className="flex gap-2">
                      {/* Upload reference image */}
                      <input type="file" ref={coverFileRef} accept="image/*" onChange={handleCoverFile} className="hidden"/>
                      <button onClick={()=>coverFileRef.current?.click()}
                        title="上传参考图"
                        className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base transition hover:opacity-80"
                        style={{backgroundColor:"rgba(255,255,255,0.06)",border:`1px solid ${BORDER}`,color:"#888"}}>📎</button>
                      {/* Generate cover image */}
                      <button onClick={generateCoverImg} disabled={genImgLoading||coverLoading}
                        className="flex-1 py-2 rounded-xl text-[11px] font-black transition disabled:opacity-40"
                        style={{backgroundColor:"rgba(200,255,0,0.1)",border:`1px solid rgba(200,255,0,0.25)`,color:ACCENT}}>
                        {genImgLoading?"⏳ 生成中…":geminiKey?"🎨 生成封面图 (Gemini)":"🎨 生成 SVG 封面"}
                      </button>
                      {/* Send chat */}
                      <button onClick={sendCoverMsg} disabled={coverLoading||(!coverInput.trim()&&!coverRefImg)}
                        className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base transition disabled:opacity-40 hover:brightness-110"
                        style={{backgroundColor:ACCENT,color:"black"}}>↑</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════ CALENDAR ════════════════════════════ */}
        {tab==="calendar"&&(()=>{
          const todayStr=getTodayStr();
          const cells=buildCalendarCells(calYear,calMonth);
          // Apply type group + status filters
          const typeGroup=CAL_TYPE_GROUPS[calTypeFilter]||[];
          const filteredCalNotes=calNotes.filter(n=>{
            if(calTypeFilter!=="全部"&&!typeGroup.includes(n.type))return false;
            if(calStatusFilter==="草稿+"&&n.status!=="草稿"&&n.status!=="待写")return false;
            if(calStatusFilter!=="全部"&&calStatusFilter!=="草稿+"&&n.status!==calStatusFilter)return false;
            return true;
          });
          const byDate=groupNotesByDate(filteredCalNotes);
          const monthNotes=getMonthNotes(filteredCalNotes,calYear,calMonth);
          // Stats are based on ALL filtered notes (not just current month)
          const totalMonth=filteredCalNotes.length;
          const liveMonth=filteredCalNotes.filter(n=>n.status==="已发布").length;
          const soonMonth=filteredCalNotes.filter(n=>n.status==="待发布").length;
          const draftMonth=filteredCalNotes.filter(n=>n.status==="草稿"||n.status==="待写").length;
          const monthLabel=new Date(calYear,calMonth,1).toLocaleDateString("zh-CN",{year:"numeric",month:"long"});
          const prevMonth=()=>{if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1);};
          const nextMonth=()=>{if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1);};
          // Cross-month drag handlers
          const handleDragOverPrev=(e)=>{
            e.preventDefault();
            if(!draggingNote)return;
            if(!calDragMonthTimer.current)calDragMonthTimer.current=setTimeout(()=>{prevMonth();calDragMonthTimer.current=null;},700);
          };
          const handleDragOverNext=(e)=>{
            e.preventDefault();
            if(!draggingNote)return;
            if(!calDragMonthTimer.current)calDragMonthTimer.current=setTimeout(()=>{nextMonth();calDragMonthTimer.current=null;},700);
          };
          const handleDragLeaveNav=()=>{
            if(calDragMonthTimer.current){clearTimeout(calDragMonthTimer.current);calDragMonthTimer.current=null;}
          };
          return(
            <div className="space-y-4">
              {/* Stat cards */}
              {(()=>{
                const statScroll=(status)=>{
                  setCalStatusFilter(status);
                  setTimeout(()=>scheduleListRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),80);
                };
                return(
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <CalStatCard label="TOTAL" value={totalMonth} highlight
                      active={calStatusFilter==="全部"}
                      onClick={()=>statScroll("全部")}/>
                    <CalStatCard label="LIVE" value={liveMonth}
                      active={calStatusFilter==="已发布"}
                      onClick={()=>statScroll("已发布")}/>
                    <CalStatCard label="SOON" value={soonMonth}
                      active={calStatusFilter==="待发布"}
                      onClick={()=>statScroll("待发布")}/>
                    <CalStatCard label="DRAFT" value={draftMonth}
                      active={calStatusFilter==="草稿+"}
                      onClick={()=>statScroll("草稿+")}/>
                  </div>
                );
              })()}

              {/* Filter bar */}
              <div className="rounded-2xl p-3 space-y-2.5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                {/* Type filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-black tracking-widest shrink-0" style={{color:"#555"}}>内容支柱</span>
                  {Object.keys(CAL_TYPE_GROUPS).map(t=>(
                    <button key={t} onClick={()=>setCalTypeFilter(t)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-black transition-all"
                      style={{
                        backgroundColor:calTypeFilter===t?ACCENT:"rgba(255,255,255,0.06)",
                        color:calTypeFilter===t?"black":"rgba(255,255,255,0.45)",
                      }}>{t}</button>
                  ))}
                </div>
                {/* Status filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-black tracking-widest shrink-0" style={{color:"#555"}}>状态</span>
                  {["全部","草稿","待写","待发布","已发布"].map(s=>(
                    <button key={s} onClick={()=>setCalStatusFilter(s)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-black transition-all"
                      style={{
                        backgroundColor:calStatusFilter===s?(STATUS_DOT[s]||ACCENT):"rgba(255,255,255,0.06)",
                        color:calStatusFilter===s?(s==="已发布"?"black":"black"):"rgba(255,255,255,0.45)",
                      }}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Drag hint */}
              <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-[11px] font-bold"
                style={{backgroundColor:"rgba(200,255,0,0.06)",border:"1px solid rgba(200,255,0,0.12)",color:"rgba(200,255,0,0.7)"}}>
                <span>✦</span>
                <span>拖拽笔记到任意日期可重新排期 · 悬停在月份箭头可跨月移动</span>
              </div>

              {/* Drop feedback toast */}
              {dropFeedback&&(
                <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2 text-[12px] font-black text-black shadow-xl"
                  style={{backgroundColor:ACCENT,pointerEvents:"none"}}>
                  ✓ 已更新排期至 {dropFeedback.dateStr.slice(5).replace("-","/")}
                </div>
              )}

              {/* Main calendar card — ChatGPT-style */}
              <div className="rounded-3xl overflow-hidden" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                {/* Month header: big month name left, year·month sub, arrows right */}
                <div className="flex items-start justify-between px-6 pt-6 pb-4">
                  <div>
                    <div className="text-5xl font-black tracking-tight leading-none text-white">
                      {MONTH_NAMES[calMonth]}
                    </div>
                    <div className="text-[13px] font-black mt-1.5 tracking-widest"
                      style={{color:"rgba(255,255,255,0.3)"}}>
                      {calYear} · {String(calMonth+1).padStart(2,"0")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={prevMonth}
                      onDragOver={handleDragOverPrev}
                      onDragLeave={handleDragLeaveNav}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-base font-black transition hover:brightness-125"
                      style={{backgroundColor:draggingNote?"rgba(200,255,0,0.15)":"rgba(255,255,255,0.06)",color:draggingNote?ACCENT:"rgba(255,255,255,0.5)"}}>‹</button>
                    <button onClick={nextMonth}
                      onDragOver={handleDragOverNext}
                      onDragLeave={handleDragLeaveNav}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-base font-black transition hover:brightness-125"
                      style={{backgroundColor:draggingNote?"rgba(200,255,0,0.15)":"rgba(255,255,255,0.06)",color:draggingNote?ACCENT:"rgba(255,255,255,0.5)"}}>›</button>
                  </div>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 px-4 pb-2" style={{gap:"2px"}}>
                  {WEEKDAYS.map(d=>(
                    <div key={d} className="text-center text-[11px] font-black tracking-widest"
                      style={{color:"rgba(255,255,255,0.18)"}}>{d}</div>
                  ))}
                </div>

                {/* Day cells grid */}
                <div className="grid grid-cols-7 px-4 pb-4" style={{gap:"2px"}}>
                  {cells.map((day,i)=>{
                    const dateStr=day?formatDateKey(calYear,calMonth,day):null;
                    const notes=dateStr?(byDate[dateStr]||[]):[];
                    const isToday=dateStr===todayStr;
                    return(
                      <DayCell
                        key={i}
                        day={day}
                        dateStr={dateStr}
                        notes={notes}
                        isToday={isToday}
                        todayStr={todayStr}
                        onNoteClick={(note)=>setCalDetailNote(note)}
                        onDragStart={(e,note)=>{e.dataTransfer.setData("noteId",note.id);setDraggingNote(note);}}
                        onDrop={handleCalDrop}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Content pillar legend */}
              {(()=>{
                const GROUP_COLOR={"全部":ACCENT,"人生设计":"#DDF76A","生活实验":"#D8E8EF","探索区":"#F0D5C5"};
                const GROUP_SUB={"全部":"","人生设计":"人生重铸 · 奥德赛","生活实验":"身体重铸 · 北漂","探索区":"副业 · AI工具"};
                return(
                  <div className="rounded-2xl px-5 py-4" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                    <div className="text-[9px] font-black tracking-widest mb-3" style={{color:"rgba(255,255,255,0.25)"}}>内容支柱</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(CAL_TYPE_GROUPS).map(g=>{
                        const color=GROUP_COLOR[g]||ACCENT;
                        const active=calTypeFilter===g;
                        return(
                          <button key={g} onClick={()=>setCalTypeFilter(g)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
                            style={{
                              backgroundColor:active?`${color}22`:"rgba(255,255,255,0.03)",
                              border:`1px solid ${active?color+"55":BORDER}`,
                            }}>
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{backgroundColor:color}}/>
                            <div className="text-left">
                              <div className="text-[11px] font-black" style={{color:active?color:"rgba(255,255,255,0.6)"}}>{g}</div>
                              {GROUP_SUB[g]&&<div className="text-[9px]" style={{color:"rgba(255,255,255,0.25)"}}>{GROUP_SUB[g]}</div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Schedule list */}
              <div ref={scheduleListRef} className="rounded-2xl overflow-hidden" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:`1px solid ${BORDER}`}}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black tracking-widest" style={{color:"rgba(255,255,255,0.35)"}}>
                      {calStatusFilter==="全部"?"本月排期":calStatusFilter==="草稿+"?"草稿 & 待写":calStatusFilter} · {monthLabel}
                    </span>
                    {calStatusFilter!=="全部"&&(
                      <button onClick={()=>setCalStatusFilter("全部")}
                        className="text-[9px] font-black px-2 py-0.5 rounded-full transition hover:opacity-70"
                        style={{backgroundColor:"rgba(255,255,255,0.06)",color:"#555"}}>✕ 清除</button>
                    )}
                  </div>
                  <span className="text-[11px] font-black" style={{color:ACCENT}}>{totalMonth} 篇</span>
                </div>
                {monthNotes.length===0?(
                  <div className="px-5 py-8 text-center text-[12px]" style={{color:"rgba(255,255,255,0.2)"}}>本月暂无排期</div>
                ):(
                  <div>
                    {monthNotes.map((note,idx)=>{
                      const color=TYPE_COLOR[note.type]||ACCENT;
                      const dot=STATUS_DOT[note.status]||"#8A8E86";
                      const dispDate=getCalDisplayDate(note,todayStr);
                      return(
                        <div key={note.id}
                          className="flex items-center gap-4 px-5 py-3 transition-all cursor-pointer"
                          style={{
                            borderBottom:idx<monthNotes.length-1?`1px solid ${BORDER}`:"none",
                            backgroundColor:"transparent",
                          }}
                          draggable
                          onClick={()=>setCalDetailNote(note)}
                          onDragStart={e=>{e.dataTransfer.setData("noteId",note.id);setDraggingNote(note);}}
                          onMouseEnter={e=>e.currentTarget.style.backgroundColor="rgba(255,255,255,0.03)"}
                          onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>
                          {/* Date badge */}
                          <div className="shrink-0 w-10 text-center">
                            <div className="text-[13px] font-black text-white">{dispDate}</div>
                          </div>
                          {/* Status dot */}
                          <div className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor:dot}}/>
                          {/* Type tag */}
                          <div className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black"
                            style={{backgroundColor:`${color}22`,color}}>
                            {note.type}
                          </div>
                          {/* Title */}
                          <div className="min-w-0 flex-1 text-[12px] font-bold truncate"
                            style={{color:"rgba(255,255,255,0.75)"}}>{note.title}</div>
                          {/* Status badge */}
                          <div className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black"
                            style={statusColor(note.status)}>
                            {note.status}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cal Note Detail Modal */}
              {calDetailNote&&(
                <CalNoteModal
                  note={calDetailNote}
                  onClose={()=>setCalDetailNote(null)}
                  onUpdate={(id,patch)=>{updateCalendarNote(id,patch);setCalDetailNote(n=>({...n,...patch}));}}
                />
              )}
            </div>
          );
        })()}

        {/* ══════════════════════════ SCRIPTS ═════════════════════════════ */}
        {tab==="comments"&&(
          <div className="space-y-4">
            <div className="rounded-2xl p-5 space-y-3" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
              <span className="text-[10px] font-black tracking-widest" style={{color:"#555"}}>新增话术</span>
              <Input placeholder="场景（如：求模板、好勇敢）" value={newComment.scene} onChange={e=>setNewComment({...newComment,scene:e.target.value})}/>
              <Textarea rows={2} placeholder="回复话术" value={newComment.reply} onChange={e=>setNewComment({...newComment,reply:e.target.value})}/>
              <div className="flex items-center gap-2">
                <select value={newComment.tag} onChange={e=>setNewComment({...newComment,tag:e.target.value})}
                  className="rounded-lg px-3 py-2 text-xs outline-none" style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a",color:"#aaa"}}>
                  {["引流","人设","转化","互动"].map(t=><option key={t}>{t}</option>)}
                </select>
                <Btn accent small onClick={addCommentTemplate}>添加</Btn>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {comments.map(c=>{
                const isEditing=editingComment&&editingComment.id===c.id;
                if(isEditing) return(
                  <div key={c.id} className="rounded-2xl p-4 space-y-2" style={{backgroundColor:CARD,border:`1px solid ${ACCENT}44`}}>
                    <div className="text-[9px] font-black tracking-widest mb-1" style={{color:ACCENT}}>编辑话术</div>
                    <Input placeholder="场景" value={editingComment.scene}
                      onChange={e=>setEditingComment({...editingComment,scene:e.target.value})}/>
                    <Textarea rows={3} placeholder="回复话术" value={editingComment.reply}
                      onChange={e=>setEditingComment({...editingComment,reply:e.target.value})}/>
                    <div className="flex items-center gap-2">
                      <select value={editingComment.tag}
                        onChange={e=>setEditingComment({...editingComment,tag:e.target.value})}
                        className="rounded-lg px-3 py-2 text-xs outline-none flex-1"
                        style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a",color:"#aaa"}}>
                        {["引流","人设","转化","互动"].map(t=><option key={t}>{t}</option>)}
                      </select>
                      <Btn accent small onClick={saveEditComment}>保存</Btn>
                      <Btn small onClick={()=>setEditingComment(null)}>取消</Btn>
                    </div>
                  </div>
                );
                return(
                  <div key={c.id} className="rounded-2xl p-4" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                    <div className="flex items-center justify-between mb-2">
                      <Badge style={{backgroundColor:"#1e1e1e",color:"#888"}}>{c.tag}</Badge>
                      <div className="flex items-center gap-3">
                        <button onClick={()=>setEditingComment({...c})}
                          className="text-[10px] font-black hover:opacity-70 transition" style={{color:"#555"}}>编辑</button>
                        <button onClick={()=>deleteComment(c.id)}
                          className="text-[10px] hover:text-red-400 transition" style={{color:"#333"}}>✕</button>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-white mb-1">「{c.scene}」</div>
                    <p className="text-xs leading-relaxed" style={{color:"#888"}}>{c.reply}</p>
                    <button className="mt-2 text-[10px] font-black hover:opacity-70 transition" style={{color:ACCENT}}
                      onClick={()=>navigator.clipboard?.writeText(c.reply)}>复制话术</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════ REVIEW ══════════════════════════════ */}
        {tab==="review"&&(
          <>
            {/* ── LIST VIEW ── */}
            {reviewView==="list"&&(
              <div className="space-y-5">
                {/* Account Profile Bar — LIVE COMPUTED from reviewNotes */}
                <div className="rounded-2xl p-4" style={{backgroundColor:"#0f0f0f",border:`1px solid ${BORDER}`}}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[9px] font-black tracking-widest" style={{color:"#444"}}>
                      账号画像 · 实时计算
                      <span className="ml-2 px-1.5 py-0.5 rounded" style={{backgroundColor:"rgba(200,255,0,0.1)",color:ACCENT}}>LIVE</span>
                    </div>
                    <div className="text-[9px]" style={{color:"#444"}}>
                      样本：{accountProfile.sampleSize} 篇含快照 / {accountProfile.totalNotes} 篇已发布
                    </div>
                  </div>
                  {accountProfile.sampleSize===0?(
                    <div className="text-center py-6 text-[11px]" style={{color:"#555"}}>
                      暂无已发布笔记数据快照，录入数据后会自动计算账号画像
                    </div>
                  ):(
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {[
                          {label:"浏览中位数",value:accountProfile.medianViews.toLocaleString(),sub:"单篇最新"},
                          {label:"赞阅比基线",value:`${accountProfile.baselineLikeRate}%`,sub:"加权平均"},
                          {label:"藏阅比基线",value:`${accountProfile.baselineCollectRate}%`,sub:"加权平均"},
                          {label:"爆款率",value:`${accountProfile.hitRate}%`,sub:`${accountProfile.sampleSize}篇`},
                          {label:"累计新粉",value:accountProfile.totalFollowers.toLocaleString(),sub:"全部快照"},
                        ].map(item=>(
                          <div key={item.label} className="text-center p-3 rounded-xl" style={{backgroundColor:CARD}}>
                            <div className="text-[9px] font-black tracking-wide mb-1" style={{color:"#555"}}>{item.label}</div>
                            <div className="text-xl font-black text-white">{item.value}</div>
                            <div className="text-[9px]" style={{color:"#444"}}>{item.sub}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black" style={{color:"#444"}}>
                          {accountProfile.bestPostTimes.length>0?"最佳发布时段（爆款/优质来源）：":"最佳发布时段：暂无足够爆款样本"}
                        </span>
                        {accountProfile.bestPostTimes.map(t=>(
                          <Badge key={t} style={{backgroundColor:"rgba(200,255,0,0.1)",color:ACCENT}}>{t}</Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap gap-2">
                  <Btn accent onClick={()=>{setReviewModal("screenshot");setUploadStep(0);}}>📷 截图录入</Btn>
                  <Btn onClick={()=>{setReviewModal("new-note");setPredStep(0);}}>✏ 新建笔记</Btn>
                  <Btn onClick={()=>setReviewView("pattern")}>📈 规律报告</Btn>
                  <div className="flex-1"/>
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px]" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`,color:"#666"}}>
                    <span style={{color:"#f59e0b"}}>⏰</span>
                    <span>{reviewNotes.filter(n=>n.status==="已发布"&&n.snapshots.length<3).length} 篇待快照</span>
                  </div>
                </div>

                {/* Pre-publish prediction notes — shown separately */}
                {reviewNotes.filter(n=>n.status==="预测中").length>0&&(
                  <div className="rounded-2xl p-4" style={{backgroundColor:"rgba(120,53,15,0.15)",border:"1px solid rgba(251,146,60,0.2)"}}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-black" style={{color:"#fb923c"}}>⏳ 待发布预测</span>
                      <span className="text-[9px]" style={{color:"#555"}}>发布后在小红书录入数据快照，状态自动更新为已发布</span>
                    </div>
                    <div className="space-y-2">
                      {reviewNotes.filter(n=>n.status==="预测中").map(note=>(
                        <div key={note.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                          style={{backgroundColor:"rgba(255,255,255,0.04)",border:`1px solid ${BORDER}`}}>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{note.title}</div>
                            <div className="text-[9px] mt-0.5" style={{color:"#555"}}>{note.pillar} · 发布时间：{note.publishTime?.slice(0,10)||"未设置"}</div>
                          </div>
                          <button onClick={()=>{
                            setTopics(prev=>prev.map(n=>n.id===note.id?{...n,status:"已发布"}:n));
                          }} className="ml-3 shrink-0 text-[10px] font-black px-3 py-1.5 rounded-lg transition hover:brightness-110"
                            style={{backgroundColor:ACCENT,color:"black"}}>已发布 ✓</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Published Notes — flattened: one row per (note × snapshot) */}
                {(()=>{
                  const SNAP_ORDER={"1h":1,"24h":2,"72h":3,"7d":4};
                  // Flatten — each row is one snapshot of one note
                  const rows=[];
                  reviewNotes.filter(n=>n.status==="已发布"||(!n.status&&n.snapshots?.length>0)).forEach(note=>{
                    if(!note.snapshots||note.snapshots.length===0){
                      // Note has no snapshots yet — still show a placeholder row
                      rows.push({note,snap:null,snapIdx:-1});
                    } else {
                      // Sort snapshots by type order (1h → 24h → 72h → 7d)
                      const sorted=[...note.snapshots].sort((a,b)=>(SNAP_ORDER[a.type]||9)-(SNAP_ORDER[b.type]||9));
                      sorted.forEach((snap,idx)=>rows.push({note,snap,snapIdx:idx}));
                    }
                  });
                  if(rows.length===0)return(
                    <div className="text-center py-12 rounded-2xl" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                      <div className="text-3xl mb-2">📭</div>
                      <div className="text-[11px] font-black" style={{color:"#555"}}>暂无已发布笔记快照</div>
                      <div className="text-[10px] mt-1" style={{color:"#444"}}>点击「📷 截图录入」开始</div>
                    </div>
                  );
                  return(
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[10px]" style={{color:"#555"}}>
                        <span><span className="font-black" style={{color:ACCENT}}>{rows.length}</span> 条数据快照 · 来自 <span className="font-black" style={{color:ACCENT}}>{new Set(rows.map(r=>r.note.id)).size}</span> 篇笔记</span>
                        <span>排序：笔记 + 快照阶段（1h → 24h → 72h）</span>
                      </div>
                      {rows.map(({note,snap},rowIdx)=>{
                        // Build a virtual note containing only snapshots up to current (for status tag computation)
                        const upToHere=snap?note.snapshots.filter(s=>(SNAP_ORDER[s.type]||9)<=(SNAP_ORDER[snap.type]||9)):[];
                        const virtualNote={...note,snapshots:upToHere};
                        const tags=snap?computeStatusTags(virtualNote):["PENDING"];
                        const diag=snap?.aiDiagnosis;
                        const jStyle=diag?JUDGMENT[diag.overallJudgment]:null;
                        const borderColor=tags.includes("HOT")||tags.includes("EXCELLENT")?"rgba(200,255,0,0.3)":tags.includes("COLDFAIL")||tags.includes("UNDERPERF")?"rgba(127,29,29,0.4)":BORDER;
                        // Check if this is the first row for this note (for visual grouping)
                        const isFirstOfNote=rowIdx===0||rows[rowIdx-1].note.id!==note.id;
                        return(
                          <div key={`${note.id}-${snap?.id||"empty"}`}
                            className={`rounded-2xl overflow-hidden cursor-pointer group transition-all duration-200 ${isFirstOfNote?"":"ml-4 sm:ml-8"}`}
                            style={{backgroundColor:CARD,border:`1px solid ${borderColor}`}}
                            onClick={()=>openNoteDetail(note)}>
                            <div className="h-1" style={{backgroundColor:tags.includes("HOT")||tags.includes("EXCELLENT")?ACCENT:tags.includes("COLDFAIL")?"#374151":tags.includes("UNDERPERF")?"#dc2626":"#2a2a2a"}}/>
                            <div className="p-4">
                              {/* Header: show full title only for first row of each note */}
                              {isFirstOfNote?(
                                <div className="flex gap-3 mb-3">
                                  <div className="shrink-0 rounded-lg overflow-hidden relative" style={{width:"48px",height:"64px",backgroundColor:"#1a1a1a",border:`1px solid ${BORDER}`}}>
                                    {note.images?.[0]?(
                                      <img src={note.images[0].dataUrl} alt="" className="w-full h-full object-cover"/>
                                    ):note.noteType==="image"?(
                                      <div className="w-full h-full flex flex-col items-center justify-center" style={{color:"#444"}}>
                                        <div className="text-base">📷</div>
                                        <div className="text-[7px] mt-0.5 font-black" style={{color:"#fcd34d"}}>缺图</div>
                                      </div>
                                    ):(
                                      <div className="w-full h-full flex items-center justify-center text-base" style={{color:"#444"}}>🎬</div>
                                    )}
                                    {note.images?.length>1&&(
                                      <div className="absolute bottom-0.5 right-0.5 px-1 rounded text-[8px] font-black"
                                        style={{backgroundColor:"rgba(0,0,0,0.7)",color:"white"}}>×{note.images.length}</div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                      <Badge style={{backgroundColor:"#1e1e1e",color:"#666"}}>{note.pillar}</Badge>
                                      <span className="text-[9px]" style={{color:"#444"}}>{note.snapshots?.length||0} 次快照</span>
                                      <span className="text-[9px]" style={{color:"#444"}}>· 发布 {new Date(note.publishTime).toLocaleDateString("zh-CN")}</span>
                                    </div>
                                    <h3 className="text-sm font-bold text-white leading-snug group-hover:text-lime-400 transition">{note.title}</h3>
                                  </div>
                                </div>
                              ):(
                                <div className="flex items-center gap-2 mb-2 text-[10px]" style={{color:"#444"}}>
                                  <span style={{color:"#333"}}>↳</span>
                                  <span className="truncate">{note.title}</span>
                                </div>
                              )}
                              {/* Snapshot info bar */}
                              {snap?(
                                <>
                                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                                    <Badge style={{backgroundColor:"rgba(200,255,0,0.12)",color:ACCENT}}>📊 {snap.type} 快照</Badge>
                                    {tags.map(k=><StTag key={k} tagKey={k}/>)}
                                    {jStyle&&<Badge style={{backgroundColor:jStyle.bg,color:jStyle.color}}>{jStyle.label}</Badge>}
                                    <span className="text-[9px] ml-auto" style={{color:"#444"}}>{snap.time?new Date(snap.time).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}):""}</span>
                                    <button onClick={(e)=>{e.stopPropagation();if(confirm(`确认删除「${note.title.slice(0,15)}」的 ${snap.type} 快照？`))deleteSnapshot(note.id,snap.id);}}
                                      title="删除此快照"
                                      className="text-[10px] font-black px-1.5 py-0.5 rounded-md transition hover:brightness-110"
                                      style={{backgroundColor:"rgba(127,29,29,0.4)",color:"#fca5a5",border:"1px solid rgba(127,29,29,0.3)"}}>✕</button>
                                  </div>
                                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-2">
                                    {[["浏览",snap.views],["点赞",snap.likes],["收藏",snap.collects],["评论",snap.comments],["涨粉",snap.newFollowers]].map(([l,v])=>(
                                      <div key={l} className="text-center p-1.5 sm:p-2 rounded-lg overflow-hidden" style={{backgroundColor:"#111"}}>
                                        <div className="text-[11px] sm:text-sm font-black text-white truncate">{fmtNum(v)}</div>
                                        <div className="text-[9px]" style={{color:"#555"}}>{l}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {snap.views>0&&(
                                    <div className="flex gap-3 text-[10px]" style={{color:"#555"}}>
                                      <span>赞阅 {fmtRate(snap.likes,snap.views)}%</span>
                                      <span>藏阅 {fmtRate(snap.collects,snap.views)}%</span>
                                      <span>评阅 {fmtRate(snap.comments,snap.views)}%</span>
                                    </div>
                                  )}
                                  {diag&&(
                                    <div className="rounded-xl p-2.5 mt-3" style={{backgroundColor:"#0a0a0a",border:`1px solid ${BORDER}`}}>
                                      <span className="text-[9px] font-black mr-2" style={{color:ACCENT}}>AI诊断</span>
                                      <span className="text-[11px]" style={{color:"#888"}}>{diag.keyInsight}</span>
                                    </div>
                                  )}
                                </>
                              ):(
                                <div className="rounded-xl p-3 text-[11px] text-center" style={{backgroundColor:"rgba(120,53,15,0.15)",color:"#fcd34d",border:"1px solid rgba(251,146,60,0.2)"}}>
                                  ⏳ 这篇还没有任何数据快照，点击「📷 截图录入」补充
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── NOTE DETAIL VIEW ── */}
            {reviewView==="note-detail"&&selNote&&(
              <div className="space-y-5">
                <button onClick={goBackToList} className="flex items-center gap-2 text-xs font-black transition" style={{color:"#555"}}>
                  ← 返回列表
                </button>
                {/* Note header */}
                <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {computeStatusTags(selNote).map(k=><StTag key={k} tagKey={k}/>)}
                  </div>
                  <h2 className="text-lg font-black text-white mb-3">{selNote.title}</h2>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selNote.tags.map(t=>(
                      <Badge key={t} style={{backgroundColor:"rgba(200,255,0,0.08)",color:ACCENT}}>#{t}</Badge>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs" style={{color:"#555"}}>
                    <span>📅 {new Date(selNote.publishTime).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                    <span>🗂 {selNote.pillar}</span>
                    <span>📷 {selNote.noteType==="image"?"图文":"视频"}</span>
                    <span>🖼 {(selNote.images||[]).length}/18</span>
                  </div>
                </div>

                {/* Image gallery for image-type published notes */}
                {selNote.noteType==="image"&&(
                  <div className="rounded-2xl p-5 transition" style={{
                      backgroundColor:imgDragOver?"rgba(200,255,0,0.04)":CARD,
                      border:`1px solid ${imgDragOver?ACCENT:BORDER}`,
                    }}
                    onDragOver={handleImgDragOver}
                    onDragLeave={handleImgDragLeave}
                    onDrop={(e)=>handleImgDrop(selNote.id,e)}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black">📷 笔记图片</span>
                        <span className="text-[10px]" style={{color:"#555"}}>
                          {(selNote.images||[]).length===0?"暂无图片":`${selNote.images.length} 张 · 第1张为封面`}
                        </span>
                        {imgSaving&&<span className="text-[10px] font-black" style={{color:ACCENT}}>💾 保存中…</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <input type="file" ref={noteImgFileRef} accept="image/*" multiple className="hidden"
                          onChange={e=>{if(e.target.files?.length)addNoteImages(selNote.id,e.target.files);e.target.value="";}}/>
                        <Btn small accent onClick={()=>noteImgFileRef.current?.click()}>+ 上传图片</Btn>
                      </div>
                    </div>
                    {selNote.status==="已发布"&&(!selNote.images||selNote.images.length===0)&&(
                      <div className="mb-3 p-2.5 rounded-xl text-[11px]" style={{backgroundColor:"rgba(120,53,15,0.2)",border:"1px solid rgba(120,53,15,0.4)",color:"#fcd34d"}}>
                        ⚠ 已发布图文笔记缺少图片，建议补充上传
                      </div>
                    )}
                    {(selNote.images||[]).length>0?(
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {selNote.images.map((img,idx)=>(
                          <div key={img.id} className="relative group rounded-xl overflow-hidden"
                            style={{aspectRatio:"3/4",border:idx===0?`2px solid ${ACCENT}`:`1px solid ${BORDER}`}}>
                            <img src={img.dataUrl} alt={img.name}
                              onClick={()=>setImgLightbox({images:selNote.images,index:idx})}
                              className="w-full h-full object-cover cursor-zoom-in"/>
                            {idx===0&&(
                              <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[8px] font-black"
                                style={{backgroundColor:ACCENT,color:"black"}}>封面</div>
                            )}
                            <div className="absolute top-1 right-8 text-[8px] font-black px-1.5 py-0.5 rounded-md"
                              style={{backgroundColor:"rgba(0,0,0,0.6)",color:"white"}}>{idx+1}</div>
                            {/* Always-visible delete button */}
                            <button onClick={(e)=>{e.stopPropagation();if(confirm(`确认删除第 ${idx+1} 张图片？`))removeNoteImage(selNote.id,img.id);}}
                              title="删除这张图片"
                              className="absolute top-1 right-1 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black transition hover:brightness-110"
                              style={{backgroundColor:"rgba(0,0,0,0.7)",color:"#fca5a5",border:"1px solid rgba(252,165,165,0.4)"}}>✕</button>
                            <div className="absolute inset-x-0 bottom-0 p-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition"
                              style={{background:"linear-gradient(to top,rgba(0,0,0,0.85),transparent)"}}>
                              <button onClick={(e)=>{e.stopPropagation();moveNoteImage(selNote.id,img.id,"up");}}
                                disabled={idx===0}
                                className="flex-1 py-1 rounded-md text-[10px] font-black transition disabled:opacity-30"
                                style={{backgroundColor:"rgba(255,255,255,0.15)",color:"white"}}>↑</button>
                              <button onClick={(e)=>{e.stopPropagation();moveNoteImage(selNote.id,img.id,"down");}}
                                disabled={idx===selNote.images.length-1}
                                className="flex-1 py-1 rounded-md text-[10px] font-black transition disabled:opacity-30"
                                style={{backgroundColor:"rgba(255,255,255,0.15)",color:"white"}}>↓</button>
                              <button onClick={(e)=>{e.stopPropagation();if(confirm("删除这张图片？"))removeNoteImage(selNote.id,img.id);}}
                                className="flex-1 py-1 rounded-md text-[10px] font-black transition"
                                style={{backgroundColor:"rgba(127,29,29,0.6)",color:"#fca5a5"}}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ):(
                      <div onClick={()=>noteImgFileRef.current?.click()}
                        onDragOver={handleImgDragOver}
                        onDragLeave={handleImgDragLeave}
                        onDrop={(e)=>handleImgDrop(selNote.id,e)}
                        className="rounded-xl py-10 flex flex-col items-center justify-center cursor-pointer transition"
                        style={{
                          backgroundColor:imgDragOver?"rgba(200,255,0,0.08)":"rgba(255,255,255,0.02)",
                          border:`2px dashed ${imgDragOver?ACCENT:BORDER}`,
                        }}>
                        <div className="text-3xl mb-2">{imgDragOver?"📥":"📷"}</div>
                        <div className="text-[11px] font-black" style={{color:imgDragOver?ACCENT:"#888"}}>
                          {imgDragOver?"松开上传":"点击或拖拽图片到这里（最多 18 张）"}
                        </div>
                        <div className="text-[10px] mt-1" style={{color:"#444"}}>第一张将作为封面</div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Prediction summary */}
                {selNote.aiPrediction&&(
                  <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black">AI 发布预测</span>
                      <Badge style={{backgroundColor:"rgba(200,255,0,0.1)",color:ACCENT}}>置信度 {Math.round(selNote.aiPrediction.confidence*100)}%</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <RangeBar label="浏览量" min={selNote.aiPrediction.predictions.views.min} median={selNote.aiPrediction.predictions.views.median} max={selNote.aiPrediction.predictions.views.max}/>
                        <RangeBar label="点赞率" min={selNote.aiPrediction.predictions.likeRate.min} median={selNote.aiPrediction.predictions.likeRate.median} max={selNote.aiPrediction.predictions.likeRate.max} unit="%"/>
                        <RangeBar label="藏阅比" min={selNote.aiPrediction.predictions.collectRate.min} median={selNote.aiPrediction.predictions.collectRate.median} max={selNote.aiPrediction.predictions.collectRate.max} unit="%"/>
                      </div>
                      <div>
                        <RangeBar label="评阅比" min={selNote.aiPrediction.predictions.commentRate.min} median={selNote.aiPrediction.predictions.commentRate.median} max={selNote.aiPrediction.predictions.commentRate.max} unit="%"/>
                        <RangeBar label="预计新粉丝" min={selNote.aiPrediction.predictions.newFollowers.min} median={selNote.aiPrediction.predictions.newFollowers.median} max={selNote.aiPrediction.predictions.newFollowers.max}/>
                      </div>
                    </div>
                    {selNote.aiPrediction.risks?.length>0&&(
                      <div className="mt-3 p-3 rounded-xl" style={{backgroundColor:"rgba(120,53,15,0.2)",border:"1px solid rgba(120,53,15,0.4)"}}>
                        <div className="text-[10px] font-black mb-1.5" style={{color:"#fcd34d"}}>⚠ 风险提示</div>
                        {selNote.aiPrediction.risks.map((r,i)=>(
                          <div key={i} className="text-[11px] mb-0.5" style={{color:"#f59e0b"}}>· {r}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Snapshot selector */}
                <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black">数据快照 · {selNote.snapshots.length}次记录</span>
                    <Btn small accent onClick={()=>setReviewModal("screenshot")}>+ 录入新快照</Btn>
                  </div>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {selNote.snapshots.map(snap=>(
                      <div key={snap.id} className="flex items-center gap-1 rounded-full"
                        style={{backgroundColor:selSnap?.id===snap.id?"rgba(200,255,0,0.15)":"transparent",border:`1px solid ${selSnap?.id===snap.id?ACCENT:BORDER}`,paddingRight:"4px"}}>
                        <SnapshotPill snap={snap} active={selSnap?.id===snap.id} onClick={()=>{setSelSnap(snap);setEditingSnap(false);setSnapDraft({}); }}/>
                        <button onClick={(e)=>{e.stopPropagation();if(confirm(`确认删除 ${snap.type} 快照？此操作不可撤销。`))deleteSnapshot(selNote.id,snap.id);}}
                          title="删除此快照"
                          className="text-[10px] font-black px-1.5 rounded-full transition hover:brightness-110"
                          style={{color:"#fca5a5"}}>✕</button>
                      </div>
                    ))}
                  </div>

                  {/* Selected snapshot data */}
                  {selSnap&&(
                    <div>
                      {/* Editable metrics grid */}
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-3">
                        {[["浏览","views"],["点赞","likes"],["收藏","collects"],["评论","comments"],["涨粉","newFollowers"]].map(([l,k])=>(
                          <div key={k} className="text-center p-3 rounded-xl" style={{backgroundColor:"#111",border:`1px solid ${editingSnap?ACCENT+"44":BORDER}`}}>
                            {editingSnap?(
                              <input
                                type="number" min="0"
                                value={snapDraft[k]??selSnap[k]}
                                onChange={e=>setSnapDraft(d=>({...d,[k]:+e.target.value}))}
                                className="w-full text-center text-lg font-black outline-none bg-transparent"
                                style={{color:ACCENT}}/>
                            ):(
                              <div className="text-xl font-black text-white">{fmtNum(selSnap[k])}</div>
                            )}
                            <div className="text-[10px]" style={{color:"#555"}}>{l}</div>
                          </div>
                        ))}
                      </div>
                      {/* Edit / Save row */}
                      <div className="flex gap-2 mb-3">
                        {editingSnap?(
                          <>
                            <Btn accent small onClick={()=>{
                              updateSnapData(selNote.id,selSnap.id,snapDraft);
                              setEditingSnap(false);setSnapDraft({});
                            }}>保存数据</Btn>
                            <Btn small onClick={()=>{setEditingSnap(false);setSnapDraft({});}}>取消</Btn>
                          </>
                        ):(
                          <button onClick={()=>{setEditingSnap(true);setSnapDraft({});}}
                            className="text-[10px] font-black px-3 py-1.5 rounded-lg transition hover:opacity-80"
                            style={{backgroundColor:"rgba(255,255,255,0.05)",color:"#555"}}>✏ 手动修改数据</button>
                        )}
                      </div>
                      {selSnap.views>0&&(
                        <div className="flex gap-4 text-xs mb-4" style={{color:"#555"}}>
                          <span>赞阅比 {fmtRate(selSnap.likes,selSnap.views)}%
                            {selNote.aiPrediction&&<span style={{color:+fmtRate(selSnap.likes,selSnap.views)>=selNote.aiPrediction.predictions.likeRate.median?"#86efac":"#fca5a5"}}>
                              {" "}(预期{selNote.aiPrediction.predictions.likeRate.median}%)
                            </span>}
                          </span>
                          <span>藏阅比 {fmtRate(selSnap.collects,selSnap.views)}%</span>
                          <span>评阅比 {fmtRate(selSnap.comments,selSnap.views)}%</span>
                        </div>
                      )}
                      {selSnap.aiDiagnosis?(
                        <Btn accent onClick={()=>openDiagnosis(selSnap)} className="w-full">查看 AI 诊断报告 →</Btn>
                      ):(
                        <div className="text-center py-4 text-xs" style={{color:"#444"}}>该快照暂无 AI 诊断</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── DIAGNOSIS VIEW ── */}
            {reviewView==="diagnosis"&&selSnap?.aiDiagnosis&&(()=>{
              const diag=selSnap.aiDiagnosis;
              const jStyle=JUDGMENT[diag.overallJudgment]||JUDGMENT.met;
              return(
                <div className="space-y-5">
                  <button onClick={goBackToNote} className="flex items-center gap-2 text-xs font-black transition" style={{color:"#555"}}>
                    ← 返回笔记详情
                  </button>

                  {/* Diagnosis Header */}
                  <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-[#555] uppercase tracking-widest">AI 诊断报告 · {selSnap.type}快照</span>
                      <Badge style={{backgroundColor:jStyle.bg,color:jStyle.color,fontSize:"12px",padding:"4px 12px"}}>{jStyle.label}</Badge>
                    </div>
                    <div className="flex items-end gap-3 mb-4">
                      <span className="text-5xl font-black" style={{color:diag.deviationPct>=0?"#86efac":"#fca5a5"}}>
                        {diag.deviationPct>=0?"+":""}{diag.deviationPct}%
                      </span>
                      <span className="text-xs mb-2" style={{color:"#555"}}>主指标偏离预期</span>
                    </div>
                    {/* Key Insight */}
                    <div className="rounded-xl p-4" style={{backgroundColor:"rgba(200,255,0,0.05)",border:`1px solid rgba(200,255,0,0.15)`}}>
                      <div className="text-[10px] font-black mb-1.5" style={{color:ACCENT}}>⚡ 核心洞察</div>
                      <p className="text-sm leading-relaxed" style={{color:"#ccc"}}>{diag.keyInsight}</p>
                    </div>
                  </div>

                  {/* Metric comparison */}
                  <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                    <div className="text-xs font-black mb-4">指标对比</div>
                    <div className="grid grid-cols-4 gap-2 pb-2 mb-1" style={{borderBottom:`1px solid ${BORDER}`}}>
                      {["指标","实际","预期","偏差"].map(h=><span key={h} className="text-[9px] font-black tracking-widest" style={{color:"#444"}}>{h}</span>)}
                    </div>
                    {diag.metricAnalysis.map((m,i)=>(
                      <MetricRow key={i} label={m.metric} actual={m.actual} expected={m.expected} deviationPct={m.deviationPct}/>
                    ))}
                  </div>

                  {/* Issue Diagnosis */}
                  {diag.issueDiagnosis?.length>0&&(
                    <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                      <div className="text-xs font-black mb-4">问题定位（按可能性排序）</div>
                      {diag.issueDiagnosis.map((issue,i)=>(
                        <ProbBar key={i} probability={issue.probability} issue={issue.issue} detail={issue.detail}/>
                      ))}
                    </div>
                  )}

                  {/* Action Checklist */}
                  {diag.actions?.length>0&&(
                    <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-xs font-black">行动清单</div>
                        <span className="text-[10px]" style={{color:"#555"}}>
                          {diag.actions.filter((_,i)=>actionChecked[`${selSnap.id}-${i}`]).length}/{diag.actions.length} 已完成
                        </span>
                      </div>
                      {diag.actions.map((action,i)=>(
                        <ActionItem key={i} action={action}
                          checked={!!actionChecked[`${selSnap.id}-${i}`]}
                          onToggle={()=>toggleAction(selSnap.id,i)}/>
                      ))}
                    </div>
                  )}

                  {/* Historical Reference */}
                  {diag.historicalReference&&(
                    <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                      <div className="text-xs font-black mb-3">历史参考案例</div>
                      <div className="rounded-xl p-4" style={{backgroundColor:"#111",border:`1px solid ${BORDER}`}}>
                        <div className="text-[11px] mb-2" style={{color:"#888"}}>{diag.historicalReference.similarity}</div>
                        <div className="text-[11px] mb-3 font-bold text-white">结果：{diag.historicalReference.outcome}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]" style={{color:"#555"}}>操作成功率</span>
                          <div className="flex-1 h-1.5 rounded-full" style={{backgroundColor:"#2a2a2a"}}>
                            <div className="h-full rounded-full" style={{width:`${diag.historicalReference.successRate}%`,backgroundColor:ACCENT}}/>
                          </div>
                          <span className="text-[10px] font-black" style={{color:ACCENT}}>{diag.historicalReference.successRate}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── PATTERN REPORT VIEW ── */}
            {reviewView==="pattern"&&(()=>{
              // Use AI-generated patterns if available, otherwise fall back to static seed
              const report=patternAI||PATTERN_REPORT;
              const isAI=!!patternAI;
              const lastAnalyzed=patternAI?.analyzedAt?new Date(patternAI.analyzedAt):null;
              const ageMin=lastAnalyzed?Math.round((Date.now()-lastAnalyzed.getTime())/60000):null;
              const stale=patternAI&&patternAI.analyzedCount!==reviewNotes.length;
              const ageLabel=ageMin==null?"":ageMin<1?"刚刚":ageMin<60?`${ageMin}分钟前`:ageMin<1440?`${Math.round(ageMin/60)}小时前`:`${Math.round(ageMin/1440)}天前`;
              return(
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <button onClick={()=>setReviewView("list")} className="text-xs font-black transition" style={{color:"#555"}}>← 返回</button>
                    <span className="text-xs font-black" style={{color:"#333"}}>规律沉淀报告</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAI?(
                      <div className="text-[10px] flex items-center gap-2">
                        <span style={{color:stale?"#fcd34d":"#555"}}>
                          {stale?"⚠ 数据已变更，建议重新分析":`✓ AI 已分析 · 基于 ${patternAI.analyzedCount} 篇 · ${ageLabel}`}
                        </span>
                      </div>
                    ):(
                      <span className="text-[10px]" style={{color:"#fcd34d"}}>⚠ 当前显示示例数据，未基于你的笔记分析</span>
                    )}
                    <button onClick={analyzePatternsAI} disabled={patternLoading||reviewNotes.length===0}
                      className="text-[10px] font-black px-3 py-1.5 rounded-lg transition disabled:opacity-40 hover:brightness-110"
                      style={{backgroundColor:ACCENT,color:"black"}}>
                      {patternLoading?"⏳ 分析中…":isAI?"🔄 重新分析":"🤖 AI 分析"}
                    </button>
                  </div>
                </div>
                {patternError&&(
                  <div className="rounded-xl px-3 py-2 text-[11px]" style={{backgroundColor:"rgba(127,29,29,0.25)",border:"1px solid rgba(252,165,165,0.3)",color:"#fca5a5"}}>
                    {patternError}
                  </div>
                )}

                {/* Period Summary — LIVE COMPUTED from reviewNotes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {label:"总发布",value:livePeriodSummary.totalNotes,color:"white"},
                    {label:"🔥 爆款",value:livePeriodSummary.hitCount,color:"#fca5a5"},
                    {label:"⭐ 优质",value:livePeriodSummary.excellentCount,color:"#93c5fd"},
                    {label:"⚠ 待优化",value:livePeriodSummary.underperfCount,color:"#fcd34d"},
                  ].map(item=>(
                    <div key={item.label} className="rounded-2xl p-4 text-center relative" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                      <div className="absolute top-1.5 right-2 text-[8px] font-black" style={{color:ACCENT}}>LIVE</div>
                      <div className="text-3xl font-black" style={{color:item.color}}>{item.value}</div>
                      <div className="text-[10px] mt-1" style={{color:"#555"}}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Hit & Fail Patterns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {title:"🔥 爆款共性",data:report.hitPatterns,accent:ACCENT,bg:"rgba(200,255,0,0.05)",border:"rgba(200,255,0,0.15)"},
                    {title:"⚠ 失败共性",data:report.failPatterns,accent:"#fca5a5",bg:"rgba(127,29,29,0.05)",border:"rgba(127,29,29,0.2)"},
                  ].map(col=>(
                    <div key={col.title} className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black" style={{color:col.accent}}>{col.title}</span>
                        {isAI&&<span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{backgroundColor:"rgba(200,255,0,0.1)",color:ACCENT}}>AI</span>}
                      </div>
                      {Object.entries(col.data||{}).map(([key,val])=>{
                        const labels={title:"标题",cover:"封面",structure:"结构",time_slot:"时段",length:"字数",tag_combo:"标签"};
                        return(
                          <div key={key} className="mb-3 p-3 rounded-xl" style={{backgroundColor:col.bg,border:`1px solid ${col.border}`}}>
                            <div className="text-[9px] font-black tracking-widest mb-1" style={{color:col.accent}}>{labels[key]||key}</div>
                            <p className="text-[11px] leading-relaxed" style={{color:"#aaa"}}>{val}</p>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Strategies */}
                <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black">下周策略（按优先级）</span>
                    {isAI&&<span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{backgroundColor:"rgba(200,255,0,0.1)",color:ACCENT}}>AI</span>}
                  </div>
                  {(report.strategies||[]).map((s,i)=>(
                    <div key={i} className="flex gap-3 mb-3 p-3 rounded-xl" style={{backgroundColor:"#111",border:`1px solid ${BORDER}`}}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 mt-0.5"
                        style={{backgroundColor:i===0?ACCENT:"#2a2a2a",color:i===0?"black":"#888"}}>
                        {s.priority}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white mb-1">{s.strategy}</div>
                        <p className="text-[11px] mb-1" style={{color:"#666"}}>{s.rationale}</p>
                        <p className="text-[10px] font-black" style={{color:ACCENT}}>{s.expectedImpact}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Skill Evolution */}
                <div className="rounded-2xl p-5" style={{backgroundColor:CARD,border:`1px solid ${BORDER}`}}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black">能力进化地图</span>
                    {isAI&&<span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{backgroundColor:"rgba(200,255,0,0.1)",color:ACCENT}}>AI</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {title:"✅ 已掌握",items:report.skillEvolution?.mastered||[],color:"#86efac",bg:"rgba(20,83,45,0.2)"},
                      {title:"📈 进步中",items:report.skillEvolution?.improving||[],color:"#93c5fd",bg:"rgba(29,78,216,0.15)"},
                      {title:"⚡ 待突破",items:report.skillEvolution?.weakAreas||[],color:"#fcd34d",bg:"rgba(120,53,15,0.2)"},
                    ].map(col=>(
                      <div key={col.title} className="rounded-xl p-4" style={{backgroundColor:col.bg,border:`1px solid rgba(255,255,255,0.05)`}}>
                        <div className="text-[10px] font-black mb-3" style={{color:col.color}}>{col.title}</div>
                        {col.items.map(item=>(
                          <div key={item} className="text-[11px] mb-1.5 flex items-center gap-2" style={{color:"#aaa"}}>
                            <span style={{color:col.color}}>·</span>{item}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>);
            })()}

            {/* ══ MODAL: IMAGE LIGHTBOX ══ */}
            {imgLightbox&&(
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{backgroundColor:"rgba(0,0,0,0.95)"}}
                onClick={()=>setImgLightbox(null)}>
                <button onClick={(e)=>{e.stopPropagation();setImgLightbox(null);}}
                  className="absolute top-4 right-4 h-10 w-10 rounded-full flex items-center justify-center text-xl font-black transition hover:brightness-110"
                  style={{backgroundColor:"rgba(255,255,255,0.1)",color:"white"}}>✕</button>
                <button onClick={(e)=>{e.stopPropagation();setImgLightbox(l=>({...l,index:Math.max(0,l.index-1)}));}}
                  disabled={imgLightbox.index===0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full flex items-center justify-center text-2xl font-black transition disabled:opacity-30 hover:brightness-110"
                  style={{backgroundColor:"rgba(255,255,255,0.1)",color:"white"}}>‹</button>
                <button onClick={(e)=>{e.stopPropagation();setImgLightbox(l=>({...l,index:Math.min(l.images.length-1,l.index+1)}));}}
                  disabled={imgLightbox.index===imgLightbox.images.length-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full flex items-center justify-center text-2xl font-black transition disabled:opacity-30 hover:brightness-110"
                  style={{backgroundColor:"rgba(255,255,255,0.1)",color:"white"}}>›</button>
                <img src={imgLightbox.images[imgLightbox.index]?.dataUrl} alt=""
                  onClick={(e)=>e.stopPropagation()}
                  className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"/>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-black"
                  style={{backgroundColor:"rgba(255,255,255,0.1)",color:"white"}}>
                  {imgLightbox.index+1} / {imgLightbox.images.length}
                </div>
              </div>
            )}

            {/* ══ MODAL: SCREENSHOT UPLOAD ══ */}
            {reviewModal==="screenshot"&&(
              <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{backgroundColor:"rgba(0,0,0,0.85)"}}>
                <div className="w-full max-w-lg rounded-2xl p-6 my-auto max-h-[90vh] overflow-y-auto" style={{backgroundColor:"#111",border:`1px solid ${BORDER}`}}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="text-sm font-black text-white">截图录入</div>
                      <div className="text-[10px] mt-0.5" style={{color:"#555"}}>上传小红书创作中心截图 → AI 自动识别数据</div>
                    </div>
                    <button onClick={()=>{setReviewModal(null);setUploadStep(0);}} className="text-[#333] hover:text-white text-lg">✕</button>
                  </div>

                  {/* Step 0: Drop Zone */}
                  {uploadStep===0&&(
                    <div>
                      <input type="file" ref={screenshotFileRef} accept="image/*" className="hidden"
                        onChange={e=>{const f=e.target.files?.[0];if(f)processScreenshot(f);e.target.value="";}}/>
                      <div className="rounded-2xl border-2 border-dashed p-10 text-center mb-4 cursor-pointer transition-colors"
                        style={{borderColor:imgDragOver?ACCENT:"#2a2a2a",backgroundColor:imgDragOver?"rgba(200,255,0,0.04)":"transparent"}}
                        onClick={()=>screenshotFileRef.current?.click()}
                        onDragOver={handleImgDragOver}
                        onDragLeave={handleImgDragLeave}
                        onDrop={(e)=>{e.preventDefault();e.stopPropagation();setImgDragOver(false);
                          const f=Array.from(e.dataTransfer?.files||[]).find(f=>f.type.startsWith("image/"));
                          if(f)processScreenshot(f);
                        }}>
                        <div className="text-4xl mb-3">{imgDragOver?"📥":"📱"}</div>
                        <div className="text-sm font-black text-white mb-1">{imgDragOver?"松开开始识别":"点击或拖拽截图到这里"}</div>
                        <div className="text-xs" style={{color:"#555"}}>支持 PNG、JPG · 调用 {aiProvider==="claude"?"Claude":aiProvider==="openai"?"GPT-4o":"Gemini"} Vision OCR</div>
                        {!activeKey&&<div className="mt-3 text-[10px] px-3 py-1.5 rounded-lg inline-block" style={{backgroundColor:"rgba(127,29,29,0.3)",color:"#fca5a5"}}>⚠ 未配置 API Key</div>}
                      </div>
                      {ocrError&&(
                        <div className="rounded-xl px-3 py-2 mb-3 text-[11px]" style={{backgroundColor:"rgba(127,29,29,0.25)",border:"1px solid rgba(252,165,165,0.3)",color:"#fca5a5"}}>
                          {ocrError}
                        </div>
                      )}
                      <div className="text-[10px] text-center" style={{color:"#333"}}>
                        💡 建议在小红书App → 创作中心 → 笔记管理 → 点击笔记数据 截图
                      </div>
                    </div>
                  )}

                  {/* Step 1: Processing */}
                  {uploadStep===1&&(
                    <div className="text-center py-8">
                      {ocrPreviewUrl&&(
                        <img src={ocrPreviewUrl} alt="截图预览" className="max-h-40 mx-auto rounded-lg mb-3 opacity-50"/>
                      )}
                      <div className="text-3xl mb-4">🔍</div>
                      <div className="text-sm font-black text-white mb-3">AI Vision 识别中…</div>
                      <div className="h-2 rounded-full mb-2" style={{backgroundColor:"#2a2a2a"}}>
                        <div className="h-full rounded-full transition-all duration-100" style={{width:`${uploadProgress}%`,backgroundColor:ACCENT}}/>
                      </div>
                      <div className="text-[10px]" style={{color:"#555"}}>{aiProvider==="claude"?"Claude":aiProvider==="openai"?"GPT-4o":"Gemini"} Vision · {uploadProgress}%</div>
                    </div>
                  )}

                  {/* Step 2: OCR Result */}
                  {uploadStep===2&&(
                    <div>
                      {ocrPreviewUrl&&(
                        <img src={ocrPreviewUrl} alt="截图预览" className="max-h-48 w-auto mx-auto rounded-lg mb-3"/>
                      )}
                      <div className="rounded-xl p-3 mb-4" style={{backgroundColor:"rgba(200,255,0,0.05)",border:"1px solid rgba(200,255,0,0.2)"}}>
                        <div className="text-[10px] font-black mb-1" style={{color:ACCENT}}>✓ AI 识别完成 · 请校验/修改</div>
                      </div>
                      {/* Note selector — include ALL topics + new-note option */}
                      <div className="mb-3">
                        <label className="text-[10px] font-black tracking-widest mb-1 block" style={{color:"#555"}}>关联到笔记</label>
                        <select value={ocrNote?.id==="__NEW__"?"__NEW__":(ocrNote?.id||"")}
                          onChange={e=>{
                            const v=e.target.value;
                            if(v==="__NEW__"){
                              // Mark as "create new topic" with auto title from OCR
                              setOcrNote({id:"__NEW__",title:`新笔记 · ${new Date().toLocaleDateString("zh-CN")}`,pillar:"人生重铸",status:"已发布",noteType:"image"});
                            } else {
                              setOcrNote(topics.find(n=>n.id===v)||null);
                            }
                          }}
                          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                          style={{backgroundColor:"#1a1a1a",border:`1px solid ${ocrNote?"rgba(200,255,0,0.3)":"#7f1d1d"}`}}>
                          <option value="">-- 请选择笔记 --</option>
                          <option value="__NEW__">＋ 新建笔记并关联此数据</option>
                          <optgroup label="已发布">
                            {topics.filter(n=>n.status==="已发布").map(n=>(
                              <option key={n.id} value={n.id}>{n.title}</option>
                            ))}
                          </optgroup>
                          {topics.filter(n=>n.status!=="已发布").length>0&&(
                            <optgroup label="其他状态">
                              {topics.filter(n=>n.status!=="已发布").map(n=>(
                                <option key={n.id} value={n.id}>[{n.status}] {n.title}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        {ocrNote?.id==="__NEW__"&&(
                          <input type="text" value={ocrNote.title}
                            onChange={e=>setOcrNote(n=>({...n,title:e.target.value}))}
                            placeholder="新笔记标题"
                            className="mt-2 w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                            style={{backgroundColor:"#1a1a1a",border:"1px solid rgba(200,255,0,0.3)"}}/>
                        )}
                      </div>
                      <div className="text-[10px] font-black tracking-widest mb-2" style={{color:"#555"}}>识别结果（可编辑）</div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {[
                          {key:"views",label:"浏览"},
                          {key:"likes",label:"点赞"},
                          {key:"collects",label:"收藏"},
                          {key:"comments",label:"评论"},
                          {key:"shares",label:"分享"},
                          {key:"newFollowers",label:"新增粉丝"},
                        ].map(f=>(
                          <div key={f.key}>
                            <label className="text-[10px]" style={{color:"#555"}}>{f.label}</label>
                            <input type="number" value={ocrData[f.key]}
                              onChange={e=>setOcrData(d=>({...d,[f.key]:+e.target.value||0}))}
                              className="mt-0.5 w-full rounded-lg px-3 py-2 text-sm font-black text-white outline-none"
                              style={{backgroundColor:"#1a1a1a",border:"1px solid rgba(200,255,0,0.3)"}}/>
                          </div>
                        ))}
                      </div>
                      <div className="mb-4">
                        <label className="text-[10px] mb-1 block" style={{color:"#555"}}>快照类型</label>
                        <select value={ocrData.type} onChange={e=>setOcrData(d=>({...d,type:e.target.value}))}
                          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                          style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a"}}>
                          <option value="1h">1h 快照</option>
                          <option value="24h">24h 快照</option>
                          <option value="72h">72h 快照</option>
                          <option value="7d">7d 快照</option>
                        </select>
                      </div>
                      {ocrError&&(
                        <div className="rounded-xl px-3 py-2 mb-3 text-[11px]" style={{backgroundColor:"rgba(127,29,29,0.25)",border:"1px solid rgba(252,165,165,0.3)",color:"#fca5a5"}}>
                          {ocrError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Btn onClick={()=>{setUploadStep(0);setOcrPreviewUrl("");setOcrError("");}} className="flex-1">重新上传</Btn>
                        <Btn accent onClick={confirmOCR} className="flex-1" disabled={!ocrNote}>确认录入快照 →</Btn>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ MODAL: NEW NOTE ══ */}
            {reviewModal==="new-note"&&(
              <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto" style={{backgroundColor:"rgba(0,0,0,0.85)"}}>
                <div className="w-full max-w-2xl rounded-2xl p-4 sm:p-6 my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto" style={{backgroundColor:"#111",border:`1px solid ${BORDER}`}}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="text-sm font-black text-white">新建笔记 · 发布预测</div>
                      <div className="text-[10px] mt-0.5" style={{color:"#555"}}>录入笔记信息 → AI 预测7天数据</div>
                    </div>
                    <button onClick={()=>{setReviewModal(null);setPredStep(0);setPredNote(null);}} className="text-[#333] hover:text-white text-lg">✕</button>
                  </div>

                  {/* Step 0: Form */}
                  {predStep===0&&(
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black tracking-widest block mb-1.5" style={{color:"#555"}}>标题 *</label>
                        <Input value={newNoteForm.title} onChange={e=>setNewNoteForm({...newNoteForm,title:e.target.value})} placeholder="输入笔记标题..."/>
                        {newNoteForm.title&&(
                          <div className="text-[10px] mt-1" style={{color:hasConflict(newNoteForm.title)?ACCENT:"#f59e0b"}}>
                            {hasConflict(newNoteForm.title)?"✓ 包含冲突词，预测分更高":"建议加入「以为/才发现/不是」等冲突词"}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black tracking-widest block mb-1.5" style={{color:"#555"}}>所属专栏</label>
                          <select value={newNoteForm.pillar} onChange={e=>setNewNoteForm({...newNoteForm,pillar:e.target.value})}
                            className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                            style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a"}}>
                            {PILLARS.slice(1).map(p=><option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black tracking-widest block mb-1.5" style={{color:"#555"}}>类型</label>
                          <select value={newNoteForm.noteType} onChange={e=>setNewNoteForm({...newNoteForm,noteType:e.target.value})}
                            className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                            style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a"}}>
                            <option value="image">图文</option><option value="video">视频</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black tracking-widest block mb-1.5" style={{color:"#555"}}>话题标签（逗号分隔）</label>
                        <Input value={newNoteForm.tags} onChange={e=>setNewNoteForm({...newNoteForm,tags:e.target.value})} placeholder="女性成长, 30岁, 人生感悟"/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black tracking-widest block mb-1.5" style={{color:"#555"}}>发布时间</label>
                        <input type="datetime-local" value={newNoteForm.publishTime} onChange={e=>setNewNoteForm({...newNoteForm,publishTime:e.target.value})}
                          className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                          style={{backgroundColor:"#1a1a1a",border:"1px solid #2a2a2a"}}/>
                      </div>
                      <Btn accent disabled={!newNoteForm.title.trim()} onClick={generatePrediction} className="w-full mt-2">提交并生成 AI 预测 →</Btn>
                    </div>
                  )}

                  {/* Step 1: Predicting */}
                  {predStep===1&&(
                    <div className="text-center py-12">
                      <div className="text-3xl mb-4 animate-pulse">🤖</div>
                      <div className="text-sm font-black text-white mb-2">AI 正在分析你的笔记…</div>
                      <div className="text-xs" style={{color:"#555"}}>结合账号画像 + 历史爆款数据 + 发布时段</div>
                    </div>
                  )}

                  {/* Step 2: Prediction Result */}
                  {predStep===2&&predNote&&(
                    <div>
                      <div className="rounded-xl p-3 mb-5" style={{backgroundColor:"rgba(200,255,0,0.05)",border:"1px solid rgba(200,255,0,0.15)"}}>
                        <div className="text-[10px] font-black mb-0.5" style={{color:ACCENT}}>AI 预测完成 · 置信度 {Math.round(predNote.aiPrediction.confidence*100)}%</div>
                        <div className="text-xs font-bold text-white truncate">{predNote.title}</div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                          <RangeBar label="浏览量" min={predNote.aiPrediction.predictions.views.min} median={predNote.aiPrediction.predictions.views.median} max={predNote.aiPrediction.predictions.views.max}/>
                          <RangeBar label="点赞率" min={predNote.aiPrediction.predictions.likeRate.min} median={predNote.aiPrediction.predictions.likeRate.median} max={predNote.aiPrediction.predictions.likeRate.max} unit="%"/>
                          <RangeBar label="藏阅比" min={predNote.aiPrediction.predictions.collectRate.min} median={predNote.aiPrediction.predictions.collectRate.median} max={predNote.aiPrediction.predictions.collectRate.max} unit="%"/>
                        </div>
                        <div>
                          <RangeBar label="评阅比" min={predNote.aiPrediction.predictions.commentRate.min} median={predNote.aiPrediction.predictions.commentRate.median} max={predNote.aiPrediction.predictions.commentRate.max} unit="%"/>
                          <RangeBar label="预计新粉丝" min={predNote.aiPrediction.predictions.newFollowers.min} median={predNote.aiPrediction.predictions.newFollowers.median} max={predNote.aiPrediction.predictions.newFollowers.max}/>
                        </div>
                      </div>
                      <div className="mb-4">
                        {predNote.aiPrediction.reasons.map((r,i)=>(
                          <div key={i} className="flex gap-2 items-start mb-2 p-2.5 rounded-lg" style={{backgroundColor:"#1a1a1a"}}>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{backgroundColor:"#2a2a2a",color:"#888",flexShrink:0}}>{r.type}</span>
                            <span className="text-[11px]" style={{color:"#aaa"}}>{r.desc}</span>
                          </div>
                        ))}
                      </div>
                      {predNote.aiPrediction.risks?.length>0&&(
                        <div className="rounded-xl p-3 mb-4" style={{backgroundColor:"rgba(120,53,15,0.2)",border:"1px solid rgba(120,53,15,0.4)"}}>
                          {predNote.aiPrediction.risks.map((r,i)=>(
                            <div key={i} className="text-[11px]" style={{color:"#f59e0b"}}>⚠ {r}</div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Btn onClick={()=>setPredStep(0)} className="flex-1">返回修改</Btn>
                        <Btn accent onClick={confirmNewNote} className="flex-1">保存笔记 →</Btn>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2"
        style={{backgroundColor:BG,borderTop:`1px solid ${BORDER}`}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>switchTab(n.id)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition"
            style={{backgroundColor:tab===n.id?ACCENT:"transparent",color:tab===n.id?"black":"#555"}}>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
