# Elena Nova Defense | Elena新星防御

一个经典的导弹指令式塔防游戏，使用 React + Vite + Tailwind CSS 构建。

## 部署到 Vercel (Deployment to Vercel)

1. **上传到 GitHub**:
   - 在 GitHub 上创建一个新的仓库。
   - 将本地代码推送到 GitHub 仓库。

2. **连接到 Vercel**:
   - 登录 [Vercel](https://vercel.com/)。
   - 点击 "Add New" -> "Project"。
   - 选择你的 GitHub 仓库并点击 "Import"。

3. **配置环境变量**:
   - 在 "Environment Variables" 部分，添加以下变量：
     - `GEMINI_API_KEY`: 你的 Google Gemini API 密钥（从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取）。

4. **部署**:
   - 点击 "Deploy"。Vercel 会自动识别 Vite 项目并进行构建和部署。

## 本地开发 (Local Development)

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 技术栈 (Tech Stack)

- **Frontend**: React 19, Vite, Tailwind CSS 4
- **Animation**: Motion (Framer Motion)
- **Icons**: Lucide React
- **AI**: Google Gemini API (用于生成游戏提示)
