# Quick Reference: Fix 401 Error in send-push-notification

## 🚀 Fast Setup (5 Minutes)

### Step 1: Get Your Service Role Key
1. Go to **Supabase Dashboard** > **Settings** > **API**
2. Copy the **service_role** key (secret, not anon!)

### Step 2: Store in Vault
```sql
CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

INSERT INTO vault.secrets (name, secret)
VALUES (
  'SUPABASE_SERVICE_ROLE_KEY',
  'PASTE_YOUR_SERVICE_ROLE_KEY_HERE'
)
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```

### Step 3: Set Edge Function Secrets
Dashboard > Edge Functions > send-push-notification > Secrets:
```
SUPABASE_URL=https://mecutwhreywjwstirpka.supabase.co
SUPABASE_SERVICE_ROLE_KEY=(same as step 2)
VAPID_PUBLIC_KEY=(your VAPID public key)
VAPID_PRIVATE_KEY=(your VAPID private key)
```

### Step 4: Deploy
```bash
supabase db push
supabase functions deploy send-push-notification
```

### Step 5: Test
```javascript
// In browser console (while logged in)
const { data, error } = await supabase.functions.invoke('send-push-notification', {
  body: {
    user_id: 'YOUR_USER_ID',
    title: 'Test',
    body: 'This is a test notification'
  }
});
console.log(data, error);
```

---

## 📋 Authentication Methods

### 1. User JWT (Frontend)
```typescript
// Automatic with Supabase client
await supabase.functions.invoke('send-push-notification', {
  body: { user_id: '...', body: '...' }
});

// Or manual with fetch
fetch('.../functions/v1/send-push-notification', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ user_id: '...', body: '...' })
});
```

### 2. Service Role (Webhook/Internal)
```sql
-- Webhook automatically uses this from vault
-- No action needed if vault is configured correctly

-- Or in Edge Function secrets
SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

### 3. Anon Key (Fallback)
```bash
# Not recommended but works
curl -X POST ... \
  -H "Authorization: Bearer ANON_KEY" \
  -H "apikey: ANON_KEY" \
  -d '{...}'
```

---

## 🔑 Key Locations

| Key | Where to Find | Where to Store |
|-----|---------------|----------------|
| SUPABASE_URL | Dashboard > Settings > API | Edge Function Secrets |
| SUPABASE_SERVICE_ROLE_KEY | Dashboard > Settings > API (secret) | Vault + Edge Function Secrets |
| VAPID_PUBLIC_KEY | Generate locally | Edge Function Secrets + .env |
| VAPID_PRIVATE_KEY | Generate locally | Edge Function Secrets only |

Generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```

---

## 🐛 Common Errors

### 401 Unauthorized
- ❌ Missing Authorization header
- ❌ Invalid/expired token
- ❌ Service role key not in vault/secrets

**Fix:**
```bash
# Check logs
supabase functions logs send-push-notification

# Verify vault
SELECT name FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
```

### 403 Forbidden
- ❌ Regular user sending to another user

**Fix:** Only admins/teachers can send to others, or use service_role

### 400 Bad Request
- ❌ Missing user_id or body

**Fix:** Include required fields:
```json
{
  "user_id": "uuid-here",
  "body": "Notification text"
}
```

---

## 📊 Monitor

```bash
# Live logs
supabase functions logs send-push-notification

# Check subscriptions
SELECT user_id, COUNT(*) FROM push_subscriptions GROUP BY user_id;

# Clean old subscriptions
SELECT cleanup_expired_subscriptions();
```

---

## 📚 Full Documentation

- **Fix Guide:** [PUSH_NOTIFICATION_FIX_GUIDE.md](./PUSH_NOTIFICATION_FIX_GUIDE.md)
- **Testing Guide:** [PUSH_NOTIFICATION_TESTING.md](./PUSH_NOTIFICATION_TESTING.md)
- **Migration:** [20260426000000_fix_push_notifications_auth.sql](./supabase/migrations/20260426000000_fix_push_notifications_auth.sql)

---

**Last Updated:** 2026-04-26
