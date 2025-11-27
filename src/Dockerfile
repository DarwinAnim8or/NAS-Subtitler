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
    if [ "$ok" -ne 1 ]; then echo "Warning: failed to download silero_vad.onnx at build time; will rely on runtime download or host-mounted model"; fi

# 清理无用文件、压缩二进制并移除构建期工具，进一步瘦身
RUN set -eux; \
    find /app/node_modules -type f -name "*.map" -delete || true; \
    find /app/node_modules -type d \( -name "test" -o -name "__tests__" -o -name "tests" -o -name "doc" -o -name "docs" -o -name "examples" \) -prune -exec rm -rf {} + || true; \
    find /app/node_modules -type f \( -name "*.node" -o -name "*.so" -o -name "*.so.*" \) -exec strip --strip-unneeded {} + || true; \
    rm -rf /usr/share/doc /usr/share/man /usr/share/info || true; \
    apt-get purge -y --auto-remove binutils curl || true; \
    rm -rf /var/lib/apt/lists/*

EXPOSE 3000

# 使用 Entrypoint 脚本，简化启动逻辑并在启动时自动完成数据库迁移与模型复制
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["sh", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]