# SQL Playground

一个完全在浏览器本地运行的 SQL playground，当前默认使用 SQLite WASM。

支持 SQL 查询、Schema 补全、多查询标签、本地数据库导入和 CSV 导出。数据库文件不会上传到服务器。

## 开发

```bash
pnpm install
pnpm dev
```

格式化代码：

```bash
pnpm format
```

生产构建：

```bash
pnpm build
```

## 部署

- GitHub Pages：推送到 `master` 后自动部署
- Cloudflare：配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 后自动部署
- Docker：`docker build -t sql-playground .`
