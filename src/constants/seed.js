// Seed data for first-time users and reference data.
// SEED_TOPICS uses uid() for ids — re-imported here to avoid circular deps.
import { uid } from '../utils/format';

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

export { SEED_TOPICS, SEED_COMMENTS, WEEK_SLOTS, SEED_CAL_NOTES, ACCOUNT_PROFILE_DATA, PATTERN_REPORT };
