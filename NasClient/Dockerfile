FROM node:20-bookworm-slim

# 使用默认 Debian 源并增加重试与强制 IPv4，缓解网络波动
RUN set -eux; \
    export DEBIAN_FRONTEND=noninteractive; \
    for i in 1 2 3 4 5; do \
      if apt-get update -o Acquire::Retries=5 -o Acquire::ForceIPv4=true \
        && apt-get install -y --no-install-recommends -o Acquire::Retries=5 -o Acquire::ForceIPv4=true ffmpeg ca-certificates binutils openssl libssl3 curl; then \
        break; \
      fi; \
      echo "APT failed (attempt $i), retrying in 5s..."; \
      sleep 5; \
    done; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 切换 npm 源到国内镜像
RUN npm config set registry https://registry.npmmirror.com

# 先仅复制依赖声明并安装依赖，最大化利用缓存
COPY package*.json ./
# 仅安装生产依赖，并额外安装 prisma CLI 以便运行时执行 migrate；同时跳过 onnxruntime-node 的 GPU 组件下载
ENV NODE_ENV=production \
    npm_config_onnxruntime_node_install=skip
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm install --no-save --no-audit --no-fund prisma@5.19.1 \
    && npm cache clean --force

# 仅复制 Prisma schema 并提前生成客户端，避免每次源码改动都触发重新生成
RUN mkdir -p prisma
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate

# 再复制其余源码
COPY . .

# 设置默认挂载目录（容器内），数据库路径由用户环境变量或 MOUNT_DIR 推导
ENV MOUNT_DIR=/data

# 内置 Silero VAD 模型到镜像，作为离线兜底
RUN set -eux; \
    mkdir -p /app/models; \
    urls='https://hf-mirror.com/onnx-community/silero-vad/resolve/main/onnx/model.onnx https://huggingface.co/onnx-community/silero-vad/resolve/main/onnx/model.onnx'; \
    ok=0; \
    for u in $urls; do \
      echo "Downloading $u"; \
      if curl -fL --connect-timeout 15 --retry 5 --retry-delay 2 -o /app/models/silero_vad.onnx "$u"; then \
        size=$(stat -c%s /app/models/silero_vad.onnx || echo 0); \
        if [ "$size" -ge 500000 ]; then ok=1; break; fi; \
      fi; \
      rm -f /app/models/silero_vad.onnx || true; \
    done; \
    test "$ok" -eq 1 || (echo "Failed to download silero_vad.onnx" && exit 1)

# 清理无用文件、压缩二进制并移除构建期工具，进一步瘦身
RUN set -eux; \
    find /app/node_modules -type f -name "*.map" -delete || true; \
    find /app/node_modules -type d \( -name "test" -o -name "__tests__" -o -name "tests" -o -name "doc" -o -name "docs" -o -name "examples" \) -prune -exec rm -rf {} + || true; \
    find /app/node_modules -type f \( -name "*.node" -o -name "*.so" -o -name "*.so.*" \) -exec strip --strip-unneeded {} + || true; \
    rm -rf /usr/share/doc /usr/share/man /usr/share/info || true; \
    apt-get purge -y --auto-remove binutils curl || true; \
    rm -rf /var/lib/apt/lists/*

EXPOSE 3000

# 启动前：若挂载目录缺失模型则从镜像内置复制；基于 MOUNT_DIR 推导数据库路径，再执行迁移
CMD ["sh", "-c", "set -e; DB_FILE=\"${MOUNT_DIR}/config/app.db\"; mkdir -p \"$(dirname \"$DB_FILE\")\"; MODEL_DST=\"${MOUNT_DIR}/config/models/silero_vad.onnx\"; if [ -f /app/models/silero_vad.onnx ] && [ ! -f \"$MODEL_DST\" ]; then mkdir -p \"$(dirname \"$MODEL_DST\")\"; cp -f /app/models/silero_vad.onnx \"$MODEL_DST\"; fi; export DATABASE_URL=\"file:$DB_FILE\"; npx prisma migrate deploy; node server.js"]