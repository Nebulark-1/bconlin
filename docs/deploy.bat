@echo off
REM Exit on errors
setlocal enabledelayedexpansion
if errorlevel 1 exit /b 1

REM Build the project
npm run build

REM Navigate into the build output directory
cd dist

REM Initialize a new git repository
git init
git add -A
git commit -m "deploy"

REM Force push to the gh-pages branch
git push -f git@github.com:<Nebulark-1>/<bconlin>.git master:gh-pages

REM Go back to the root of the project
cd ..
