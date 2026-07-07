#!/bin/bash
# Script to make case-documents bucket public
# This fixes the "Bucket not found" 404 errors when viewing documents

SUPABASE_URL="https://rerbrlrxptnusypzpghj.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlcmJybHJ4cHRudXN5cHpwZ2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NDY3OTYsImV4cCI6MjA4NDEyMjc5Nn0.Nh-GGojbvPofujqJnn186ftX4oFzchSy1WJus3JI-Sc"

echo "🔧 Applying storage bucket fix..."
echo ""

# Use Supabase REST API to execute SQL
curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "UPDATE storage.buckets SET public = true WHERE id = '"'"'case-documents'"'"';"
  }'

echo ""
echo "✅ Fix applied!"
echo ""
echo "Note: If you get an error, apply this SQL manually:"
echo "1. Go to: https://app.supabase.com/project/rerbrlrxptnusypzpghj/editor/sql"
echo "2. Run: UPDATE storage.buckets SET public = true WHERE id = 'case-documents';"
