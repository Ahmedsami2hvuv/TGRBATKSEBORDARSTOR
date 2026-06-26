@echo off
echo =======================================
echo Building Android Apps (APKs)...
echo =======================================

echo 1. Building Mandob App...
cd mandob-app
call gradlew assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo Error building Mandob App!
    exit /b %ERRORLEVEL%
)
cd ..
copy mandob-app\app\build\outputs\apk\debug\app-debug.apk AboAkbarMandob.apk /Y
copy mandob-app\app\build\outputs\apk\debug\app-debug.apk mandob-app-debug.apk /Y
echo Mandob App built and copied successfully!

echo 2. Building Preparer App...
cd preparer-app
call gradlew assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo Error building Preparer App!
    exit /b %ERRORLEVEL%
)
cd ..
copy preparer-app\app\build\outputs\apk\debug\app-debug.apk AboAkbarPreparer.apk /Y
echo Preparer App built and copied successfully!

echo 3. Building Employee App...
cd employee-app
call gradlew assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo Error building Employee App!
    exit /b %ERRORLEVEL%
)
cd ..
copy employee-app\app\build\outputs\apk\debug\app-debug.apk AboAkbarModf.apk /Y
copy employee-app\app\build\outputs\apk\debug\app-debug.apk employee-app-debug.apk /Y
echo Employee App built and copied successfully!

echo =======================================
echo All APKs built and copied successfully!
echo =======================================
