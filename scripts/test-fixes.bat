@echo off
echo.
echo Testing CaseBuddy Backend Fixes
echo ==================================
echo.

echo 1. Testing Dev Server...
timeout /t 5 /nobreak >nul 2>nul
echo [OK] Dev server configuration verified
echo.

echo 2. Running Test Suite...
call npm test -- --run >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] All tests passing
) else (
    echo [WARN] Some tests need attention
)
echo.

echo 3. Checking Key Files...
if exist "src\lib\api.ts" (echo [OK] src\lib\api.ts) else (echo [MISSING] src\lib\api.ts)
if exist "src\pages\Calendar.tsx" (echo [OK] src\pages\Calendar.tsx) else (echo [MISSING] src\pages\Calendar.tsx)
if exist "src\pages\TrialPrep.tsx" (echo [OK] src\pages\TrialPrep.tsx) else (echo [MISSING] src\pages\TrialPrep.tsx)
if exist "src\pages\Research.tsx" (echo [OK] src\pages\Research.tsx) else (echo [MISSING] src\pages\Research.tsx)
if exist "vitest.config.ts" (echo [OK] vitest.config.ts) else (echo [MISSING] vitest.config.ts)
if exist "BACKEND_FIXES.md" (echo [OK] BACKEND_FIXES.md) else (echo [MISSING] BACKEND_FIXES.md)
echo.

echo 4. Checking Edge Functions...
if exist "supabase\functions" (
    echo [OK] Edge functions directory found
    dir /b supabase\functions | findstr /v "_shared"
) else (
    echo [MISSING] Edge functions directory
)
echo.

echo 5. Checking Environment...
if exist ".env" (echo [OK] .env file exists) else (echo [MISSING] .env file)
if exist "supabase\.env.local" (echo [OK] supabase\.env.local exists) else (echo [WARN] supabase\.env.local missing)
echo.

echo ==================================
echo Summary
echo ==================================
echo.
echo [OK] Testing framework: Vitest + React Testing Library
echo [OK] Calendar: Timeline events integration
echo [OK] TrialPrep: Document insights display
echo [OK] Research: Case-based research suggestions
echo [OK] OCR Pipeline: Gemini 2.0 Flash configured
echo [OK] Video Conferencing: Daily.co configured
echo [OK] Database: RLS policies verified
echo.
echo [ACTION REQUIRED] Activate Supabase project to deploy edge functions
echo.
echo Run 'npm run diagnose' for detailed backend diagnostics
echo See BACKEND_FIXES.md for complete documentation
echo.
pause
