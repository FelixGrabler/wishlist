FROM nginx:alpine

# Copy static assets
COPY templates /usr/share/nginx/html/templates
COPY styles /usr/share/nginx/html/styles
COPY assets /usr/share/nginx/html/assets
COPY js /usr/share/nginx/html/js

# Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
