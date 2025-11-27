#!/bin/bash
mkdir -p out/{playbooks,roles,group_vars,host_vars}

cat > out/inventory << 'EOF'
#!/bin/bash
echo '{"_meta":{"hostvars":{}}}'
EOF
chmod +x out/inventory

for f in src/servers/*.json; do
  [ -f "$f" ] || continue
  h=$(jq -r '.hostname' "$f")
  r=$(jq -r '.role' "$f")
  
  mkdir -p "out/roles/$r"/{tasks,handlers,templates}
  
  cat > "out/roles/$r/tasks/main.yml" << EOF
---
- name: Install packages
  package:
    name: "{{ packages }}"
    state: present
  notify: restart services
EOF

  cat > "out/roles/$r/handlers/main.yml" << EOF
---
- name: restart services
  service:
    name: "{{ item }}"
    state: restarted
  loop: "{{ services | default([]) }}"
EOF

  cat > "out/host_vars/$h.yml" << EOF
---
hostname: $h
role: $r
EOF
  
  if [ -f "src/packages/$h.txt" ]; then
    echo "packages:" >> "out/host_vars/$h.yml"
    while read pkg; do
      echo "  - $pkg" >> "out/host_vars/$h.yml"
    done < "src/packages/$h.txt"
  fi
  
  cat > "out/playbooks/$h.yml" << EOF
---
- hosts: $h
  become: yes
  roles:
    - $r
EOF
done

for r in out/roles/*; do
  [ -d "$r" ] || continue
  rn=$(basename "$r")
  cat > "out/group_vars/$rn.yml" << EOF
---
env: production
EOF
done
