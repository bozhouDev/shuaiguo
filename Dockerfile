# 纯静态小游戏：用 nginx 直接托管，不需要构建步骤
FROM nginx:1.27-alpine
# 站点配置：gzip + 按类型设缓存时长
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 只拷贝游戏运行需要的文件（设计文档、实现记录不对外）
COPY index.html assets.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY assets /usr/share/nginx/html/assets
EXPOSE 80
