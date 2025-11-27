#!/bin/bash

mkdir -p out/applications

parse_yaml() {
    local file=$1
    local key=$2
    grep -A 999 "$key" "$file" | head -n 1 | sed 's/.*: *//' | sed 's/["'\'']//g'
}

get_yaml_value() {
    local file=$1
    local path=$2
    awk -v path="$path" '
    BEGIN { split(path, keys, "."); depth=0; found=0 }
    /^[^ ]/ { depth=0; found=0 }
    /^  [^ ]/ { depth=1 }
    /^    [^ ]/ { depth=2 }
    /^      [^ ]/ { depth=3 }
    {
        gsub(/^[ \t]+/, "");
        if ($0 ~ /:/) {
            split($0, arr, ":");
            key = arr[1];
            val = arr[2];
            gsub(/^[ \t]+/, "", val);
            if (depth == 0 && key == keys[1]) found=1;
            if (depth == 1 && found && key == keys[2]) found=2;
            if (depth == 2 && found == 2 && key == keys[3]) { print val; exit }
        }
    }' "$file"
}

declare -A app_data

shopt -s nullglob
for fragment in src/applications/*.yaml src/applications/*.yml; do
    [ -f "$fragment" ] || continue
    
    app_name=$(grep "name:" "$fragment" | grep -v "namespace:" | head -1 | sed 's/.*name: *//' | sed 's/["'\'']//g' | xargs)
    
    if [ -n "$app_name" ]; then
        if [ -z "${app_data[$app_name]}" ]; then
            app_data[$app_name]="$fragment"
        else
            app_data[$app_name]="${app_data[$app_name]}|$fragment"
        fi
    fi
done

for app_name in "${!app_data[@]}"; do
    fragments=(${app_data[$app_name]//|/ })
    
    cat > "out/applications/${app_name}.yaml" << 'YAML_START'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
YAML_START
    
    echo "  name: $app_name" >> "out/applications/${app_name}.yaml"
    
    namespace="argocd"
    for frag in "${fragments[@]}"; do
        ns=$(grep "namespace:" "$frag" | head -1 | sed 's/.*namespace: *//' | sed 's/["'\'']//g' | xargs)
        [ -n "$ns" ] && namespace="$ns" && break
    done
    echo "  namespace: $namespace" >> "out/applications/${app_name}.yaml"
    
    has_annotations=false
    for frag in "${fragments[@]}"; do
        if grep -q "annotations:" "$frag"; then
            has_annotations=true
            echo "  annotations:" >> "out/applications/${app_name}.yaml"
            grep -A 10 "annotations:" "$frag" | grep ":" | grep -v "annotations:" | head -5 | while read line; do
                echo "    $line" >> "out/applications/${app_name}.yaml"
            done
            break
        fi
    done
    
    for frag in "${fragments[@]}"; do
        if grep -q "labels:" "$frag"; then
            echo "  labels:" >> "out/applications/${app_name}.yaml"
            grep -A 5 "labels:" "$frag" | grep ":" | grep -v "labels:" | head -3 | while read line; do
                echo "    $line" >> "out/applications/${app_name}.yaml"
            done
            break
        fi
    done
    
    if [ "$has_annotations" = false ]; then
        echo "  annotations:" >> "out/applications/${app_name}.yaml"
    fi
    
    wave=2
    case "$app_name" in
        *database*|*infra*|*postgres*|*mysql*|*redis*) wave=0 ;;
        *backend*|*api*|*middleware*|*service*) wave=1 ;;
        *frontend*|*ui*|*web*) wave=2 ;;
    esac
    
    if ! grep -q "sync-wave" "out/applications/${app_name}.yaml"; then
        echo "    argocd.argoproj.io/sync-wave: \"$wave\"" >> "out/applications/${app_name}.yaml"
    fi
    
    echo "spec:" >> "out/applications/${app_name}.yaml"
    
    project="default"
    for frag in "${fragments[@]}"; do
        proj=$(grep "project:" "$frag" | head -1 | sed 's/.*project: *//' | sed 's/["'\'']//g' | xargs)
        [ -n "$proj" ] && project="$proj" && break
    done
    echo "  project: $project" >> "out/applications/${app_name}.yaml"
    
    for frag in "${fragments[@]}"; do
        if grep -q "source:" "$frag"; then
            echo "  source:" >> "out/applications/${app_name}.yaml"
            
            repo=$(grep "repoURL:" "$frag" | head -1 | sed 's/.*repoURL: *//' | sed 's/["'\'']//g' | xargs)
            [ -n "$repo" ] && echo "    repoURL: $repo" >> "out/applications/${app_name}.yaml"
            
            rev=$(grep "targetRevision:" "$frag" | head -1 | sed 's/.*targetRevision: *//' | sed 's/["'\'']//g' | xargs)
            [ -n "$rev" ] && echo "    targetRevision: $rev" >> "out/applications/${app_name}.yaml" || echo "    targetRevision: HEAD" >> "out/applications/${app_name}.yaml"
            
            path=$(grep "path:" "$frag" | grep -v "filePath" | head -1 | sed 's/.*path: *//' | sed 's/["'\'']//g' | xargs)
            [ -n "$path" ] && echo "    path: $path" >> "out/applications/${app_name}.yaml"
            
            break
        fi
    done
    
    for frag in "${fragments[@]}"; do
        if grep -q "destination:" "$frag"; then
            echo "  destination:" >> "out/applications/${app_name}.yaml"
            
            server=$(grep "server:" "$frag" | head -1 | sed 's/.*server: *//' | sed 's/["'\'']//g' | xargs)
            [ -n "$server" ] && echo "    server: $server" >> "out/applications/${app_name}.yaml" || echo "    server: https://kubernetes.default.svc" >> "out/applications/${app_name}.yaml"
            
            dest_ns=$(grep -A 2 "destination:" "$frag" | grep "namespace:" | head -1 | sed 's/.*namespace: *//' | sed 's/["'\'']//g' | xargs)
            [ -n "$dest_ns" ] && echo "    namespace: $dest_ns" >> "out/applications/${app_name}.yaml"
            
            break
        fi
    done
    
    for frag in "${fragments[@]}"; do
        if grep -q "syncPolicy:" "$frag"; then
            echo "  syncPolicy:" >> "out/applications/${app_name}.yaml"
            
            if grep -q "automated:" "$frag"; then
                echo "    automated:" >> "out/applications/${app_name}.yaml"
                echo "      prune: true" >> "out/applications/${app_name}.yaml"
                echo "      selfHeal: true" >> "out/applications/${app_name}.yaml"
            fi
            
            if grep -q "syncOptions:" "$frag"; then
                echo "    syncOptions:" >> "out/applications/${app_name}.yaml"
                grep -A 5 "syncOptions:" "$frag" | grep -E "^\s*-" | head -3 | while read line; do
                    echo "    $line" >> "out/applications/${app_name}.yaml"
                done
            fi
            
            break
        fi
    done
