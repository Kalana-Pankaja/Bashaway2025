#!/bin/bash

mkdir -p out

docker pull nginx:alpine

cat > out/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    limit_req_zone $binary_remote_addr zone=gatehouse_limit:10m rate=10r/s;

    upstream fleet {
        server 127.0.0.1:8081 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:8082 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:8083 max_fails=3 fail_timeout=30s;
    }

    server {
        listen 80;

        error_page 500 502 503 504 /custom_error.html;

        location = /custom_error.html {
            internal;
            default_type text/html;
            return 500 '<html><body><h1>Error</h1></body></html>';
        }

        location / {
            limit_req zone=gatehouse_limit burst=20 nodelay;
            proxy_pass http://fleet;
            proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
EOF
