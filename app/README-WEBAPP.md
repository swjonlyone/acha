# 阿茶外食減脂 Web App 原型

## 檔案

- `index.html`：手機優先介面
- `app.js`：Email 登入、每日記錄、月／年檢視、Supabase CRUD
- `supabase-schema.sql`：資料表、索引與 RLS
- `research-health-metrics.md`：飲水、腰臀比與白天／睡一覺體重變化的來源說明
- `assets/acha-avatar.png`：沿用落地頁的吉普力風阿茶人物素材
- `supabase-entitlements.sql`：付款權限表與 RLS
- `supabase/functions/portaly-webhook/index.ts`：接收 Portaly Payment callback 的 Edge Function 範例
- `PORTALY-WEBHOOK-SETUP.md`：部署、測試與費用說明
- `manus-routes.json`：網站路由宣告

## 啟用 Supabase

1. 建立 Supabase project。
2. 在 SQL Editor 執行 `supabase-schema.sql`。
3. 到 Project Settings → API，取得 Project URL 與 anon public key。
4. 開啟網站後，點右上角「設定」，貼上 URL 與 anon key。
5. 註冊 Email 密碼帳號；若 Supabase 開啟 Email confirmation，請先完成驗證信。

本原型不把 Supabase key 寫死在原始碼，設定只存在目前瀏覽器的 localStorage。anon key 可放在前端，但絕對不要放 service_role key。

## 目前功能

- Email 註冊、登入、登出
- 今日打卡：早晚體重、腰圍、三餐詳細食物、份量、飲料、外食餐數
- 運動、飲水、睡眠、排便、心情與備註
- 每日 upsert：同一使用者同一天會更新，不會重複新增
- 每月檢視：平均體重、外食餐數、運動天數、習慣完成率、日期列表
- 年度檢視：每月體重、記錄天數、外食餐數、運動天數
- 健康指標：飲水參考目標（早上體重 × 40 ml）、腰臀比、白天變化、睡一覺變化
- 趨勢圖：橫軸顯示日期／月份，縱軸以 kg 顯示；白天變化與睡一覺變化畫在同一張圖上
- 外食建議順序固定為「蔬菜 → 蛋白質 → 澱粉」，降低閱讀混亂
- 每月每日摘要：早晚體重、日夜體重波動、飲水達成、早睡、排便、運動與餐盤比例
- RLS：每位使用者只能查閱自己的 daily_logs

## 健康指標聲明

數值只供自己觀察，畫面上標「僅供參考」。白天變化與睡一覺變化是體重晃動，不是診斷。飲水與腰臀比的來源說明見 `research-health-metrics.md`。

如果 Supabase 已經建立舊版 `daily_logs`，請重新在 SQL Editor 執行更新後的 `supabase-schema.sql`，其中的 `alter table ... add column if not exists` 會補上臀圍、身高、年齡與參考性別欄位。

## Portaly 付款權限

目前登入頁原型尚未強制付款權限；要上線販售時，先執行 `supabase-entitlements.sql`，再依 `PORTALY-WEBHOOK-SETUP.md` 部署 `portaly-webhook` Edge Function。付款完成後由 Portaly callback 寫入 `entitlements`，前端再呼叫 `has_active_acha_entitlement()`，只有 active 使用者才可進入工作台。

## 本機預覽

```bash
python3 -m http.server 8001 --bind 0.0.0.0
```

然後開啟 `/index.html`。沒有 Supabase 設定時，畫面會保留示範 UI，但不能真正登入或同步雲端資料。
