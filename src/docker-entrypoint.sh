#!/bin/sh
set -e

# 默认挂载目录
: "${MOUNT_DIR:=/data}"

# 推导数据库文件路径并确保目录存在
DB_FILE="${MOUNT_DIR}/config/app.db"
mkdir -p "$(dirname "$DB_FILE")"

# 若挂载目录缺失模型，则从镜像内置复制
MODEL_DST="${MOUNT_DIR}/config/models/silero_vad.onnx"
if [ -f /app/models/silero_vad.onnx ] && [ ! -f "$MODEL_DST" ]; then
  mkdir -p "$(dirname "$MODEL_DST")"
  cp -f /app/models/silero_vad.onnx "$MODEL_DST"
fi

# 设置 Prisma 环境变量并执行迁移
export DATABASE_URL="file:$DB_FILE"
npx prisma migrate deploy

# 交给 CMD（例如：node server.js）
exec "$@"