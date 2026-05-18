---
title: "MolSketch"
date: 2026-05-18
draft: false
---

<p>
Paste a SMILES, edit the structure, export as SMILES / InChI / MOL block. Convenience tool I built so I don't have to spin up a script every time I want to eyeball a molecule.
</p>

<p>
粘贴 SMILES、编辑分子、导出为 SMILES / InChI / MOL block。给自己写的一个小工具，省得每次想可视化一个分子还得跑脚本。
</p>

<div id="mol-app">
  <div class="mol-row">
    <label class="mol-grow">Input SMILES
      <input id="mol-input" type="text" autocomplete="off" placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O">
    </label>
    <div class="mol-btn-col">
      <button id="mol-load-btn" type="button">Load</button>
      <button id="mol-clear-btn" type="button" class="mol-secondary">Clear</button>
    </div>
  </div>
  <div id="jsme_container" class="mol-editor"></div>
  <div class="mol-out-grid">
    <label>SMILES
      <div class="mol-out-row">
        <input id="mol-out-smiles" type="text" readonly>
        <button data-copy="mol-out-smiles" type="button" class="mol-copy">Copy</button>
      </div>
    </label>
    <label>InChI
      <div class="mol-out-row">
        <input id="mol-out-inchi" type="text" readonly>
        <button data-copy="mol-out-inchi" type="button" class="mol-copy">Copy</button>
      </div>
    </label>
    <label>InChIKey
      <div class="mol-out-row">
        <input id="mol-out-inchikey" type="text" readonly>
        <button data-copy="mol-out-inchikey" type="button" class="mol-copy">Copy</button>
      </div>
    </label>
    <label>MOL block
      <div class="mol-out-row">
        <textarea id="mol-out-mol" rows="6" readonly></textarea>
        <button data-copy="mol-out-mol" type="button" class="mol-copy">Copy</button>
      </div>
    </label>
  </div>
  <div class="mol-row">
    <button id="mol-read-btn" type="button">Read from editor</button>
    <span id="mol-status" class="mol-hint"></span>
  </div>
  <p class="mol-credit">Molecule editing powered by <a href="https://jsme-editor.github.io/" target="_blank" rel="noopener">JSME</a> (Peter Ertl &amp; Bruno Bienfait).</p>
</div>