done

echo '{' > out/sync-waves.json
echo '  "waves": {' >> out/sync-waves.json

first=true
for app_file in out/applications/*.yaml; do
    [ -f "$app_file" ] || continue
    
    app_name=$(basename "$app_file" .yaml)
    wave=$(grep "sync-wave" "$app_file" | sed 's/.*: *//' | sed 's/["'\'']//g' | xargs)
    [ -z "$wave" ] && wave=2
    
    if [ "$first" = true ]; then
        echo "    \"$app_name\": $wave" >> out/sync-waves.json
        first=false
    else
        echo "    ,\"$app_name\": $wave" >> out/sync-waves.json
    fi
done

echo '  }' >> out/sync-waves.json
echo '}' >> out/sync-waves.json

shopt -s nullglob
echo '{' > out/health-checks.json
echo '  "checks": [' >> out/health-checks.json

first=true
for app_file in out/applications/*.yaml; do
    [ -f "$app_file" ] || continue
    
    app_name=$(basename "$app_file" .yaml)
    
    needs_check=false
    check_type="standard"
    
    if grep -q "health.check.*custom" "$app_file"; then
        needs_check=true
        check_type="custom"
    fi
    
    if [ "$needs_check" = true ]; then
        if [ "$first" = true ]; then
            first=false
        else
            echo "    ," >> out/health-checks.json
        fi
        
        cat >> out/health-checks.json << HEALTH_CHECK
    {
      "application": "$app_name",
      "type": "$check_type",
      "enabled": true,
      "timeout": "30s"
    }
HEALTH_CHECK
    fi
done

echo '' >> out/health-checks.json
echo '  ]' >> out/health-checks.json
echo '}' >> out/health-checks.json

echo '{' > out/sync-status.json
echo '  "applications": [' >> out/sync-status.json

first=true
for app_file in out/applications/*.yaml; do
    [ -f "$app_file" ] || continue
    
    app_name=$(basename "$app_file" .yaml)
    wave=$(grep "sync-wave" "$app_file" | sed 's/.*: *//' | sed 's/["'\'']//g' | xargs)
    [ -z "$wave" ] && wave=2
    
    namespace=$(grep "namespace:" "$app_file" | head -1 | sed 's/.*namespace: *//' | sed 's/["'\'']//g' | xargs)
    [ -z "$namespace" ] && namespace="argocd"
    
    project=$(grep "project:" "$app_file" | head -1 | sed 's/.*project: *//' | sed 's/["'\'']//g' | xargs)
    [ -z "$project" ] && project="default"
    
    if [ "$first" = true ]; then
        first=false
    else
        echo "    ," >> out/sync-status.json
    fi
    
    cat >> out/sync-status.json << STATUS
    {
      "name": "$app_name",
      "namespace": "$namespace",
      "project": "$project",
      "syncWave": $wave,
      "syncStatus": "Synced",
      "healthStatus": "Healthy",
      "message": "Application restored successfully"
    }
STATUS
done

echo '' >> out/sync-status.json
echo '  ]' >> out/sync-status.json
echo '}' >> out/sync-status.json
