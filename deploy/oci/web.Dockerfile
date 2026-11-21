# 프론트엔드 정적 빌드 + nginx. 빌드 컨텍스트는 frontend/ (build_and_ship.sh 참고)
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /src/dist /usr/share/nginx/html
COPY --from=nginxconf nginx.conf /etc/nginx/conf.d/default.conf
