# 学习札记

一个可本地运行、可部署到 GitHub Pages 的个人 Markdown 博客。阅读页面是预先生成的静态 HTML，写作台在浏览器中运行，不需要常驻应用后端。

**本次交付没有创建远端仓库、使用真实 token 或对外发布。** GitHub 发布已经实现并通过模拟测试，真实账号的权限、分支保护和 Pages 部署仍需在首次使用时确认。

## 先在本地打开

需要 Node.js 24 或更新版本，以及 pnpm 10.30.3。在项目目录运行：

~~~sh
pnpm install --frozen-lockfile
pnpm build
pnpm preview
~~~

默认预览地址为 http://127.0.0.1:4173/ ，写作台是 http://127.0.0.1:4173/editor.html 。预览只绑定本机。不要直接双击 HTML，搜索、编辑器模块和 PDF worker 需要通过 HTTP 加载。

交付时另有一个已启动的本机静态预览；若关闭了它，可以用以上命令重启。也可以运行：

~~~sh
node scripts/serve.mjs docs/.vitepress/dist 4173
~~~

修改代码或本地文章时运行 `pnpm dev`。它会监测 `content/posts` 并重新生成文章。停止预览按 Ctrl+C。

## 写一篇笔记

打开“写作”，填写标题、文章地址和日期，正文使用 Markdown。文章地址采用小写英文、数字和短横线，例如 `reading-notes`。图片可以粘贴、拖进编辑区，也可以通过“添加资源”选择文件。工具栏可以插入链接；编辑器支持撤销、重做、查找和代码高亮。

预览会实时更新。资源列表可以把图片插到光标位置、替换图片或删除图片；移动图片时剪切和粘贴正文中的图片行即可。GIF 保留原文件。PDF 原文件提供下载，不允许在资源面板中替换或删除。

草稿在停止输入约 0.9 秒后保存到当前浏览器的 IndexedDB，也可以点击“保存草稿”。重新打开同一网址会恢复最近草稿，其他草稿在“本机草稿”中。浏览器、端口或域名改变后，草稿空间也会改变。清理网站数据、无痕窗口关闭或存储空间不足都可能使草稿丢失，因此应定期下载文章包。

“下载文章包”得到一个 ZIP，包含 `index.md` 和 `assets/`。填写标题和文章地址后即可下载，无需 GitHub 凭据。ZIP 可以再次导入，也可以解压到 `content/posts/文章地址/` 后本地构建。

## 导入现有文件

单篇 Markdown 可直接导入。如果正文引用本地图片，应选择包含 Markdown 与图片的整个文件夹，或将它们打成 ZIP。文件夹或 ZIP 中有多篇文章时，界面会让你选择其中一篇。程序不会猜测本机其他位置的图片，也不会执行导入文件。

导入时会按 Markdown 所在位置匹配相对资源路径，将图片和 PDF 统一放到文章的 `assets/` 中并调整引用。缺失资源会显示在预览下方，补齐后才能发布。正文引用外链图片时，需要先下载图片并导入；这是为了让文章能够完整搬走。普通 HTTPS 链接可正常使用。HTML、Vue 组件和脚本不作为文章功能执行。

PDF 可以选择直接保留原件，也可以转换为草稿。有可提取文字的页面会尝试整理段落、标题和列表，并提取独立图片。扫描页不会 OCR，而是保留页面图像。多栏、矢量图形、图片读取失败等情况会附上原貌图像和提示。转换不会自动公开，必须检查预览后点击发布。详细限制见 [PDF 与安全边界](guides/pdf-and-security.md)。

| 内容 | 限制 |
| --- | --- |
| Markdown 正文 | 2 MB |
| 单个图片或 PDF | 20 MB |
| 一篇文章全部资源 | 50 MB，最多 150 个 |
| ZIP 压缩文件 | 30 MB；解压后仍遵守文件与总量限制 |
| PDF 转换 | 最多 40 页；2 分钟超时，可取消 |
| 独立 PDF 图片 | 最多 1600 万像素 |
| 支持资源 | PNG、JPEG、GIF、WebP、PDF；不接收 SVG / HTML / 脚本 |

## 第一次部署到 GitHub Pages

