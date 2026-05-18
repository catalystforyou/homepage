---
title: "Match"
date: 2026-05-18
draft: false
---

<p>
A tiny mutual-matching widget. Submit your own ID and the ID of someone you'd like to match with. Only when <em>both</em> sides independently submit each other does the system register a match. Submissions stay private otherwise — even from each other.
</p>

<p>
匿名双向匹配小工具：填上你的 ID 和你想配对的人的 ID。只有当对方也填了你的 ID，才会触发匹配；否则双方都不会知道彼此填了什么。
</p>

<ul style="margin-top: 0.5em;">
  <li>Each person can submit at most <strong>3</strong> pairings (active, non-withdrawn).</li>
  <li>After submission you'll receive a <strong>token</strong>. Save it — it is the only way to check your status or withdraw.</li>
  <li>When a match happens, both sides see a notice and can come find me (the site owner) to learn who the other person is. The system itself does <strong>not</strong> reveal identities, so please use an ID the other person can recognise.</li>
</ul>

<div id="match-app">
  <div class="match-tabs" role="tablist">
    <button class="match-tab is-active" data-tab="submit" type="button">Submit</button>
    <button class="match-tab" data-tab="check" type="button">Check</button>
    <button class="match-tab" data-tab="withdraw" type="button">Withdraw</button>
  </div>

  <section class="match-pane is-active" data-pane="submit">
    <label>Your ID
      <input id="m-my-id" type="text" maxlength="64" autocomplete="off" placeholder="e.g. your WeChat / nickname / handle">
    </label>
    <label>Target ID
      <input id="m-target-id" type="text" maxlength="64" autocomplete="off" placeholder="ID of the person you want to match">
    </label>
    <button id="m-submit-btn" type="button">Submit</button>
    <div class="match-result" id="m-submit-result"></div>
  </section>

  <section class="match-pane" data-pane="check">
    <label>Your token
      <input id="m-check-token" type="text" maxlength="64" autocomplete="off" placeholder="paste the token you saved">
    </label>
    <button id="m-check-btn" type="button">Check status</button>
    <div class="match-result" id="m-check-result"></div>
  </section>

  <section class="match-pane" data-pane="withdraw">
    <label>Your token
      <input id="m-withdraw-token" type="text" maxlength="64" autocomplete="off" placeholder="paste the token you saved">
    </label>
    <button id="m-withdraw-btn" type="button">Withdraw this submission</button>
    <div class="match-result" id="m-withdraw-result"></div>
    <p style="font-size: 0.85em; color: #888; margin-top: 0.5em;">
      Withdrawing only hides your submission from your side. If a match has already formed with this submission, the other side will still see it.
    </p>
  </section>
</div>

