import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 開發時用根路徑 "/"，方便本機預覽。
// 正式 build 到 GitHub Pages 時才套用子路徑（專案頁面為 /<repo>/）。
// custom domain 或 <user>.github.io 根網域：把 VITE_BASE 設為 "/"。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? process.env.VITE_BASE ?? '/rp-claude/' : '/',
}));
