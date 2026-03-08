# 部署說明

這個專案是 Vite + React 靜態網站，正式輸出目錄為 `dist/`。

## 先產出網站

```bash
npm install
npm run build
```

完成後可部署 `dist/` 內的所有檔案。

## 推薦方案

### 1. Cloudflare Pages（最簡單）

適合：不想處理太多設定，只想快速公開。

步驟：

1. 到 Cloudflare Pages 建立新專案
2. 直接連 GitHub repo，或用手動上傳 `dist/`
3. Build command 填 `npm run build`
4. Output directory 填 `dist`
5. 部署完成後會得到公開網址

優點：

- 免費
- 有 HTTPS
- 可直接綁自訂網域
- 支援從 GitHub 自動更新

### 2. GitHub Pages（最常見）

適合：專案本來就在 GitHub，上版控最順。

這個專案已經包含 GitHub Actions 自動部署設定：

- Workflow: `.github/workflows/deploy-pages.yml`
- 觸發條件：push 到 `main`
- Build command: `npm run build`
- 發佈目錄：`dist`

第一次使用 GitHub Pages 時，請到 repo 設定頁確認：

1. 進入 GitHub repository 的 `Settings`
2. 打開 `Pages`
3. 在 `Build and deployment` 區塊選擇 `Source: GitHub Actions`
4. 之後只要 push 到 `main` 就會自動部署

如果你要用 GitHub Pages，這個專案目前已調整為相對路徑輸出，放在 repo 子路徑也可正常載入。

以目前 repo 名稱推算，預設公開網址會是：

- `https://tacomanylegs.github.io/Aptos_Aries_Defi_Backup_Site/`

如果第一次部署後網址還沒出現，先到 GitHub 的 `Actions` 看 workflow 是否成功，再回到 `Settings > Pages` 檢查狀態。

### GitHub Pages 自訂網域

如果你有自己的網域，可以再加上自訂網域。

GitHub 端設定：

1. 進入 repository 的 `Settings`
2. 打開 `Pages`
3. 在 `Custom domain` 輸入你的網域，例如 `aries.yourdomain.com`
4. 勾選 `Enforce HTTPS`

DNS 設定：

- 如果是子網域，例如 `app.example.com`，通常加一筆 `CNAME` 指到 `tacomanylegs.github.io`
- 如果是根網域，例如 `example.com`，通常加 `A` 或 `ALIAS/ANAME` 到 GitHub Pages 官方 IP

建議做法：

1. 子網域優先，設定最單純
2. DNS 生效後再到 GitHub Pages 檢查 HTTPS 是否成功
3. 如需穩定保留自訂網域，也可以額外在專案加入 `CNAME` 檔

## Git 狀態補充

- `dist/` 已經在 `.gitignore`
- 目前 `dist/` 沒有被 git 追蹤
- 代表你現在是正確做法：只提交原始碼，讓 GitHub Actions 自動產生部署內容

### 3. Netlify / Vercel

適合：想要一鍵接 GitHub，自動部署。

設定：

- Build command: `npm run build`
- Publish directory: `dist`

## 不建議方案

### Google Docs

Google Docs 不是網站託管空間，只適合文件分享，不適合 React 網頁。

如果你要的是「任何人打開連結就能直接使用網頁」，請選擇靜態網站託管服務，不要用 Google Docs。

## 建議結論

如果你要：

- 最快上線：選 Cloudflare Pages
- 最常見、最好理解：選 GitHub Pages
- 最少手動設定：選 Netlify 或 Vercel