<style>
#mol-app { margin-top: 1.5em; max-width: 760px; }
.mol-row { display: flex; gap: 0.8em; align-items: end; margin-bottom: 1em; flex-wrap: wrap; }
.mol-grow { flex: 1; min-width: 240px; }
.mol-btn-col { display: flex; gap: 0.5em; }
#mol-app label {
  display: block;
  font-size: 0.9em;
  color: var(--secondary, #666);
}
#mol-app input[type="text"], #mol-app textarea {
  display: block;
  width: 100%;
  margin-top: 0.3em;
  padding: 0.5em 0.7em;
  font-size: 0.95em;
  border: 1px solid var(--border, #d0d0d0);
  border-radius: 4px;
  background: var(--theme, #fff);
  color: var(--primary, #1a1a1a);
  box-sizing: border-box;
  font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
}
#mol-app textarea { font-size: 0.85em; resize: vertical; }
#mol-app input:focus, #mol-app textarea:focus { outline: none; border-color: var(--primary, #1a1a1a); }
#mol-app button {
  padding: 0.5em 1em;
  background: var(--primary, #1a1a1a);
  color: var(--theme, #fff);
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  font-family: inherit;
  white-space: nowrap;
}
#mol-app button.mol-secondary {
  background: transparent;
  color: var(--primary, #1a1a1a);
  border: 1px solid var(--border, #d0d0d0);
}
#mol-app button:disabled { opacity: 0.5; cursor: not-allowed; }
.mol-editor {
  width: 100%;
  height: 420px;
  border: 1px solid var(--border, #d0d0d0);
  border-radius: 4px;
  background: #fff;
  margin-bottom: 1em;
  overflow: hidden;
}
.mol-out-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8em;
  margin-bottom: 1em;
}
.mol-out-row {
  display: flex;
  gap: 0.5em;
  align-items: stretch;
}
.mol-out-row input, .mol-out-row textarea { flex: 1; }
.mol-out-row button { align-self: stretch; }
.mol-hint { font-size: 0.85em; color: var(--secondary, #888); }
.mol-credit { font-size: 0.8em; color: var(--secondary, #888); margin-top: 1.5em; }
@media (max-width: 480px) {
  .mol-editor { height: 360px; }
}
</style>

<script src="https://jsme-editor.github.io/dist/jsme/jsme.nocache.js"></script>
<script>
(function () {
  let jsmeApplet = null;

  // JSME calls this when it's ready
  window.jsmeOnLoad = function () {
    jsmeApplet = new JSApplet.JSME("jsme_container", "100%", "100%", {
      options: "newlook,useopenchemlib,polarnitro",
    });
    document.getElementById("mol-status").textContent = "Editor ready.";
  };

  const $ = (id) => document.getElementById(id);

  function setStatus(msg) {
    const el = $("mol-status");
    el.textContent = msg;
    if (msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 3000);
  }

  function ensureReady() {
    if (!jsmeApplet) {
      setStatus("Editor still loading — please wait a moment.");
      return false;
    }
    return true;
  }

  $("mol-load-btn").addEventListener("click", () => {
    if (!ensureReady()) return;
    const smiles = $("mol-input").value.trim();
    if (!smiles) { setStatus("Paste a SMILES first."); return; }
    try {
      jsmeApplet.readGenericMolecularInput(smiles);
      setStatus("Loaded.");
      readFromEditor();
    } catch (e) {
      setStatus("Couldn't parse that SMILES.");
    }
  });

  $("mol-clear-btn").addEventListener("click", () => {
    if (!ensureReady()) return;
    jsmeApplet.reset();
    $("mol-out-smiles").value = "";
    $("mol-out-inchi").value = "";
    $("mol-out-inchikey").value = "";
    $("mol-out-mol").value = "";
    setStatus("Cleared.");
  });

  function readFromEditor() {
    if (!ensureReady()) return;
    try {
      $("mol-out-smiles").value = jsmeApplet.smiles() || "";
    } catch (_) { $("mol-out-smiles").value = ""; }
    try {
      $("mol-out-mol").value = jsmeApplet.molFile() || "";
    } catch (_) { $("mol-out-mol").value = ""; }

    // InChI may be async on newer JSME builds; try sync first, then async callback form.
    let inchi = "";
    try {
      if (typeof jsmeApplet.inchi === "function") {
        inchi = jsmeApplet.inchi() || "";
      }
    } catch (_) {}
    if (inchi) {
      $("mol-out-inchi").value = inchi;
      try { $("mol-out-inchikey").value = jsmeApplet.inchiKey ? (jsmeApplet.inchiKey() || "") : ""; }
      catch (_) { $("mol-out-inchikey").value = ""; }
    } else {
      $("mol-out-inchi").value = "(InChI not available in this JSME build)";
      $("mol-out-inchikey").value = "";
    }
  }

  $("mol-read-btn").addEventListener("click", () => {
    readFromEditor();
    setStatus("Read.");
  });

  document.querySelectorAll(".mol-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-copy");
      const el = $(targetId);
      if (!el || !el.value) return;
      try {
        await navigator.clipboard.writeText(el.value);
        const prev = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = prev; }, 1200);
      } catch (e) {
        el.select();
        document.execCommand("copy");
      }
    });
  });

  // Optional: load SMILES from ?smiles= URL param
  const urlSmiles = new URLSearchParams(window.location.search).get("smiles");
  if (urlSmiles) $("mol-input").value = urlSmiles;
  const tryLoadOnReady = setInterval(() => {
    if (jsmeApplet && urlSmiles) {
      clearInterval(tryLoadOnReady);
      $("mol-load-btn").click();
    } else if (jsmeApplet) {
      clearInterval(tryLoadOnReady);
    }
  }, 200);
})();
</script>
