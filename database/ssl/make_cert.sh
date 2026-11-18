#!/bin/sh
# compose.ssl.yml 용 자체 서명 인증서 생성 (이미 있으면 건너뛴다)
# 실행: database/ 폴더에서  sh ssl/make_cert.sh
# 클라이언트는 sslmode=require 로 접속한다 (암호화만 하고 인증서 발급자는 검증하지 않음).
set -eu
cd "$(dirname "$0")"
if [ -f server.key ] && [ -f server.crt ]; then
    echo "이미 있음: ssl/server.key, ssl/server.crt"
    exit 0
fi
umask 077
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -subj "/CN=library-db" \
    -keyout server.key -out server.crt
chmod 600 server.key
chmod 644 server.crt
openssl x509 -in server.crt -noout -subject -enddate -fingerprint -sha256
