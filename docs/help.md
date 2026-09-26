---
layout: help
title: 写作与发布
description: 本地文章上传、Markdown 与 PDF 导入、网页写作和发布设置。
---

| 从哪里开始 | 操作入口 |
| --- | --- |
| 已经在电脑上写好文章，想直接上传 | [本地写作后上传](#local) |
| 有 Markdown 或 PDF，想在网页里整理后发布 | [导入 Markdown 或 PDF](#import) |
| 想直接打开网页写文章 | [在网页里写作](#web) |
| 文章已经准备好，只差发布 | [网页发布与访问令牌](#publish) |

发布需要使用博主或有仓库写入权限的协作者账户。访客可以阅读文章，也可以在自己的浏览器里试写草稿，但不能因此改动博客。发布后的正文和附件都可以公开访问。

## 本地写作后上传 {#local}

这条方式只需要登录 GitHub，不必在博客里填写访问令牌。下面以一篇地址为 `reading-notes` 的笔记为例。

### 1. 整理文章文件

在电脑上新建下面的文件夹。`reading-notes` 是文章地址，每篇新文章使用不同的名字；只用小写英文字母、数字和连字符，并以字母或数字开头。

```text
content/
└── posts/
    └── reading-notes/
        ├── index.md
        └── assets/
            ├── diagram.png
            └── paper.pdf
```

把正文保存为 UTF-8 编码的 `index.md`，图片和 PDF 放进同级的 `assets` 文件夹。如果文章没有附件，就不需要 `assets`。`index.md` 可以从这个例子开始：

```markdown
---
title: 一篇阅读笔记
date: 2026-09-26
tags: [阅读, 学习]
---

## 今天读到了什么

这里写正文。上面的日期请改成文章的实际日期。

![示意图](assets/diagram.png)

[阅读原文 PDF](assets/paper.pdf)
```

开头两行 `---` 之间填写标题、日期和标签；标签可以写成 `tags: []`。正文里的附件名称必须与实际文件一致。如果没有示例中的图片或 PDF，请删掉对应的引用。

如果文章是在网页里写的，也可以点「下载文章包」。先解压，再把得到的 `index.md` 和 `assets` 放进 `content/posts/文章地址/`。GitHub 不会自动解压 ZIP，不能把 ZIP 直接当作文章上传。

### 2. 上传到博客仓库

1. 登录 GitHub，打开 [博客仓库](https://github.com/print-happy/personal-learning-blog)，确认当前分支是 `main`。
2. 在仓库首页点「Add file → Upload files」，把刚才准备的整个 `content` 文件夹拖进上传区域。即使仓库里还没有文章目录，也可以这样创建。
3. 检查待上传的文件路径。正文应当是 `content/posts/reading-notes/index.md`，图片应当在对应的 `assets` 目录里，不能只有仓库根目录下的一个 `index.md`。
4. 在提交说明里写上文章标题，选择直接提交到 `main`，再点「Commit changes」。新文章不要使用已有文章的地址，否则会覆盖同名文件。

如果 GitHub 只允许新建分支，就先提交到新分支，再创建 Pull Request；合并进 `main` 后才会更新博客。GitHub 的[文件上传说明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)也有对应步骤。

### 3. 等待网站更新

打开仓库的 [Actions 页面](https://github.com/print-happy/personal-learning-blog/actions)，找到刚才提交触发的运行。等构建和部署都成功后，回到 [博客首页](./index.md) 刷新，文章就会出现在列表里。

这个例子的文章网址会是 `https://print-happy.github.io/personal-learning-blog/posts/reading-notes.html`。如果 Actions 显示红色失败标记，先打开失败的步骤查看提示；文件已经上传，不代表网页已经更新。

以后修改这篇文章时，编辑同一目录里的文件，再按相同路径上传即可。如果已经在电脑上使用 Git，也可以把这些文件提交并推送到仓库的 `main` 分支，后续发布过程相同。

## 导入 Markdown 或 PDF {#import}

打开 [写作页](./editor.md)，在「附件与导入」中选择对应入口。导入会打开一篇新的本地草稿；当前有内容的草稿会先保存，之后可以在「本地草稿」里找回。

### 导入 Markdown

1. 只有一个 `.md` 文件时，点「Markdown / ZIP」选择它。
2. 如果文章还引用了图片或 PDF，用「文件夹」选择包含正文与附件的整个文件夹，或将它们按原目录结构压成 ZIP，再通过「Markdown / ZIP」导入。不要只选正文，否则附件会缺失。
3. 如果文件夹里有多篇 Markdown，在「选择文章」中选中这一篇，再点「导入这一篇」。每次导入一篇文章。
4. 检查标题、文章地址、日期和标签。Markdown 没有开头的文章信息也能导入，但需要在页面上补齐。文章地址只填 `reading-notes` 这样的名字，不填完整网址；导入后自动生成的名字也可以在首次发布前修改。
5. 查看右侧预览，确认图片和附件可用，再按后面的[网页发布步骤](#publish)发布。

图片需要作为文件一起导入。若原文引用的是外部图片网址，先把图片保存到电脑，通过「添加附件」上传，再替换正文中的旧引用。如果暂时不想设置令牌，可以下载文章包，按照[本地上传方式](#local)发布。

### 导入 PDF

展开「导入 PDF」，根据希望呈现的内容选择一种处理方式：

| 想要的结果 | 怎么操作 |
| --- | --- |
| 把 PDF 内容整理成博客正文 | 不勾选「仅作为附件」，直接点「选择 PDF」 |
| 新建一篇文章，只提供 PDF 阅读和下载 | 勾选「仅作为附件」，再点「选择 PDF」 |
| 给正在写的文章补充一个 PDF | 使用上面的「添加附件」，不要走「导入 PDF」 |

转换完成后，先补齐文章信息，再点「查看原文件」对照预览，检查标题、段落、图片和表格。需要了解哪些页面保留成了图片，可以展开「查看导入结果」。扫描页会作为图像保留，不会自动识别成可编辑文字；复杂排版也可能保留成页面图像。

检查并修改正文后，按照[网页发布步骤](#publish)发布，或下载文章包后上传。原 PDF 会随文章一起发布，读者可以打开和下载。

单个 PDF 需不超过 20 MB，正文转换支持最多 40 页。超过页数时，可以选择「仅作为附件」；超过文件大小时，先压缩或拆分。若转换迟迟没有完成，可以取消后改用附件方式。

## 在网页里写作 {#web}

1. 打开 [写作页](./editor.md)，点「新建」。已有草稿可以从「本地草稿」中打开。
2. 填写标题、文章地址和日期。文章地址是网址中代表这篇文章的名字，例如 `reading-notes`；只能使用小写英文字母、数字和连字符，以字母或数字开头，最多 80 个字符。标签可选，多个标签用逗号分隔。
3. 在左侧写 Markdown，右侧会同步显示预览。正文一般从二级标题 `##` 开始，页面上方填写的文章标题会单独显示。
4. 图片可以粘贴或拖进编辑区，也可以用工具栏的图片按钮添加。「附件与导入 → 添加附件」还可以插入 PDF。
5. 完成后检查预览，继续[设置发布并提交文章](#publish)。

点「全屏写作」可以扩大编辑区域。全屏时拖动中间的分隔条，可以调整正文与预览的宽度，也可以拖到边缘只看一侧；边缘的拖动条仍能拉回来。点「恢复等宽」恢复两栏，点「退出全屏」或按 Esc 返回。

写作时会自动保存草稿，也可以手动点「保存草稿」。草稿只在当前浏览器中保存，换电脑或清理浏览器数据后不会自动出现。需要备份或换设备继续写时，点「下载文章包」，以后再通过「Markdown / ZIP」导入。保存草稿和下载文章包都不会发布。

## 网页发布与访问令牌 {#publish}

网页编辑器通过 GitHub 的访问令牌提交文章。只是在 GitHub 登录，并不会自动授权这个写作页。这里的 token 就是「访问令牌」输入框需要填写的内容。

### 博主首次创建令牌 {#token}

以下步骤适用于仓库所有者 `print-happy`。协作者请看下一节。

1. 使用 `print-happy` 账户登录 GitHub，打开 [令牌创建页面](https://github.com/settings/personal-access-tokens/new?name=Personal-learning-blog&target_name=print-happy&expires_in=30&contents=write&actions=read&deployments=read)。这个链接会预填部分设置，仍需检查仓库选择和权限。
2. 给令牌起一个容易辨认的名字，例如 `Personal-learning-blog`，设置有效期，例如 30 天。
3. 确认资源所有者是 `print-happy`。在仓库访问范围中选择「Only select repositories」，然后选中 `personal-learning-blog`。
4. 在仓库权限中核对下表。未列出的权限保持关闭，账户权限不需要添加。
5. 点「Generate token」，按 GitHub 的提示完成身份验证。生成后复制令牌，回到写作页，展开「发布设置」，粘贴到「访问令牌」中。

| 仓库权限 | 选择 | 用途 |
| --- | --- | --- |
| Contents | Read and write | 保存正文和附件 |
| Actions | Read-only | 查询构建进度 |
| Deployments | Read-only | 确认网站部署结果 |
| Metadata | Read-only，自动附带 | 读取仓库信息 |

如果想自己从设置里找到入口，路径是：GitHub 右上角头像 → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token。更多设置见 [GitHub 令牌说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。

令牌完整内容通常只在创建时显示，建议存入密码管理器。它可以代表账户操作仓库，不要写进文章、提交到仓库或发给别人。写作页只在当前页面打开期间使用它，刷新或离开后需要重新填写；看帮助会打开新标签页，原写作页会保留。

### 协作者如何发布 {#collaborator}

先接受仓库邀请，确认自己的账户能够向该仓库提交文件。最省步骤的方式是使用前面的[本地上传流程](#local)，直接在 GitHub 登录后上传。

如果协作者也想在博客写作页直接发布，需要使用自己的令牌。GitHub 目前不支持仓库协作者用上述 Fine-grained tokens 写入这个个人仓库，因此不能照搬博主的创建方式。这项限制见 [GitHub 的说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens-limitations)。

1. 用协作者自己的账户打开 [经典令牌设置](https://github.com/settings/tokens)，选择生成经典令牌。
2. 填写用途说明和有效期。在权限范围中只勾选 `public_repo`，不要勾选整个 `repo`。本博客仓库是公开的，文章发布不需要私有仓库访问权限，也不需要修改工作流的权限。
3. 生成并复制令牌，填进写作页的「访问令牌」。下面的仓库设置仍填写 `print-happy / personal-learning-blog`，不能改成协作者自己的用户名。

经典令牌不能只限定到这一个仓库，`public_repo` 会覆盖该账户有权操作的公开仓库；不想授予这个范围时，请使用 GitHub 上传方式。权限范围可以查阅 [GitHub 的定义](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes)。

### 检查设置并发布

在写作页展开「发布设置」，本博客使用以下值：

| 设置 | 填写内容 |
| --- | --- |
| 用户 / 组织 | `print-happy` |
| 仓库 | `personal-learning-blog` |
| 分支 | `main` |
| 工作流文件 | `pages.yml` |

填写令牌后，检查文章预览，勾选「已检查预览」，再点「发布文章」。修改过正文、附件或文章信息后，需要重新检查并勾选。

显示「已保存」时，文章已经进入 GitHub，网站还可能正在更新。等状态变成「部署完成」，再回到博客查看；也可以点「刷新发布状态」或到 [Actions](https://github.com/print-happy/personal-learning-blog/actions) 查看进度。如果显示「待核查」或网络中断，先刷新状态确认提交结果，避免重复发布。

## 修改和删除文章 {#manage}

修改已发布的文章时，先填写访问令牌，再展开「管理已有文章」。在「已发布文章地址」中输入 `reading-notes` 这样的名字，点「打开文章」，修改后重新发布。不要直接导入一个同名文件覆盖，编辑器需要先读到网站上的版本。

如果提示远端文章已经变化，先下载文章包保留自己的修改，再重新打开已发布文章，把需要保留的内容合并进去。

删除时同样先「打开文章」，再点「删除已发布文章」，核对确认框中的文章地址后确认。这个按钮只允许博主使用；部署完成后，文章及其附件会从当前网站下线。删除本地草稿不会删除网站上的文章，网站下线也不会清除 GitHub 的历史提交。

## 遇到问题时 {#troubleshooting}

| 页面提示或现象 | 处理方式 |
| --- | --- |
| 请先填写访问令牌 | 展开「发布设置」，粘贴令牌；GitHub 登录密码不能填在这里 |
| 凭据无效或已过期 | 检查是否完整复制；过期或已撤销的令牌需要重新创建 |
| 权限不足 | 博主检查令牌是否选中本仓库、Contents 是否可读写；协作者检查是否接受邀请，并使用适用的令牌类型 |
| 找不到仓库、分支或文件 | 对照上面的四项发布设置，检查令牌的仓库范围 |
| 同地址文章已存在 | 修改旧文时先「打开文章」；发布另一篇文章时换一个地址 |
| 附件无法读取、图片不显示 | 补齐文件夹中的图片，或重新添加附件并替换正文引用；确认大小写和文件名一致 |
| 发布按钮不可点 | 检查是否勾选「已检查预览」、是否仍在导入，以及页面是否提示附件缺失 |
| 已保存，但博客没有更新 | 先确认构建和部署成功，再刷新博客；失败时打开 Actions 中对应的运行查看原因 |
| 草稿保存失败 | 立即下载文章包备份，再检查浏览器存储空间或设置 |

附件支持 PNG、JPEG、GIF、WebP 图片和 PDF。单个附件最多 20 MB，一篇文章最多 150 个附件，总计最多 50 MB；Markdown 正文最多 2 MB，导入 ZIP 最多 30 MB。如果超限，先缩小文件或把长文章拆成几篇。GitHub 网页一次最多上传 100 个文件，文件较多时可以使用 Git 客户端一次提交完整文章。

删除或轮换令牌可以到 [GitHub 令牌设置](https://github.com/settings/personal-access-tokens) 操作。令牌失效不会让已经发布的文章下线，只会影响之后的编辑和发布。
