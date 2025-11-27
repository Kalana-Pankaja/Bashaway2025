#!/bin/bash

mkdir -p out

docker pull nginx:alpine 2>/dev/null || true
docker pull redis:alpine 2>/dev/null || true

cat > out/main.tf << 'EOF'
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.0"
    }
  }
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
}

EOF

containers=$(docker ps --format "{{.ID}}")

for container_id in $containers; do
    name=$(docker inspect --format '{{.Name}}' "$container_id" | sed 's/^\///')
    image=$(docker inspect --format '{{.Config.Image}}' "$container_id")
    
    tf_name=$(echo "$name" | tr '-' '_' | tr '.' '_')
    
    cat >> out/main.tf << RESOURCE_START
resource "docker_container" "$tf_name" {
  name  = "$name"
  image = docker_image.${tf_name}_image.image_id

RESOURCE_START
    
    ports=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$container_id")
    
    if [ "$ports" != "null" ] && [ "$ports" != "{}" ]; then
        echo "$ports" | grep -o '"[0-9]*/[a-z]*":\[{"HostIp":"[^"]*","HostPort":"[^"]*"}\]' | while read -r port_line; do
            container_port=$(echo "$port_line" | grep -o '"[0-9]*/[a-z]*"' | head -1 | tr -d '"')
            host_port=$(echo "$port_line" | grep -o '"HostPort":"[^"]*"' | cut -d'"' -f4)
            
            if [ -n "$container_port" ] && [ -n "$host_port" ]; then
                internal_port=$(echo "$container_port" | cut -d'/' -f1)
                protocol=$(echo "$container_port" | cut -d'/' -f2)
                
                cat >> out/main.tf << PORT_BLOCK
  ports {
    internal = $internal_port
    external = $host_port
    protocol = "$protocol"
  }

PORT_BLOCK
            fi
        done
    fi
    
    env_vars=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id")
    
    if [ -n "$env_vars" ]; then
        while IFS= read -r env_line; do
            if [ -n "$env_line" ] && [[ "$env_line" == *"="* ]]; then
                escaped_env=$(echo "$env_line" | sed 's/"/\\"/g')
                cat >> out/main.tf << ENV_BLOCK
  env = ["$escaped_env"]
ENV_BLOCK
            fi
        done <<< "$env_vars"
    fi
    
    restart_policy=$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$container_id")
    if [ -n "$restart_policy" ] && [ "$restart_policy" != "no" ] && [ "$restart_policy" != "" ]; then
        cat >> out/main.tf << RESTART_BLOCK
  restart = "$restart_policy"
RESTART_BLOCK
    fi
    
    echo "}" >> out/main.tf
    echo "" >> out/main.tf
    
    cat >> out/main.tf << IMAGE_RESOURCE
resource "docker_image" "${tf_name}_image" {
  name = "$image"
}

IMAGE_RESOURCE
done

echo "Terraform configuration generated in out/main.tf"
