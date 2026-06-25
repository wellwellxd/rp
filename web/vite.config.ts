import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 在 https://<user>.github.io/<repo>/ 提供服務，需設定 base 為 "/<repo>/"。
// 用 custom domain 或 <user>.github.io 根網域時，改回 "/"。
// 可用環境變數覆寫：VITE_BASE=/rp-claude/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/rp-claude/',
});
