# fullcust

NaviCust 自动布局工具，支持 BN4 / EXE4、BN5 / EXE5 和 BN6 / EXE6。

## 本地开发

使用 Node.js 22 和 pnpm 10：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## GitHub Pages 部署

本项目使用 Vite 编译 TypeScript。GitHub Pages 必须发布构建后的 `dist/`，直接发布仓库根目录会导致浏览器加载 `index.tsx`，出现模块 MIME 类型错误和白屏。

1. 在仓库的 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。
2. 将 `.github/workflows/deploy.yml` 的修改推送至 `main`。工作流会安装依赖、运行 `pnpm build`，并发布 `dist/`。
3. 如需重新部署，在 **Actions → Deploy → Run workflow** 中选择 `main` 手动运行。
4. 等待部署成功后访问站点。页面源代码中的模块入口应为 `./assets/index-*.js`，而非 `index.tsx`。

Vite 的 `base: "./"` 使构建产物可以部署在 `/fullcust/` 子路径下。
