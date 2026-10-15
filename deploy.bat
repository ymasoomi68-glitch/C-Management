@echo off
chcp 65001 >nul 2>&1
title ClassYar - Deploy Licenses

REM ===================================================================
REM  deploy.bat  -  اسکریپت انتشار مجوزها برای کلاس‌یار (ویندوز)
REM -------------------------------------------------------------------
REM  این فایل را در ریشهٔ پروژه (کنار index.html) بگذارید.
REM  نیازمندی: Node.js نسخه 16+  و  Git
REM  (Node از https://nodejs.org  -  Git از https://git-scm.com)
REM ===================================================================

cd /d "%~dp0"

REM ---- بررسی Node.js ----
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [X] Node.js نصب نیست یا در PATH نیست.
    echo       از اینجا نصب کنید:  https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM ---- بررسی مسیر پروژه ----
if not exist "index.html" (
    echo.
    echo   [X] فایل index.html پیدا نشد.
    echo       این اسکریپت را در ریشهٔ پروژهٔ کلاس‌یار اجرا کنید.
    echo.
    pause
    exit /b 1
)
if not exist "license-tools\make-hashes.js" (
    echo.
    echo   [X] فایل license-tools\make-hashes.js پیدا نشد.
    echo.
    pause
    exit /b 1
)

REM ---- پارس آرگومان‌ها ----
set "A1=%~1"
set "A2=%~2"
set "A3=%~3"

if "%A1%"=="" goto :default
if /i "%A1%"=="help"   goto :help
if /i "%A1%"=="-h"     goto :help
if /i "%A1%"=="--help" goto :help
if /i "%A1%"=="/?"     goto :help
if /i "%A1%"=="list"   goto :list
if /i "%A1%"=="check"  goto :check
if /i "%A1%"=="status" goto :status
if /i "%A1%"=="add"    goto :add
if /i "%A1%"=="remove" goto :remove

REM ---- اگر آرگومان اول دستور نبود، کد ملی است (میان‌بر) ----
set "A3=%A2%"
set "A2=%A1%"
set "A1=add"
goto :add


REM ===================================================================
REM  حالت پیش‌فرض: ساخت مجدد از buyers.txt + push
REM ===================================================================
:default
echo.
echo ====================================================================
echo    [>>]  کلاس‌یار - ساخت مجدد مجوزها + انتشار روی GitHub
echo ====================================================================
echo.
node license-tools\make-hashes.js --push
if errorlevel 1 goto :fail
goto :done


REM ===================================================================
REM  افزودن خریدار جدید
REM ===================================================================
:add
if "%A2%"=="" (
    echo.
    echo   [X] کد ملی را وارد کنید.
    echo       مثال:  deploy.bat add 0499370899 "علی احمدی"
    echo.
    pause
    exit /b 1
)
echo.
echo ====================================================================
echo    [+]  افزودن خریدار جدید
echo ====================================================================
echo        کد ملی : %A2%
if not "%A3%"=="" echo        نام    : %A3%
echo.
if "%A3%"=="" (
    node license-tools\make-hashes.js add %A2% --push
) else (
    node license-tools\make-hashes.js add %A2% "%A3%" --push
)
if errorlevel 1 goto :fail
goto :done


REM ===================================================================
REM  حذف خریدار
REM ===================================================================
:remove
if "%A2%"=="" (
    echo   [X] مثال:  deploy.bat remove 0499370899
    pause
    exit /b 1
)
echo.
echo ====================================================================
echo    [-]  حذف خریدار: %A2%
echo ====================================================================
echo.
node license-tools\make-hashes.js remove %A2% --push
if errorlevel 1 goto :fail
goto :done


REM ===================================================================
REM  فهرست خریداران
REM ===================================================================
:list
node license-tools\make-hashes.js list
echo.
pause
exit /b 0


REM ===================================================================
REM  بررسی یک کد
REM ===================================================================
:check
if "%A2%"=="" (
    echo   [X] مثال:  deploy.bat check 0499370899
    pause
    exit /b 1
)
node license-tools\make-hashes.js check %A2%
echo.
pause
exit /b 0


REM ===================================================================
REM  وضعیت مخزن
REM ===================================================================
:status
git status
echo.
pause
exit /b 0


REM ===================================================================
REM  راهنما
REM ===================================================================
:help
echo.
echo ====================================================================
echo    [i]  deploy.bat  -  راهنمای استفاده
echo ====================================================================
echo.
echo    افزودن خریدار جدید:
echo      deploy.bat add 0499370899 "علی احمدی"
echo      deploy.bat 0499370899 "علی احمدی"          [میان‌بر]
echo.
echo    حذف خریدار:
echo      deploy.bat remove 0499370899
echo.
echo    فهرست و بررسی:
echo      deploy.bat list                             خریداران فعلی
echo      deploy.bat check 0499370899                 آیا این کد مجاز است؟
echo.
echo    ساخت مجدد (بدون خریدار جدید):
echo      deploy.bat                                  licenses.json + push
echo.
echo    وضعیت مخزن:
echo      deploy.bat status                           git status
echo.
echo    راهنما:
echo      deploy.bat help                             همین پیام
echo.
echo    نکته: نام خریدار را داخل "" بگذارید.
echo ====================================================================
echo.
pause
exit /b 0


REM ===================================================================
REM  پایان موفق
REM ===================================================================
:done
echo.
echo ====================================================================
echo    [OK]  تمام!
echo    - GitHub Pages حداکثر ~10 دقیقه بعد به‌روز می‌شود.
echo    - خریدارهای قبلی با یک بار آنلاین شدن، فهرست جدید را می‌گیرند.
echo    - نسخهٔ برنامه عوض نشد؛ نیازی به آپدیت روی دستگاه‌ها نیست.
echo ====================================================================
echo.
pause
exit /b 0


REM ===================================================================
REM  پایان با خطا
REM ===================================================================
:fail
echo.
echo    [X] خطا. پیام بالا را بررسی کنید.
echo.
pause
exit /b 1