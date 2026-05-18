---
title: "Ask Me Anything"
date: 2026-05-18
draft: false
---

<p>
Ask me anything — chemistry, AI4Science, grad school, life on the road, whatever. Submissions are private until I reply publicly here. Optional email lets me reply privately when the question isn't suitable for a public answer.
</p>

<p>
有问必（尽量）答。提问后只有我公开回复才会在下面展示。留邮箱（可选）的话，不便公开的内容我会私信回。
</p>

<div id="ama-app">
  <section class="ama-submit">
    <h3>Ask a question</h3>
    <label>Question
      <textarea id="ama-question" maxlength="1000" rows="4" placeholder="Type your question here"></textarea>
    </label>
    <div class="ama-row">
      <label>Name <span class="ama-hint">optional · shows publicly</span>
        <input id="ama-name" type="text" maxlength="32" autocomplete="off" placeholder="leave blank to stay anonymous">
      </label>
      <label>Email <span class="ama-hint">optional · for private reply only</span>
        <input id="ama-email" type="email" maxlength="128" autocomplete="off" placeholder="never shown publicly">
      </label>
    </div>
    <button id="ama-submit-btn" type="button">Submit</button>
    <div class="ama-result" id="ama-submit-result"></div>
  </section>

  <section class="ama-feed">
    <h3>Answered</h3>
    <div id="ama-feed-status" class="ama-hint">Loading…</div>
    <ol id="ama-feed-list"></ol>
  </section>
</div>

<style>
#ama-app {
  margin-top: 1.5em;
  max-width: 720px;
}
#ama-app h3 {
  font-size: 1.1em;
  margin: 1.5em 0 0.6em;
  border-bottom: 1px solid var(--border, #e5e5e5);
  padding-bottom: 0.3em;
}
.ama-submit label, .ama-feed label {
  display: block;
  margin-bottom: 0.85em;
  font-size: 0.9em;
  color: var(--secondary, #666);
}
.ama-hint {
  font-size: 0.8em;
  color: #999;
  font-weight: normal;
  margin-left: 0.3em;
}
.ama-row {
  display: flex;
  gap: 1em;
  flex-wrap: wrap;
}
.ama-row label { flex: 1; min-width: 220px; }
#ama-app input[type="text"], #ama-app input[type="email"], #ama-app textarea {
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
#ama-app textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}
#ama-app input:focus, #ama-app textarea:focus {
  outline: none;
  border-color: var(--primary, #1a1a1a);
}
#ama-app button {
  padding: 0.55em 1.2em;
  background: var(--primary, #1a1a1a);
  color: var(--theme, #fff);
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95em;
  font-family: inherit;
}
#ama-app button:disabled { opacity: 0.5; cursor: not-allowed; }
.ama-result {
  margin-top: 1em;
  padding: 0.8em 1em;
  border-radius: 4px;
  font-size: 0.92em;
  display: none;
  word-break: break-word;
}
.ama-result.is-visible { display: block; }
.ama-result.is-ok    { background: #e8f5e9; color: #1b5e20; }
.ama-result.is-info  { background: #e3f2fd; color: #0d47a1; }
.ama-result.is-error { background: #ffebee; color: #b71c1c; }
@media (prefers-color-scheme: dark) {
  .ama-result.is-ok    { background: #1b3a1f; color: #b8e3bc; }
  .ama-result.is-info  { background: #18324e; color: #b9d6f5; }
  .ama-result.is-error { background: #4a1f23; color: #f3b0b5; }
  .ama-hint { color: #777; }
}
#ama-feed-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.ama-item {
  padding: 1em 0;
  border-bottom: 1px solid var(--border, #ececec);
}
.ama-item:last-child { border-bottom: 0; }
.ama-q {
  font-weight: 600;
  white-space: pre-wrap;
  margin: 0 0 0.4em;
  color: var(--primary, #1a1a1a);
}
.ama-meta {
  font-size: 0.8em;
  color: var(--secondary, #888);
  margin-bottom: 0.6em;
}
.ama-a {
  white-space: pre-wrap;
  margin: 0;
  color: var(--primary, #1a1a1a);
  line-height: 1.55;
}
</style>

<script>
(function () {
  const API_BASE = "https://match.junren.li";

  const $ = (id) => document.getElementById(id);

  function showResult(el, kind, text) {
    el.className = "ama-result is-visible is-" + kind;
    el.textContent = text;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function formatDate(ms) {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  async function loadFeed() {
    const statusEl = $("ama-feed-status");
    const listEl = $("ama-feed-list");
    try {
      const res = await fetch(API_BASE + "/ama/list");
      const data = await res.json();
      const rows = data.rows || [];
      if (rows.length === 0) {
        statusEl.textContent = "No answered questions yet.";
        listEl.innerHTML = "";
        return;
      }
      statusEl.style.display = "none";
      listEl.innerHTML = rows.map((r) => (
        '<li class="ama-item">' +
          '<p class="ama-q">' + escapeHtml(r.question) + '</p>' +
          '<div class="ama-meta">' +
            (r.name ? escapeHtml(r.name) : "anonymous") +
            ' · answered ' + formatDate(r.answered_at) +
          '</div>' +
          '<p class="ama-a">' + escapeHtml(r.answer || "") + '</p>' +
        '</li>'
      )).join("");
    } catch (e) {
      statusEl.textContent = "Failed to load.";
    }
  }

  $("ama-submit-btn").addEventListener("click", async () => {
    const btn = $("ama-submit-btn");
    const out = $("ama-submit-result");
    const q = $("ama-question").value.trim();
    const n = $("ama-name").value.trim();
    const e = $("ama-email").value.trim();
    if (!q) {
      showResult(out, "error", "Please write a question.");
      return;
    }
    btn.disabled = true;
    showResult(out, "info", "Submitting…");
    const payload = { question: q };
    if (n) payload.name = n;
    if (e) payload.email = e;
    try {
      const res = await fetch(API_BASE + "/ama/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error === "invalid_question" ? "Question is empty or too long (max 1000 chars)."
                  : data.error === "invalid_email"    ? "Email format looks wrong."
                  : data.error === "invalid_name"     ? "Name is too long (max 32 chars)."
                  : ("Submission failed: " + (data.error || "unknown"));
        showResult(out, "error", msg);
      } else {
        showResult(out, "ok", "Thanks — your question is in. I'll reply here when I get to it (or privately if you left an email and the answer isn't public-friendly).");
        $("ama-question").value = "";
        $("ama-name").value = "";
        $("ama-email").value = "";
      }
    } catch (err) {
      showResult(out, "error", "Network error. Please try again.");
    } finally {
      btn.disabled = false;
    }
  });

  loadFeed();
})();
</script>
