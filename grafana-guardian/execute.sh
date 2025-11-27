#!/bin/bash
docker pull prom/prometheus:latest
mkdir -p out

cat > out/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
EOF

cat > out/datasource.yml << 'EOF'
datasources:
  - name: Prometheus
    type: prometheus
    url: http://localhost:9090
    access: proxy
EOF

cat > out/dashboard.json << 'EOF'
{
  "dashboard": {
    "title": "System Metrics",
    "panels": [
      {
        "id": 1,
        "title": "CPU Usage",
        "type": "graph",
        "targets": [{"expr": "rate(cpu[5m])"}]
      }
    ]
  }
}
EOF

cat > out/alerts.yml << 'EOF'
groups:
  - name: system_alerts
    rules:
      - alert: HighCPU
        expr: cpu > 80
        for: 5m
EOF
