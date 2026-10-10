@echo off
rem Rebuilds all audio from js/timeline.js + js/content.js.
rem Needs: Python 3 with numpy + scipy, Node 18+, ffmpeg on PATH, Windows speech voices (guide VO).
cd /d "%~dp0.."
python tools\make_transect.py || exit /b 1
node tools\dump-timeline.js > audio\src\timeline.json || exit /b 1
python tools\make_audio.py || exit /b 1
