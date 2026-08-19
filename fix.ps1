
$content = Get-Content "admin-app\app\src\main\java\com\aboakbar\admin\MainActivity.kt" -Raw
$content = $content -replace "(?s)// ??? ???? ???? ?????.*?screenshotOverlay.alpha = 1f\s*}", ""
$content = $content -replace "(?s)// ????? ??????? ??? ????.*?\}, 400\)", ""
$content = $content -replace "mainLayout.setBackgroundColor\(android.graphics.Color.WHITE\)", ""
Set-Content "admin-app\app\src\main\java\com\aboakbar\admin\MainActivity.kt" -Value $content

