#!/usr/bin/env bash
# PC 에서 이미지 빌드 → OCI 로 전송 (서버에서는 빌드하지 않는다)
# 사용 (저장소 루트에서):
#   OCI_SSH=ubuntu@<서버 주소> OCI_KEY=~/.ssh/<키 파일> deploy/oci/build_and_ship.sh
# 서버 주소는 Cloudflare 뒤 원본 IP 이므로 공개 저장소에 적지 않는다.
set -euo pipefail
: "${OCI_SSH:?OCI_SSH=user@host 를 지정하세요}"
SSH_OPTS=()
[ -n "${OCI_KEY:-}" ] && SSH_OPTS=(-i "$OCI_KEY")
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

docker build --platform linux/amd64 -t library-api:latest "$ROOT/backend"
docker build --platform linux/amd64 -t library-web:latest \
  -f "$ROOT/deploy/oci/web.Dockerfile" \
  --build-context nginxconf="$ROOT/deploy/oci" "$ROOT/frontend"

docker save library-api:latest library-web:latest | gzip -1 \
  | ssh "${SSH_OPTS[@]}" "$OCI_SSH" 'gunzip | docker load'
scp "${SSH_OPTS[@]}" "$ROOT/deploy/oci/compose.yml" "$OCI_SSH:/srv/stacks/library/compose.yml"
