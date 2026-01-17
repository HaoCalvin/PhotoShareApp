```markdown
# PhotoShare - 静态前端 + Firebase + IPFS(Web3.Storage) 照片分享网站

说明：
- 前端单页应用（静态），使用 Firebase Authentication + Firestore 作为后端（无自建服务器）。
- 图片不使用 Firebase Storage，采用 Web3.Storage（IPFS + Filecoin）存储图片。
- 管理员邮箱： haochenxihehaohan@outlook.com （页面会识别该邮箱作为管理员并开放删除权限）

功能要点：
1. 专业 UI，响应式（手机/电脑）。
2. 完整用户系统（邮箱注册/登录），同一账号可在不同设备登录。
3. 图片上传（至少需要一个关键词）、浏览、点赞、评论、关注、隐私设置（隐藏作品仅作者可见）。
4. 搜索（Fuse.js 提供模糊/智能搜索）。
5. 实时（Firestore onSnapshot 订阅）。
6. 管理员功能：管理员能删除指定内容。
7. 热门系统、放大预览、多主题（深色/浅色/白色）。
8. 讨论区、相关内容推荐（基于关键词）。

部署前准备（必须）：
1. Firebase 控制台中创建项目（你已经提供了 firebase 配置），并启用 Authentication（Email/Password）以及 Firestore（建议选择 us-central 或 nearest region）。
2. 在 https://web3.storage 注册并创建 API Token（它是字符串），记下它，我们在下面会说明放在哪里。
3. 修改 `js/firebase-config.js` 中的 `WEB3_STORAGE_TOKEN` 为你创建的 token（或使用更安全的方式：在 Firebase Hosting 控制台设置环境变量，然后在部署时注入——见下文）。
   - 把 token 写入代码会暴露在静态站点中（任何查看源代码的人都能看到），这可能带来滥用风险。推荐在 Firebase Functions 或后端代理中隐藏 token，但当前你要求“无服务器”，所以你需要权衡：使用 token 直接在前端上传（便捷，但暴露 token）；或者在 web3.storage 里限制 token 的权限 / 使用速率。Web3.Storage 的 token 可随时被撤回。

部署（快速）：
1. 在本地初始化 Git 仓库，提交本项目文件到 GitHub。
2. 在 Firebase CLI 中登录并初始化 Hosting（如果你只有手机，可在 GitHub 中直接使用 GitHub Actions + firebase-tools 进行部署，或从电脑上进行部署）。
3. 如果直接在 repo 放置 `WEB3_STORAGE_TOKEN`，确保 `.gitignore` 不要漏掉（但这会让站点无法运行，建议用 GitHub Secrets + GitHub Actions 注入）。
4. 参考：https://firebase.google.com/docs/hosting

安全建议：
- 最好将 web3 token 存在一个服务器端（或 cloud function）并在前端通过受限的端点获取上传 URL；或者使用短期签名上传方案。目前示例为浏览器直接上传到 Web3.Storage（更简单但 token 暴露）。

项目结构：
- index.html
- styles.css
- js/
  - firebase-config.js
  - app.js

如果你需要，我可以：
- 帮你把 TOKEN 存进 Firebase Hosting 的环境变量并给出 GitHub Actions 的部署流程（无须暴露 token 到公共 repo）。
- 或者把上传改成“上传到 Cloudflare R2（如果你有）”，或者提供一个 Cloud Function 作为中继。