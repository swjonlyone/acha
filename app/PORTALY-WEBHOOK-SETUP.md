# Portaly Webhook 自動開通設定

## 這個功能要不要錢？

程式碼本身不另外收費。Supabase 有免費方案，通常足以支撐小量測試與剛開始的 NT$99 數位產品；但免費方案有用量上限，正式販售前請以 Supabase Pricing 頁面當下公告為準。Portaly Payment 官方文章目前列出基本方案 NT$0、交易抽成 12%，以及頂級方案 NT$219／月、交易抽成 6%；實際方案與費率仍應以 Portaly 後台最新頁面為準。付款本身的金流／平台費用不等於 Supabase Edge Function 費用。

如果使用 Portaly Payment，需要建立 Test API Key 先測試，正式收款則換成 Live API Key。這個範例只處理付款完成 callback，不在前端保存 Portaly API Key。

## 建立資料表

在 Supabase SQL Editor 執行：

```sql
-- 複製本專案的 supabase-entitlements.sql 內容執行
```

## 部署 Edge Function

需要安裝並登入 Supabase CLI，並先取得 Project Reference ID：

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set \
  SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
  PORTALY_CALLBACK_SECRET=YOUR_CALLBACK_SECRET
supabase functions deploy portaly-webhook --no-verify-jwt
```

Webhook URL：

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/portaly-webhook
```

`SUPABASE_SERVICE_ROLE_KEY` 只能放在 Edge Function secret，不能貼到 `index.html`、`app.js`、GitHub 或 Portaly 前端欄位。

## Portaly 後台

在 Portaly Payment／商品 Webhook 設定中，先使用 Test 模式，把上面的 URL 貼到付款完成 callback／Webhook URL，並使用同一組 Callback Secret。測試成功後再換 Live 模式。

本範例會從常見欄位尋找：

- buyer email：`email`、`customer_email`、`buyer_email` 或巢狀 customer/buyer email
- order id：`order_id`、`transaction_id` 或 checkout session id
- status：付款完成會寫入 `active`；退款、取消、失敗會寫入 `revoked`

Portaly 的實際 callback JSON 欄位若不同，請在函式中的 `getEmail`、`getOrderId`、`getStatus`、`getProductCode` 調整對應欄位。先以 Test callback 的實際 JSON 做一次對照，不要猜欄位名稱。

## 測試

```bash
curl -i -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/portaly-webhook' \
  -H 'content-type: application/json' \
  -H 'x-portaly-callback-secret: YOUR_CALLBACK_SECRET' \
  -d '{
    "event": "payment.completed",
    "order_id": "test-order-001",
    "email": "buyer@example.com",
    "amount": 99,
    "product_code": "acha-365-outdoor-fatloss",
    "status": "paid"
  }'
```

成功後，`public.entitlements` 應有一筆 `active` 紀錄。客戶用同一個 Email 登入時，前端再呼叫：

```js
const { data, error } = await supabase.rpc('has_active_acha_entitlement');
if (error || !data) {
  // 顯示「尚未找到有效購買紀錄」並阻止進入工作台
}
```

## 上線前必做

1. 先用 Test API Key 和測試付款驗證一次。
2. 確認 callback 的 Email 與客戶之後登入的 Email 完全一致。
3. 確認退款／取消通知會把權限改成 `revoked`。
4. 確認資料表 RLS 開啟，且前端沒有 service role key。
5. 確認成功 callback 可重送而不會產生重複權限；本範例以 `order_id` 去重。
