# 🎯 下次搭类似系统 · 最佳配合 SOP

> 这份文档是为「下一次要和 Claude 一起搭一个类似 xhs-dashboard 的系统」准备的协作手册。
> 把这份文档丢给 Claude，告诉它"按这个 SOP 配合"，可以极大缩短磨合时间、避免踩过的坑。

---

## 0. 启动心法

- **目标先行**：先讲清"这套系统是做什么的、谁用、解决什么痛点"，再讲技术。
- **MVP 思维**：第一版只做核心闭环，不追求全功能。
- **单一事实源**：所有数据围绕一张主表（如 topics），其它视图都用 useMemo 派生，不重复存储。
- **能本地跑通再上云**：先 localStorage → 再 Supabase → 再 PWA → 再生产部署。
- **不要一次提 10 个需求**：每轮聚焦 1-3 件事，Claude 修完、跑通、再下一轮。

---

## 1. 启动阶段（第 1-2 次对话）

### 1.1 必须先告诉 Claude 的事
1. **项目定位**：一句话说清做什么（例："小红书运营选题/复盘工作台"）
2. **使用人数**：1 人 / 团队 / 多租户
3. **数据敏感度**：能否上云、是否要 RLS
4. **设备形态**：PWA / 纯 Web / 桌面端
5. **技术偏好**：React/Vue、TS/JS、CSS 方案
6. **已有的资源**：API Key、域名、云服务账号

### 1.2 让 Claude 输出的初版骨架
- 目录结构（src/components, lib, constants, utils, pages）
- 主数据模型（schema.sql + JS 字段映射器）
- 一个能跑的"Hello"页面 + 一个真实业务页面

### 1.3 别在第一天就做的事
- ❌ OAuth / 第三方登录
- ❌ 域名 / DNS / 邮件 SMTP
- ❌ 多人协作 / 权限系统
- ❌ AI 调用（先写好 mock，最后接真接口）

---

## 2. 编码阶段流程

### 2.1 每个新功能的标准节奏
1. **我描述需求**（含使用场景 + 期望结果）
2. **Claude 先复述需求 + 列实现步骤**（这一步关键，避免理解偏差）
3. **Claude 实现，给出关键代码段和文件位置**
4. **我跑一遍，反馈"成功"或"具体报错"**
5. **修完再前进**

### 2.2 何时让 Claude 重构
- 单文件超过 1500 行 → 拆 components / hooks
- 同一逻辑出现 3 次 → 抽 utils
- 常量散落多处 → 抽 constants
- App.jsx 这种"大脑文件"建议在 2000 行时强制拆

### 2.3 提交节奏
- 每完成一个独立 feature → git commit
- commit message 用动词开头："Add xxx" / "Fix xxx" / "Refactor xxx"
- 重大里程碑后立即推 GitHub，避免本地丢失

---

## 3. 高效 Bug 反馈话术

❌ 不好："不行" / "没反应" / "又坏了"

✅ 好的模板：
```
【现象】点击 X 按钮后，期望看到 Y，实际看到 Z
【路径】Editor 页 → 选中笔记 → 点 AI 评分
【报错】控制台贴这里：xxxxx
【近期改动】上一轮你改了 scoreNote 函数
```

> 把 console 报错原文贴上来，比 100 字描述都有用。

---

## 4. 阶段性必做（每完成一个大功能就做一次）

- [ ] **跑通端到端**：从空白状态走完整流程一遍
- [ ] **刷新页面验证持久化**：数据没丢
- [ ] **退出再登录验证 RLS**：换账号看不到别人数据
- [ ] **看 console**：没有红色报错、没有 warning 堆积
- [ ] **git commit + push**
- [ ] **更新 README/GUIDE**：新功能写一句说明

---

## 5. 避雷清单（这次踩过的坑）

| 坑 | 解法 |
|---|---|
| 单文件 4000+ 行难维护 | 早期就拆 components/hooks/constants |
| AI 返回 JSON 不标准 | 写多 pass 解析器（智能引号、Python 字面量、中文标点、内部引号） |
| AI 评分看不到图片 | 把 images[] 全部传给 vision API，第一张标 role:cover |
| Gemini SSE 截断 | 关掉 thinkingConfig，maxOutputTokens 8192，拼接所有 parts |
| 速率限制无限重试 | 设 MAX_RETRIES=1，等待上限 30s |
| Vercel 部署 401 | 关掉 Deployment Protection |
| 邮件验证 3/hr 限制 | 配 Resend SMTP，或直接关 Confirm email |
| onboarding@resend.dev 只能发自己 | 绑域名后才能发给任意邮箱 |
| 图片用 IndexedDB 难同步 | 上 Supabase Storage + 签名 URL |
| localStorage 数据迁移 | 写一次性 migrate 函数，进入应用时跑 |
| Chat 里 AI 建议被折叠 | 在气泡内 inline 渲染【标题】【正文】【封面】块 |
| 重复 AI 调用浪费 token | scoredAt 时间戳判断"是否需要重新评分" |

---

## 6. 工具箱（验证过好用的组合）

### 6.1 推荐技术栈
- **前端**：React 19 + Vite + Tailwind v4
- **后端**：Supabase（Auth + Postgres + Storage 一站式）
- **部署**：Vercel（GitHub 自动 CI）
- **邮件**：Resend（域名绑定后）
- **PWA**：原生 manifest.json + service worker

### 6.2 AI 选型对照
| 任务 | 首选 | 备选 |
|---|---|---|
| 长文本生成 | Claude opus | GPT-4o |
| 结构化 JSON 输出 | Claude opus | Gemini 2.5 Flash |
| 视觉理解（评分） | GPT-4o vision | Claude opus vision |
| 图片生成 | Gemini nano-banana | Pollinations.ai（免费兜底） |
| 速度优先 | Gemini 2.5 Flash | - |

### 6.3 必装的"防御性代码"
- Multi-pass JSON 解析器
- AI 调用失败兜底（fallback 模型 / mock 数据）
- 速率限制重试上限
- 保存操作的 toast 提示
- 图片上传的 loading + error 态

---

## 7. 开场白模板（给下次的我）

把下面这段直接发给 Claude，能秒速对齐：

```
我要搭一个 [类型] 系统，目标是 [一句话目的]。
使用者：[1人/团队]。设备：[PWA/Web]。
技术偏好：React + Tailwind + Supabase（参考我之前的 xhs-dashboard 项目）。

请按 COLLABORATION.md 的 SOP 配合：
1. 先复述我的需求，列实现步骤
2. 一次只做 1-3 个功能，跑通再前进
3. 单文件不超过 1500 行
4. JSON 解析用多 pass 防御
5. AI 调用必须有重试上限和兜底

我们从「项目骨架 + schema.sql + 第一个真实页面」开始。
```

---

## 8. 持续优化方向（这套项目下一步可做的）

- [ ] 自动保存草稿（Editor 防丢失）
- [ ] Sentry 错误监控
- [ ] AI 评分历史 diff 视图
- [ ] 多账号切换 / 团队协作
- [ ] 数据导出（CSV / Notion）
- [ ] 移动端手势优化
- [ ] 离线模式（PWA 真正发挥）

---

## 9. 最重要的一条

**当你不确定时，停下来问我，不要猜。**
猜错改 3 次的成本，远高于先问 1 次。
