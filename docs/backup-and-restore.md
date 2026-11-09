# Backup & restore (Chromebook / Windows / phone)

_Haan — JSON backup download hota hai, aur usi file se **kisi bhi** device par poora data wapas aata hai. Ye page: kahan jata hai, kya kya andar hota hai, aur kaise restore karein._

---

## 1. Backup lena (30 second)

1. App kholein → **Settings → Database** tab.
2. **Export Full Backup** dabayein.
3. Browser file download kar deta hai:

   ```
   TheGymTown_Backup_2026-11-06_14-32.json     (~200 KB – 2 MB)
   ```

**Chromebook par file kahan jati hai?**

| ChromeOS | Path |
| --- | --- |
| Files app | **Downloads** (ya "My files → Downloads") |
| Download shelf | neeche/download icon → "Show in folder" |

Browser download ko block nahi karta — yeh normal file download hai, koi pop-up/plugin nahi chahiye. Settings screen par export ke baad confirmation bhi dikhta hai: file ka naam + size, aur "Google Drive mein copy rakhein".

> ⚠️ Chromebook **Powerwash** / "Clear browsing data" / doosra user account → app ka data khatam. JSON file hi wo cheez hai jo bachati hai — is liye usay turant **Google Drive** mein daal dein (Files app → drag into Drive folder, ya drive.google.com → New → File upload).

## 2. File mein kya kya hota hai

Ek hi JSON file mein **sab kuch**:

- members + removed members (removal date ke saath), plans
- fee ledger (month-wise), receipts/payments
- attendance, door logs, notifications
- expenses, **inventory products, stock, POS sales, stock purchases, suppliers**
- station settings (address, receipt terms, theme), audit log

Isi liye restore ke baad app **bilkul waisa** ho jata hai — balances aur statuses dobara calculate ho jate hain.

## 3. Restore (naye device ya data clear hone ke baad)

1. App kholein (usi Chromebook par, ya kisi bhi laptop/phone par).
2. **Settings → Database → Restore from Backup → Choose Backup File**.
3. Downloaded `.json` file select karein → confirm.
4. Message aata hai: *"Backup restored — N members, N ledger entries, …"*.

Purani (sirf-members wali) backup files bhi chalti hain — unka ledger history se dobara bana diya jata hai.

## 4. Kitni baar backup lein

| Kab | Kyun |
| --- | --- |
| **Hafte mein ek dafa** (fixed din, jaise Ravivar) | Maximum 7 din ka loss |
| Bade kaam se pehle (bulk enrollment, price change, update) | Rollback point |
| Naya laptop / Powerwash se pehle | Migration |
| Vercel par naya deploy karne se pehle | Safe cutover |

Settings screen khud yaad dilata hai: *"Aakhri backup 9 din pehle liya gaya — dobara le lein"* (7 din se zyada ho to warning amber ho jati hai).

## 5. Backup vs Cloud sync — dono ka apna kaam

| | JSON backup | Cloud auto-sync |
| --- | --- | --- |
| Kya bachata hai | Poora data, ek file mein | Data + **3 device ek saath** |
| Kab kaam aata hai | Sab kuch kharab ho jaye (disaster) | Roz-marra (desk band ho, phone se dekhna) |
| Setup | Kuch nahi | Upstash Redis + `SYNC_SECRET` (doc: `database-integration-plan.md` §10.1) |
| Risk | Bhoolna | — |

**Best practice: dono.** Cloud sync roz ka kaam sambhalta hai, JSON backup aakhri sahara hai. Ek doosre ka replacement nahi.

## 6. File ki hifazat

- JSON mein member ke **naam, phone, CNIC, payments** sab hote hain — is liye:
  - Google Drive mein **private folder** rakhein (public link na banayein),
  - WhatsApp par forward na karein,
  - backup ki 2–3 copies (Drive + pen drive) rakhein, purani copies delete karte rahein.
- File ko text editor se edit **na** karein — restore fail ho sakta hai.

## 7. Agar galti se galat file restore ho jaye

Restore se pehle app **khud** current data ki ek copy `tgt_pre_restore` naam se browser storage mein rakh deta hai. Phir bhi sab se safe tareeqa: restore se pehle ek fresh **Export Full Backup** le lein — usi se wapas ja sakte hain.
