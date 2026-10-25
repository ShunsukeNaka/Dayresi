/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // 相対パスにしておくと、GitHub Pages のリポジトリ名に関係なく動く
  base: './',
  plugins: [
    react(),
    // 一度開けば通信がなくても動くよう、Service Worker でアプリのファイルをキャッシュする（SPEC「非機能」）
    // 新しい版を公開すると新しい Service Worker はすぐ有効になるが、開いているページは読み直さない。
    // 新しい版になるのは次にページを読み込んだとき（#75）。会計の途中で読み直されてカートが消えることはない
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Dayresi',
        short_name: 'Dayresi',
        description: '登録不要・その日だけ使えるWebレジ',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f3f4f6',
        theme_color: '#1f2937',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // 金額のフォント（Inter）は、数字と ¥ が入るラテン文字の分だけキャッシュする。ほかの言語の分は使わない
        globPatterns: ['**/*.{js,css,html,svg}', '**/inter-latin-wght-normal-*.woff2'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
