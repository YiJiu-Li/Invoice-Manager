#!/usr/bin/env bash
# ============================================================
#  一键部署：打包源码 → 上传到 NAS → NAS 上构建镜像 → 重启容器
#  用法（Git Bash）: bash deploy.sh
#  首次使用前修改下方配置区
# ============================================================

set -e

# ── 配置区（按实际修改）──────────────────────────────────────
NAS_USER="root"
NAS_HOST="192.168.31.170"
NAS_PORT="22"
NAS_DIR="/vol1/1000/docker/invoice-manager"
COMPOSE_PROJECT="invoice-manager"
# ──────────────────────────────────────────────────────────────

# 密码文件（不提交到 git）：echo '你的密码' > .deploy-pass
PASS_FILE="$(dirname "$0")/.deploy-pass"
if [[ -f "$PASS_FILE" ]]; then
  _SP="sshpass -f ${PASS_FILE}"
else
  _SP=""
fi

# SSH/SCP 公共选项：自动接受新主机指纹，以后不再询问
SSH="${_SP} ssh -p ${NAS_PORT} -o StrictHostKeyChecking=accept-new"
SCP="${_SP} scp -P ${NAS_PORT} -o StrictHostKeyChecking=accept-new"

# 脚本所在目录（源码根目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 检查 backend/.env 是否存在
if [[ ! -f "${SCRIPT_DIR}/backend/.env" ]]; then
  echo ""
  echo "错误: backend/.env 不存在，请先执行："
  echo "  cp backend/.env.example backend/.env"
  echo "  然后填写 OPENAI_API_KEY 等配置后再运行本脚本"
  exit 1
fi

echo ""
echo "=========================================="
echo "  发票管理系统 · 一键部署"
echo "=========================================="

# 1. 打包源码（排除无需上传的文件）
echo ""
echo "[1/4] 打包源码..."
TMPTAR="/tmp/invoice-manager-deploy-$(date +%s).tar.gz"
tar -czf "$TMPTAR" \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='*.pyo' \
  --exclude='.pytest_cache' \
  --exclude='node_modules' \
  --exclude='.deploy-pass' \
  --exclude='deploy.sh' \
  --exclude='backend/.env' \
  -C "${SCRIPT_DIR}" \
  backend frontend docker-compose.yml
echo "  打包完成: ${TMPTAR}"

# 2. 上传到 NAS
echo ""
echo "[2/4] 上传源码到 NAS ${NAS_HOST}:${NAS_DIR}/"
$SSH "${NAS_USER}@${NAS_HOST}" "mkdir -p ${NAS_DIR}"
$SCP "$TMPTAR" "${NAS_USER}@${NAS_HOST}:${NAS_DIR}/source.tar.gz"
rm -f "$TMPTAR"

# 单独上传 .env（内含密钥，不打入压缩包）
$SCP "${SCRIPT_DIR}/backend/.env" "${NAS_USER}@${NAS_HOST}:${NAS_DIR}/_backend.env"

# 在 NAS 上解压并放置 .env
$SSH "${NAS_USER}@${NAS_HOST}" bash <<EOF
  set -e
  cd "${NAS_DIR}"
  tar -xzf source.tar.gz
  rm -f source.tar.gz
  mv _backend.env backend/.env
  echo "  解压完成"
EOF

# 3. NAS 上构建镜像
echo ""
echo "[3/4] NAS 上构建 Docker 镜像（首次需要几分钟）..."
$SSH "${NAS_USER}@${NAS_HOST}" \
  "cd ${NAS_DIR} && docker compose -p ${COMPOSE_PROJECT} build"

# 4. 重启所有容器
echo ""
echo "[4/4] 重启容器..."
$SSH "${NAS_USER}@${NAS_HOST}" bash <<EOF
  set -e
  cd "${NAS_DIR}"
  docker compose -p ${COMPOSE_PROJECT} down --remove-orphans
  docker compose -p ${COMPOSE_PROJECT} up -d
  echo ""
  echo "  容器状态："
  docker compose -p ${COMPOSE_PROJECT} ps
EOF

echo ""
echo "=========================================="
echo "  部署完成！"
echo "  前端:   http://${NAS_HOST}:18840"
echo "  后端:   http://${NAS_HOST}:18841"
echo "  数据库: ${NAS_HOST}:5435 (仅内网)"
echo "=========================================="
echo ""