先在自己的 GitHub 账号下准备一个仓库，把本项目源码放进去；不要提交 `node_modules`、`work`、浏览器草稿或任何 token。该初始步骤需要包含 `.github/workflows/pages.yml`，在线写作台只写文章，不修改工作流或程序。

部署配置集中在 `site.config.ts`：

- `title` 和 `description` 是站点名称与说明。
- `base` 用于托管路径。用户站点或独立域名通常为 `/`；项目站点 `https://用户名.github.io/仓库名/` 应为 `/仓库名/`。
- `origin` 在有正式域名时填写完整来源地址，用于生成 sitemap；没有时留空。
- `github` 可填写默认用户、仓库、分支和工作流名，均不含凭据。
- 首页图片位于 `docs/public/landscape.jpg`，可替换它或修改 `hero`。
- 关于页面的简短内容位于 `docs/.vitepress/theme/Layout.vue`。

在仓库 Settings → Pages 中把 Source 设为 GitHub Actions。项目已经包含构建、测试和 Pages 部署工作流，默认监听 `main` 分支。若更换分支，应同时修改工作流和写作台设置。也可用仓库 Actions 变量 `BLOG_BASE` 覆盖 `site.config.ts` 的路径，它必须以 `/` 开头和结尾。

等待首次工作流成功后，打开已部署站点的 `/editor.html`。在“GitHub 仓库设置”填写实际目标，输入细粒度 token，检查预览并勾选确认，再点击“保存到 GitHub 并发布”。token 的权限、保存流程和失败恢复见 [发布与授权](guides/publishing.md)。

部署代码通过 GitHub Actions 的环境令牌完成，作者 token 不会进入构建配置。GitHub Actions / Pages 自身的额度与仓库策略仍适用。

## 导出 PDF

文章页上的“导出 PDF”打开浏览器打印预览，选择“另存为 PDF”。专用打印样式会去掉导航和操作按钮，使用白底、中文字体、代码换行和表格排版。不同浏览器的分页仍可能不同，超长文章应在保存前检查。

这是文章的打印版。文章中“下载原文件”下载的是上传时保留的 PDF，两者分开。GIF 在打印中只会留下静态画面。

## 验证与维护

~~~sh
pnpm typecheck
pnpm test
pnpm build
# 在另一个终端先运行 pnpm preview
pnpm test:e2e
pnpm test:static
~~~

浏览器测试默认使用 Windows 的 Edge。其他系统可设置 `BROWSER_CHANNEL=chromium`，并运行 `pnpm exec playwright install chromium` 安装对应浏览器。静态安全检查临时使用 4174 端口；结束后会恢复正常内容生成目录。不要同时运行两个构建或静态安全检查，它们共享生成目录。

[验证报告](VERIFICATION.md) 记录了本次真正执行的检查、截图和未验证事项。依赖精确版本在 `pnpm-lock.yaml`，构建依赖的安全修复约束在 `pnpm-workspace.yaml`。定期检查依赖公告，升级 PDF.js 后重新运行 PDF 样例验收。

## 文件结构

~~~text
content/posts/<slug>/index.md    可携带的文章正文
content/posts/<slug>/assets/     同篇文章的图片与原 PDF
site.config.ts                  名称、路径和发布默认值
docs/.vitepress/theme/           阅读页面与样式
src/editor/                     只在写作台加载的界面
src/core/                       导入、安全渲染、PDF、草稿、GitHub
scripts/prepare.ts              把原始内容转为安全静态页面
docs/.vitepress/dist/            生成的站点，可交给静态服务器
.github/workflows/pages.yml      GitHub Pages 自动构建与部署
tests/                          核心与浏览器测试及真实 PDF 样例
screenshots/                    本次验收截图与打印样本
~~~

`docs/posts`、`docs/public/posts` 和 `.vitepress/generated` 是构建生成目录，不要在那里编辑文章。文章内容只经过 Markdown 安全渲染后作为数据进入页面，从未交给 Vue 编译器。更多说明见 [PDF 与安全边界](guides/pdf-and-security.md)。

需要搬到自己的服务器时，参考 [迁移与故障处理](guides/migration.md)。默认摄影来源和许可见 [第三方素材说明](THIRD_PARTY.md)。

