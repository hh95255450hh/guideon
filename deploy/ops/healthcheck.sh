#!/usr/bin/env bash
# Guideon health monitor — runs every 5 min via cron. Alerts admin@guideon.om
# (via Resend) only on state CHANGE (down→up / up→down), so no spam.
set -u
STATE=/opt/monitoring/.state
LOG=/var/log/guideon-monitor.log
ENVF=/opt/guideon/deploy/.env
RESEND_KEY=$(grep -E '^RESEND_API_KEY=' "$ENVF" | cut -d= -f2-)
TS=$(date '+%F %T')

problems=""

# 1) Site reachable over HTTPS (loopback, real Host header)
code=$(curl -s -o /dev/null -w '%{http_code}' --resolve guideon.om:443:127.0.0.1 https://guideon.om/ 2>/dev/null)
[ "$code" = "200" ] || problems+="• الموقع لا يستجيب (HTTP=$code)\n"

# 2) Core containers healthy/running
for c in guideon-app guideon-nginx supabase-db supabase-kong; do
  st=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null)
  [ "$st" = "running" ] || problems+="• الحاوية $c ليست قيد التشغيل ($st)\n"
done

# 3) Disk usage
use=$(df / | awk 'NR==2{gsub("%","",$5);print $5}')
[ "${use:-0}" -lt 90 ] || problems+="• مساحة القرص ممتلئة (${use}%)\n"

# 4) TLS cert expiry (< 10 days)
exp=$(echo | openssl s_client -servername guideon.om -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$exp" ]; then
  days=$(( ( $(date -d "$exp" +%s) - $(date +%s) ) / 86400 ))
  [ "$days" -gt 10 ] || problems+="• شهادة TLS تنتهي خلال $days يوم\n"
fi

send() { # subject, html
  [ -n "$RESEND_KEY" ] || return
  curl -s -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_KEY" -H "Content-Type: application/json" \
    -d "{\"from\":\"Guideon Monitor <admin@guideon.om>\",\"to\":[\"admin@guideon.om\"],\"subject\":\"$1\",\"html\":\"$2\"}" >/dev/null
}

prev=$(cat "$STATE" 2>/dev/null || echo ok)
if [ -n "$problems" ]; then
  echo "$TS DOWN: $(echo -e "$problems" | tr '\n' ' ')" >> "$LOG"
  if [ "$prev" != "down" ]; then
    send "⚠️ تنبيه: مشكلة في منصّة Guideon" "<h2>تم رصد مشكلة على guideon.om</h2><pre>$(echo -e "$problems")</pre><p>الوقت: $TS</p>"
    echo down > "$STATE"
  fi
else
  echo "$TS OK" >> "$LOG"
  if [ "$prev" = "down" ]; then
    send "✅ عاد عمل منصّة Guideon" "<h2>عادت المنصّة للعمل بشكل طبيعي ✅</h2><p>الوقت: $TS</p>"
  fi
  echo ok > "$STATE"
fi
# keep log small
tail -n 500 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