<style>
#match-app {
  margin-top: 1.5em;
  max-width: 560px;
}
.match-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border, #e5e5e5);
  margin-bottom: 1em;
}
.match-tab {
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 0.5em 1em;
  cursor: pointer;
  font-size: 0.95em;
  color: var(--secondary, #666);
  font-family: inherit;
}
.match-tab.is-active {
  border-bottom-color: var(--primary, #1a1a1a);
  color: var(--primary, #1a1a1a);
  font-weight: 600;
}
.match-pane { display: none; }
.match-pane.is-active { display: block; }
.match-pane label {
  display: block;
  margin-bottom: 0.85em;
  font-size: 0.9em;
  color: var(--secondary, #666);
}
.match-pane input[type="text"] {
  display: block;
  width: 100%;
  margin-top: 0.3em;
  padding: 0.55em 0.7em;
  font-size: 1em;
  border: 1px solid var(--border, #d0d0d0);
  border-radius: 4px;
  background: var(--theme, #fff);
  color: var(--primary, #1a1a1a);
  box-sizing: border-box;
  font-family: inherit;
}
.match-pane input[type="text"]:focus {
  outline: none;
  border-color: var(--primary, #1a1a1a);
}
.match-pane button {
  padding: 0.55em 1.2em;
  background: var(--primary, #1a1a1a);
  color: var(--theme, #fff);
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95em;
  font-family: inherit;
}
.match-pane button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.match-result {
  margin-top: 1em;
  padding: 0.8em 1em;
  border-radius: 4px;
  font-size: 0.92em;
  display: none;
  word-break: break-all;
}
.match-result.is-visible { display: block; }
.match-result.is-ok      { background: #e8f5e9; color: #1b5e20; }
.match-result.is-info    { background: #e3f2fd; color: #0d47a1; }
.match-result.is-warn    { background: #fff3e0; color: #6f4400; }
.match-result.is-error   { background: #ffebee; color: #b71c1c; }
.match-result code {
  font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
  font-size: 1.05em;
  background: rgba(0,0,0,0.06);
  padding: 0.1em 0.35em;
  border-radius: 3px;
  user-select: all;
}
@media (prefers-color-scheme: dark) {
  .match-result.is-ok    { background: #1b3a1f; color: #b8e3bc; }
  .match-result.is-info  { background: #18324e; color: #b9d6f5; }
  .match-result.is-warn  { background: #4a3a1c; color: #f3d59b; }
  .match-result.is-error { background: #4a1f23; color: #f3b0b5; }
}
</style>

<script>
(function () {
  const API_BASE = "https://match.junren.li";

  const $ = (id) => document.getElementById(id);
  const tabs = document.querySelectorAll(".match-tab");
  const panes = document.querySelectorAll(".match-pane");

  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      const name = t.dataset.tab;
      tabs.forEach((x) => x.classList.toggle("is-active", x === t));
      panes.forEach((p) => p.classList.toggle("is-active", p.dataset.pane === name));
    });
  });

  function showResult(el, kind, html) {
    el.className = "match-result is-visible is-" + kind;
    el.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  async function call(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(API_BASE + path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data };
  }

  const ERR = {
    invalid_input: "ID must be 1–64 characters and contain no control characters.",
    invalid_json: "Bad request format.",
    invalid_token: "Token is invalid.",
    self_match: "You can't match yourself.",
    limit_reached: "You've reached the maximum of 3 active submissions. Withdraw one first.",
    duplicate: "You've already submitted this exact pair.",
    not_found: "No submission found for that token.",
    not_found_or_already_withdrawn: "No active submission found for that token (it may already be withdrawn).",
    forbidden: "Not authorized.",
  };

  function errMsg(data) {
    if (!data) return "Network error. Please try again.";
    return ERR[data.error] || ("Unexpected error: " + (data.error || "unknown"));
  }

  // Submit
  $("m-submit-btn").addEventListener("click", async () => {
    const btn = $("m-submit-btn");
    const out = $("m-submit-result");
    const myId = $("m-my-id").value.trim();
    const tgtId = $("m-target-id").value.trim();
    if (!myId || !tgtId) {
      showResult(out, "error", "Please fill in both IDs.");
      return;
    }
    btn.disabled = true;
    showResult(out, "info", "Submitting…");
    const r = await call("POST", "/submit", { my_id: myId, target_id: tgtId });
    btn.disabled = false;
    if (!r.ok) {
      showResult(out, "error", escapeHtml(errMsg(r.data)));
      return;
    }
    const token = r.data.token;
    const matched = r.data.status === "matched";
    const header = matched
      ? "<strong>It's a match!</strong> Please find the site owner to learn who you matched with. "
      : "<strong>Submitted.</strong> No reverse match yet. ";
    showResult(
      out,
      matched ? "ok" : "info",
      header +
        "Save this token — it's the only way to check status or withdraw later.<br><br>" +
        "Token: <code>" + escapeHtml(token) + "</code>"
    );
    $("m-my-id").value = "";
    $("m-target-id").value = "";
  });

  // Check
  $("m-check-btn").addEventListener("click", async () => {
    const btn = $("m-check-btn");
    const out = $("m-check-result");
    const token = $("m-check-token").value.trim();
    if (!token) {
      showResult(out, "error", "Please paste your token.");
      return;
    }
    btn.disabled = true;
    showResult(out, "info", "Checking…");
    const r = await call("GET", "/check?token=" + encodeURIComponent(token));
    btn.disabled = false;
    if (r.status === 404) {
      showResult(out, "error", "No submission found for that token.");
      return;
    }
    if (!r.ok) {
      showResult(out, "error", escapeHtml(errMsg(r.data)));
      return;
    }
    const s = r.data.status;
    if (s === "matched") {
      showResult(out, "ok", "<strong>You have a match!</strong> Please find the site owner to learn who you matched with.");
    } else if (s === "pending") {
      showResult(out, "info", "Submission is active. No match yet.");
    } else if (s === "withdrawn") {
      showResult(out, "warn", "This submission has been withdrawn.");
    } else {
      showResult(out, "error", "Unexpected status: " + escapeHtml(s));
    }
  });

  // Withdraw
  $("m-withdraw-btn").addEventListener("click", async () => {
    const btn = $("m-withdraw-btn");
    const out = $("m-withdraw-result");
    const token = $("m-withdraw-token").value.trim();
    if (!token) {
      showResult(out, "error", "Please paste your token.");
      return;
    }
    if (!confirm("Withdraw this submission? This cannot be undone.")) return;
    btn.disabled = true;
    showResult(out, "info", "Withdrawing…");
    const r = await call("POST", "/withdraw", { token });
    btn.disabled = false;
    if (!r.ok) {
      showResult(out, "error", escapeHtml(errMsg(r.data)));
      return;
    }
    showResult(out, "ok", "Withdrawn.");
    $("m-withdraw-token").value = "";
  });
})();
</script>
