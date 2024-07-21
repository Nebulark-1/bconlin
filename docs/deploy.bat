@echo off
REM Exit on errors
setlocal enabledelayedexpansion
if errorlevel 1 exit /b 1

REM Navigate to the project directory
cd /d %~dp0

REM Create a new directory to temporarily hold the build output
mkdir temp-deploy
xcopy dist temp-deploy /E /I

REM Checkout to gh-pages branch
git checkout gh-pages

REM Copy the build output to the root of the gh-pages branch
xcopy temp-deploy\* . /E /I /Y

REM Clean up the temporary directory
rmdir /S /Q temp-deploy

REM Add, commit, and push the changes
git add .
git commit -m "Deploy latest build"
git push origin gh-pages

REM Go back to the previous branch
git checkout -
