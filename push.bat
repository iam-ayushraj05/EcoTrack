@echo off
echo Committing and pushing to EcoTrack repository...
git init
git remote remove origin 2>nul
git remote add origin https://github.com/iam-ayushraj05/EcoTrack.git
git branch -M main
git add .
git commit -m "Update EcoTrack: features, searchable states, and documentation"
git push -u origin main
echo Done!
pause
