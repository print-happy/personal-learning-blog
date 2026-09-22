# 发布与授权

写作台可以在纯静态页面中调用 GitHub API。这里使用手动输入的细粒度个人访问令牌，没有伪装成无需后端的 OAuth 登录。GitHub 的 REST API 支持浏览器跨域请求；实现固定请求 https://api.github.com ，不会向任意用户填写的 API 地址发送凭据。[官方跨域说明](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests)

## 准备权限

在 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens 创建令牌，Repository access 只选择博客仓库，设置合理过期时间。Repository permissions 使用：

| 权限 | 用途 |
| --- | --- |
| Contents: Read and write | 读取文章、写入资源、创建提交、推进分支 |
| Actions: Read-only | 查询本次提交对应的工作流运行 |
| Deployments: Read-only | 确认 github-pages 环境的部署成功状态 |
| Metadata: Read-only | GitHub 自动提供 |

在线编辑器不会写 .github/workflows，因此不需要 Workflows 写权限。初次将完整项目放进仓库需要采用你平常的 GitHub / Git 方式；组织仓库可能还要求管理员批准或单点登录授权。受保护分支若不允许直接提交，应下载文章包，经本地分支和 PR 流程合入。

令牌只留在写作台的内存中。它不会进入 localStorage、IndexedDB、文章、ZIP、日志、URL 或站点配置。刷新、关闭或离开写作页后需要重新输入；“清除凭据”会立即移除界面中的值。已经发出的请求无法通过清除输入框撤回。电脑或浏览器本身仍须可信，不要在他人提供的同源脚本环境中输入仓库写权限令牌。

## 一次发布如何完成

点击发布之前需要勾选已检查预览。程序先读取目标分支的提交和目录，再确认文章版本。如果该地址已经存在但没有从远端载入，或者载入之后文章/资源被别人修改，程序会停止，保留当前草稿。

检查通过后，程序创建各资源的 blob，用原目录作为 base tree 创建新目录，再创建一个同时包含正文和资源的提交。最后使用 force: false 更新分支。这样，分支上的读者不会看到只有正文而资源尚未写完的中间状态。如果有人同时更新分支，GitHub 会拒绝非快进更新；程序不强制覆盖。未被分支引用的临时 blob / commit 不等于内容已发布。[Git trees](https://docs.github.com/en/rest/git/trees#create-a-tree)、[Git references](https://docs.github.com/en/rest/git/refs#update-a-reference)

修改已有文章时，先在“编辑已有文章”输入文章地址并载入远端版本。正文和资源会一起载入，后续发布会比较该文章目录的文件指纹。发生冲突时先下载本地文章包，再载入远端最新版本，由作者合并差异。实现没有自动合并或强制覆盖按钮。

## 看懂结果

“已保存”表示内容已经进入 GitHub 分支。“构建中”表示匹配该提交 SHA 和分支的工作流正在运行。“部署完成”还需要同一 SHA 的 github-pages 部署记录报告成功；仅凭工作流成功不会显示部署完成。[工作流查询](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow)、[部署状态](https://docs.github.com/en/rest/deployments/statuses#list-deployment-statuses)

页面每 15 秒检查一次，离开页面或清除凭据就停止。提交编号和仓库配置会保存在浏览器，便于回来后重新输入 token 并刷新状态，其中不含 token。

| 看到的情况 | 处理方法 |
| --- | --- |
| 网络中断，保存结果待核查 | 先点“刷新发布状态”。程序会确认提交是否已进入目标分支，避免盲目再次保存 |
| 内容已保存，暂未找到构建 | 检查工作流文件名、监听分支、Actions 是否启用 |
| 构建失败 | 打开工作流结果，修正文章缺失资源或构建错误；GitHub 中的提交和本机草稿仍在 |
| 构建成功，部署待确认 | 检查 Pages 设置、环境审批和 Deployments 读取权限；不会误报成功 |
| 401 | token 无效或过期 |
| 403 | 权限、组织策略、分支保护或 API 限流 |
| 404 | 仓库、分支、文件不存在，或 token 无权访问 |
| 409 / 422 | 冲突或仓库规则拒绝，重新载入比较后再操作 |

仓库必须先有初始提交与工作流，编辑器不会初始化空仓库，也不会修改网站程序。内容打包下载始终可用，不依赖 GitHub API。

本次交付使用模拟 API 验证了上传失败、并发冲突、不确定网络结果和构建/部署状态。尚未使用真实 token 发布，因此组织规则、真实跨域授权、Actions 额度与 Pages 环境审批不属于已实测结果。


## 删除已发布文章

在写作台输入仓库所有者的令牌，展开“管理已有文章”，填写文章地址并载入远端版本，然后点击“删除已发布文章”。页面会核对个人仓库所有者身份，显示标题、地址、仓库与分支，确认后用一个提交删除该文章正文及附件，自动触发 Pages 部署。本机草稿保留，可以先下载文章包；Git 历史仍含旧内容，删除不是敏感数据的彻底擦除。

远端内容有变化、分支禁止直接提交或令牌权限不足时会停止。提交结果不确定时保留提交记录，先刷新发布状态，不要重复操作。部署失败时线上旧文章可能仍可访问。

此入口仅支持个人仓库所有者，不支持组织仓库。身份检查限制本写作台入口；仓库协作者原有的 GitHub 写权限不变，有写权限的人仍能通过 GitHub 或 Git 修改、删除文件。静态页面不能替代 GitHub 权限控制。
