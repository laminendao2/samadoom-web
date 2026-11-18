@echo off
cd /d "C:\Users\lamin\Documents\Mes projets\samadoom-web"
git add -A
git commit -m "feat: referral modal for all new users (email + Google)"
git fetch origin
git rebase origin/main
git push origin main
echo DONE >> push7_log.txt
pause
