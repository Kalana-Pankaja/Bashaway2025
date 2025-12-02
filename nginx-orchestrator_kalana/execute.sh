#!/bin/bash
mkdir -p out
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout out/key.pem -out out/cert.pem -subj "/CN=localhost" 2>/dev/null
cat > out/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}
http {
    limit_req_zone $binary_remote_addr zone=rate_limit:10m rate=10r/s;
    upstream backend_fleet {
        server localhost:8081 max_fails=3 fail_timeout=30s;
        server localhost:8082 max_fails=3 fail_timeout=30s;
        server localhost:8083 max_fails=3 fail_timeout=30s;
    }
    server {
        listen 443 ssl;
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        limit_req zone=rate_limit burst=20 nodelay;
        error_page 500 502 503 504 /custom_error.html;
        location = /custom_error.html {
            internal;
            return 200 "Custom Error: The ship has sunk\n";
        }
        location / {
            proxy_pass http://backend_fleet;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
