# OCI 운영 배포

운영 주소: **https://library.misakachan.moe**

```
브라우저 ─ Cloudflare ─ OCI 호스트 nginx :443 ─ 127.0.0.1:8100  library-web  (nginx: 정적 프론트 + /api 프록시)
                                                        └─ 127.0.0.1:8101  library-api  (FastAPI/uvicorn)
                                                                 └─ 127.0.0.1:5433  역방향 SSH 터널 ─ N100 PostgreSQL 16 (SSL 필수)
```

- 프론트와 API 가 같은 도메인이라 `VITE_API_BASE_URL` 은 비워 두고 빌드한다. CORS·쿠키 SameSite 조정이 필요 없다.
- DB 는 OCI 에 없다. N100 의 `database/` compose 가 DB 를 띄우고, 터널이 OCI `127.0.0.1:5433` 에 붙는다. 터널이 127.0.0.1 에만 열리므로 두 컨테이너 모두 `network_mode: host`.
- 서버 공통 규칙은 OCI `/srv/stacks/README.md` 를 따른다: 한 번에 한 프로젝트, 이미지는 PC 에서 빌드, `docker compose down -v` 금지, 컨테이너마다 `mem_limit`.

## 파일

| 파일 | 서버 위치 | 내용 |
|---|---|---|
| `compose.yml` | `/srv/stacks/library/compose.yml` | api(256m) + web(48m), `restart: unless-stopped` |
| `env.example` | `/srv/stacks/library/.env` (chmod 600) | `DATABASE_URL`(…`?sslmode=require`), `SECRET_KEY`, `DEBUG=false` |
| `web.Dockerfile`, `nginx.conf` | (이미지 안) | `npm run build` 결과 + SPA fallback + `/api` 프록시 |
| `library.nginx-site` | `/etc/nginx/sites-available/library` | 호스트 nginx 443 → 127.0.0.1:8100 |
| `build_and_ship.sh` | — | PC 에서 linux/amd64 빌드 → `docker save \| ssh docker load` → compose 복사 |

## 배포 절차

1. PC(저장소 루트)에서 이미지 빌드·전송: `OCI_SSH=ubuntu@<서버> OCI_KEY=<키 경로> deploy/oci/build_and_ship.sh` (서버 주소는 원본 IP라 저장소에 적지 않는다)
2. 처음 한 번만:
   - 서버에 `.env` 작성. `library_app` 비밀번호는 N100 `~/library/database/.env` 의 `LIBRARY_APP_PASSWORD` 와 같은 값이고, `SECRET_KEY` 는 `openssl rand -hex 32` 로 만든다.
   - 호스트 nginx 사이트 설치: `sites-available/library` 에 복사 → `sites-enabled` 링크 → `sudo nginx -t` → `sudo systemctl reload nginx`.
3. 서버에서 켜기: `/srv/stacks/switch.sh library` (다른 프로젝트가 내려간다). 이미 켜져 있으면 `cd /srv/stacks/library && docker compose up -d` 로 새 이미지를 반영한다.
4. 확인:
   - `curl -s https://library.misakachan.moe/health` 가 `{"status":"healthy"}` 를 돌려준다.
   - 로그인 후 `/api/v1/books` 가 200 이다.

## 참고

- 호스트 nginx 의 HTTP/2 는 꺼 두었다. CVE-2026-123007/123633(2026-11-18 공개)의 Ubuntu 패치가 나오기 전까지의 완화책이고, 백업은 `/etc/nginx/backups/http2-off-20261119/` 에 있다.
- 시드 계정의 공통 비밀번호는 공개 저장소(`database/seed.sql`)에 적혀 있다. 운영 데이터가 망가지면 N100 에서 `database/reset_demo.sql` 로 되돌린다.
- 끄기: `/srv/stacks/switch.sh none`, 또는 다른 프로젝트로 전환.
