# ✅ Verification Guide - RefetchOnWindowFocus

## 🧪 How to Verify the Fix Works

### Test 1: Verify No Page Reload on Focus

1. **Open your app** in browser
2. **Open DevTools** (F12) → Console tab
3. **Type this command:**
   ```javascript
   window.performance.navigation.type
   ```
   Expected result: `0` (TYPE_NAVIGATE)

4. **Switch to another tab** (e.g., Google)
5. **Wait 35 seconds** (more than staleTime of 30s)
6. **Switch back to your app**
7. **Type again:**
   ```javascript
   window.performance.navigation.type
   ```
   ✅ Expected result: `0` (still 0, meaning NO reload occurred)
   ❌ If result is `1` (TYPE_RELOAD) = page reload happened (fix didn't work)

---

### Test 2: Verify Smart Refetch Behavior

#### Scenario A: Return within 30 seconds (should use cache)

1. Open **Students page**
2. Open DevTools → **Network tab**
3. Switch to another tab
4. Wait **20 seconds** (less than staleTime)
5. Switch back to Students page
6. **Check Network tab:**
   - ✅ Should see **NO new requests** to `/students`
   - ✅ Data loads instantly from cache
   - ✅ Console shows: `⚡ [QueryClient] Tab visible - fast refresh`

#### Scenario B: Return after 30+ seconds (should refetch)

1. Open **Students page**
2. Open DevTools → **Network tab**
3. Switch to another tab
4. Wait **35 seconds** (more than staleTime)
5. Switch back to Students page
6. **Check Network tab:**
   - ✅ Should see **ONE new request** to `/students`
   - ✅ Old data shows immediately (placeholderData)
   - ✅ New data replaces it when loaded
   - ✅ No page flash or white screen

---

### Test 3: Verify No Full Page Reload

**What to watch for:**

❌ **Signs of Page Reload (BAD):**
- White flash when returning to tab
- All assets reload in Network tab (CSS, JS, images)
- Scroll position lost
- Modal/dialog closes unexpectedly
- Form inputs cleared
- Console shows: `🔄 Triggering RealtimeEngine resync...` followed by full reload

✅ **Signs of Proper Refetch (GOOD):**
- No white flash
- Only data requests in Network tab (no CSS/JS reload)
- Scroll position maintained
- Modals stay open
- Form inputs preserved
- Console shows: `⚡ [QueryClient] Tab visible - fast refresh`

---

### Test 4: Verify Real-time Channels Recovery

1. Open app and navigate to any page
2. Open DevTools → Console
3. Switch to another tab for 1 minute
4. Switch back
5. **Check console logs:**

✅ Expected logs (correct behavior):
```
⚡ [QueryClient] Tab visible - fast refresh
👁️ [RealtimeEngine] Tab became visible, checking connections...
📊 Resync status: 5/5 channels healthy
✅ Health check and resync complete
```

❌ Bad logs (should NOT appear):
```
⚠️ Too many unhealthy channels, forcing page reload...
[Page reload indicators]
```

---

## 🔍 Code Verification

### Check 1: Verify HealthMonitor Doesn't Reload

Open: `src/components/HealthMonitor.tsx`

Search for: `window.location.reload`

✅ Should find it ONLY in these places:
- Line ~191: Manual reload button (user-initiated, OK)

❌ Should NOT find it in:
- `handleFocusOrVisible` function
- Automatic recovery logic

**Correct code (line ~92):**
```typescript
// If less than 50% of channels are healthy, log warning but DON'T reload page
if (totalChannels > 0 && healthyChannels < totalChannels * 0.5) {
  console.warn(`⚠️ Low healthy channels: ${healthyChannels}/${totalChannels}. RealtimeEngine will auto-recover.`);
  // Don't force reload - let RealtimeEngine handle reconnection
}
```

---

### Check 2: Verify QueryClient Settings

Open: `src/lib/queryClient.ts`

Verify these settings (around line 106-116):

```typescript
refetchOnWindowFocus: true,        // ✅ Must be true
refetchOnMount: true,              // ✅ Must be true
refetchOnReconnect: true,          // ✅ Must be true
staleTime: 1000 * 30,             // ✅ 30 seconds (not too long)
placeholderData: (previousData: any) => previousData,  // ✅ Instant UI
```

---

### Check 3: Verify All Hooks Have refetchOnWindowFocus

Run this search in your code editor:

```
grep -r "refetchOnWindowFocus" src/hooks/queries/
```

✅ All hooks should have: `refetchOnWindowFocus: true`

Expected files:
- ✅ useStudents.ts
- ✅ useTeachers.ts
- ✅ useParents.ts
- ✅ useClasses.ts
- ✅ useNotifications.ts
- ✅ useFees.ts
- ✅ useComplaints.ts
- ✅ useStats.ts
- ✅ useCurriculum.ts
- ✅ useProfile.ts
- ✅ useParentDashboard.ts
- ✅ useBranding.ts

---

## 📊 Performance Metrics to Verify

### Measure Load Time on Return:

```javascript
// Run in console when returning to tab
const timing = performance.getEntriesByType('navigation')[0];
console.log('Page load time:', timing.duration, 'ms');
```

✅ Expected with refetchOnWindowFocus:
- Return within 30s: < 50ms (from cache)
- Return after 30s: 200-500ms (data refetch only)

❌ Bad (indicates page reload):
- Any return: 1000-3000ms (full page load)

---

### Measure Data Transfer:

Open DevTools → Network tab → Clear → Switch tabs → Return

✅ Expected:
- Small transfer (JSON data only): 5-50 KB
- 1-2 requests (data queries)

❌ Bad:
- Large transfer (all assets): 500 KB - 2 MB
- 20+ requests (HTML, CSS, JS, images)

---

## ✅ Success Criteria

The fix is working correctly if:

1. ✅ `window.performance.navigation.type` stays `0` after returning to tab
2. ✅ No white flash when returning to tab
3. ✅ Scroll position is maintained
4. ✅ Only data requests in Network tab (no asset reload)
5. ✅ Console shows refetch logs, NOT reload logs
6. ✅ Data updates smoothly without page flash
7. ✅ Form inputs and modals are preserved
8. ✅ Load time < 50ms (cache) or < 500ms (refetch)

---

## 🐛 Troubleshooting

### Issue: Page still reloads on focus

**Check:**
1. Search entire codebase for `window.location.reload()`
2. Check if any event listener calls it on `visibilitychange`
3. Verify HealthMonitor doesn't have reload in automatic handlers

**Fix:**
- Remove any automatic `window.location.reload()` calls
- Keep only user-initiated reload buttons

---

### Issue: Data doesn't update on return

**Check:**
1. Verify `refetchOnWindowFocus: true` in queryClient.ts
2. Verify `staleTime` is not too long (should be 30s or less)
3. Check browser console for errors

**Fix:**
```typescript
// In queryClient.ts
refetchOnWindowFocus: true,
staleTime: 1000 * 30, // 30 seconds
```

---

### Issue: Too many requests on return

**Check:**
1. Verify `staleTime` is set correctly
2. Check if multiple visibilitychange handlers exist
3. Verify queries aren't being invalidated multiple times

**Fix:**
- Consolidate visibility handlers
- Increase staleTime if needed
- Use `invalidateQueries` with specific query keys

---

## 📝 Summary

| Test | Expected Result | Status |
|------|----------------|--------|
| No page reload | `performance.navigation.type === 0` | ⬜ |
| Smart refetch | Only data requests, no assets | ⬜ |
| Fast load | < 50ms (cache) or < 500ms (refetch) | ⬜ |
| State preserved | Scroll, forms, modals intact | ⬜ |
| Console logs | Refetch logs, no reload logs | ⬜ |
| All hooks configured | `refetchOnWindowFocus: true` | ⬜ |

**Run all tests and mark status as ✅ when verified.**
