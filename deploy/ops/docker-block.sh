#!/usr/bin/env bash
# Block EXTERNAL access to internal service ports (Postgres pooler + Kong),
# while allowing localhost and the Docker bridge networks. Runs at boot via
# guideon-firewall.service (Docker bypasses UFW, so we enforce in DOCKER-USER).
PORTS="5432,6543,8000,8443"
# Idempotent: if the combined DROP already exists, nothing to do.
iptables -C DOCKER-USER -p tcp -m multiport --dports $PORTS -j DROP 2>/dev/null && exit 0
iptables -I DOCKER-USER -p tcp -m multiport --dports $PORTS -j DROP
iptables -I DOCKER-USER -p tcp -m multiport --dports $PORTS -s 127.0.0.0/8   -j RETURN
iptables -I DOCKER-USER -p tcp -m multiport --dports $PORTS -s 172.16.0.0/12 -j RETURN
