# Temporary CORS Workaround

If edge function CORS is blocking requests during development, you can test OCR locally with CORS disabled:

## For Chrome:
1. Close ALL Chrome windows
2. Run Chrome with CORS disabled:
   ```
   chrome.exe --disable-web-security --user-data-dir="C:/temp/chrome-cors-bypass"
   ```
3. Visit your app URL (e.g., http://localhost:8080)
4. Try OCR - it should work

## For Firefox:
1. Type `about:config` in address bar
2. Search for `security.fileuri.strict_origin_policy`
3. Set to `false`
4. Restart Firefox

**WARNING: Only use this for testing. Re-enable CORS when done!**
