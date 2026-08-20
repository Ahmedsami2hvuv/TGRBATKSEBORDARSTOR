@echo off
echo ========================================================
echo  جاري الاتصال بخوادم إكسبو السحابية لبناء تطبيقك (APK)
echo ========================================================
echo.
echo سيتم الآن سؤالك سؤالا واحدا عن إنشاء مفتاح أمان (Keystore)
echo فقط اضغط على حرف Y ثم زر Enter للموافقة.
echo.
set EXPO_TOKEN=WyEMEtb5jwmZY7KlYJOxI7mFPJEiHeV0S6d2DyqE
npx eas-cli build -p android --profile preview
pause
