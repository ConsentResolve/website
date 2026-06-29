# Consent Resolve — CRM End-to-End Test Plan

Tests every path a real HVAC prospect can take and confirms they all land in **one
contact record** in the CRM: cold email → reply, email click → landing → demo form,
live chat, and the unified Contact 360.

## Before you start (read once)
- **Spam:** the cold email comes from a new sending domain — check **Spam/Promotions** and mark "Not spam" if it's there.
- **Use the SAME email everywhere.** For the "everything ties to one record" test, reply / fill the demo form / start the chat all with the **same address** (e.g. the test inbox). Different emails = different contacts (which is fine, just not the unified view).
- **Same browser, accept cookies:** do the browsing + chat in one browser, and **accept the cookie banner** — the chat and visitor-stitching only run after consent (by design).
- **Timing:** email reply → CRM within ~5 min (instant if the reply webhook is on); demo form → instant; chat → appears when opened in the CRM.
- **CRM access:** only Aaron / Tyler / Andy / Jason can open `consentresolve.com/crm` (company Google login).

---

## 👤 Customer side (the tester) — do these in order
**1. Browse first (sets your anonymous visitor id):** open `consentresolve.com`, accept the cookie banner, click around 2–3 pages (e.g. `/hvac-leads/`, pricing).

**2. Cold email → click → landing → demo form:**
- Open the cold email (check Spam), click the **link** in it → you land on **`/hvac-leads/`**.
- Click **"See it work on yourself →"** → fill out the **demo form** (name, email — *same address*, business name, trade = HVAC, phone, check the consent box) → **Submit**.

**3. Reply to the cold email** from your inbox — any message ("Interested, what's the catch?").

**4. Live chat:**
- Click the **chat bubble** (bottom-right). It will ask for your **Name + Email before starting** — that's expected (no anonymous chats). Use the **same email**.
- Send a message ("Quick question about pricing"). Then **close the tab** (so we can also test the offline reply).

---

## 🧑‍💼 CRM side (Aaron / Tyler / Andy / Jason)
1. Go to **`consentresolve.com/crm`** → sign in with Google → you're on **Inbox**.
2. You should see the tester's activity arrive as conversations (each tagged by channel):
   - **demo_form** — from the form submit (instant)
   - **Crisp** — the live chat
   - **Instantly** — their cold-email reply (within ~5 min)
3. Open the **Crisp** chat → you'll see the transcript → type a reply → **Send** (since they closed the tab, Crisp emails it to them — confirm they receive it).
4. Open the **Instantly** conversation → reply from the CRM → confirm the tester gets it.
5. Click **"full history →"** on the contact → confirm the **Contact 360**:
   - All three conversations (email / chat / demo) under **one contact** (same email)
   - **Timeline** shows their **pageviews ("👁 viewed /hvac-leads")** + chat + demo + email reply, in order
   - Rollup stats (channels, touches, speed-to-lead)
6. Open **Analytics** → confirm the **source/vertical attribution** shows the `instantly` / `hvac_2026` activity.

---

## ✅ Success checklist
- [ ] Cold email received (note if Spam) and the link opened `/hvac-leads/`
- [ ] Demo form submit created a contact + `demo_form` conversation
- [ ] Cold-email reply appeared in `/crm` Inbox (note how long it took)
- [ ] Live chat required name+email, then showed up in the CRM with its transcript
- [ ] Reply-from-CRM worked for both the chat (offline → emailed) and the email
- [ ] **Contact 360 ties email + chat + demo + pageviews to ONE record**
- [ ] Analytics shows the instantly / hvac_2026 source

## Report back
Reply with ✅/❌ per item, plus anything off (wrong name, missing message, long delay, landed in spam, chat didn't require email, history didn't merge). If a cold-email reply doesn't appear after ~5 min, ping Aaron.
