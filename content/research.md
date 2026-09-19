---
title: "Research"
draft: false
hideMeta: true
summary: "My publications and research projects."
---

<div class="research-lang-switch" role="group" aria-label="Language">
  <button type="button" data-language="en">EN</button>
  <button type="button" data-language="zh">中文</button>
</div>
<style>
  .research-lang-switch { display:flex; gap:.4rem; margin:0 0 1.25rem; }
  .research-lang-switch button { border:1px solid var(--border); background:var(--entry); color:inherit; border-radius:4px; padding:.25rem .6rem; cursor:pointer; font-size:.85rem; }
  .research-lang-switch button.active { background:var(--primary); color:var(--theme); }
  .lang-zh { display:none; }
  body.lang-zh-active .lang-en { display:none; }
  body.lang-zh-active .lang-zh { display:revert; }
</style>
<script>
  (() => {
    const root = document.body;
    const buttons = document.querySelectorAll('.research-lang-switch [data-language]');
    const setLanguage = (lang) => {
      root.classList.toggle('lang-zh-active', lang === 'zh');
      buttons.forEach((button) => button.classList.toggle('active', button.dataset.language === lang));
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
      try { localStorage.setItem('homepage-language', lang); } catch (_) {}
    };
    buttons.forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.language)));
    let initial = 'en';
    try { initial = localStorage.getItem('homepage-language') || 'en'; } catch (_) {}
    setLanguage(initial === 'zh' ? 'zh' : 'en');
  })();
</script>

## <span class="lang-en">Publications</span><span class="lang-zh">发表论文</span>

<p class="lang-en">Selected publications and research projects. Official paper titles are kept in their published language.</p><p class="lang-zh">这里列出我的代表性论文与研究项目。论文题目保留正式发表时的语言。</p>

<p style="margin-top: 2rem; color: #666; font-size: 0.9em;"><span class="lang-en">Last updated: September 2026</span><span class="lang-zh">最后更新：2026 年 9 月</span></p>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://arxiv.org/abs/2512.20333" target="_blank" rel="noopener">SynCraft: Guiding Large Language Models to Predict Edit Sequences for Molecular Synthesizability Optimization</a></div>
    <div style="color: #444;"><strong>Junren Li</strong>, Luhua Lai</div>
    <div style="font-style: italic; color: #666;"><span class="lang-en">Nature Machine Intelligence — Accepted, 2026</span><span class="lang-zh">Nature Machine Intelligence — 已接收，2026</span><br><span style="font-size: 0.9em;"><span class="lang-en">Preprint: arXiv:2512.20333</span><span class="lang-zh">预印本：arXiv:2512.20333</span></span></div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://arxiv.org/abs/2512.20333" target="_blank" rel="noopener">arXiv</a> · <a href="https://arxiv.org/pdf/2512.20333.pdf" target="_blank" rel="noopener">PDF</a> · <a href="https://scholar.google.com/scholar?q=SynCraft%3A%20Guiding%20Large%20Language%20Models%20to%20Predict%20Edit%20Sequences%20for%20Molecular%20Synthesizability%20Optimization" target="_blank" rel="noopener">Scholar</a></div>
</div>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://arxiv.org/abs/2512.13668" target="_blank" rel="noopener">A Scientific Reasoning Model for Organic Synthesis Procedure Generation</a></div>
    <div style="color: #444;">Guoqing Liu*, <strong>Junren Li*</strong>, Zihan Zhao*, Eray Inanc, Krzysztof Maziarz, Jose Garrido Torres, Victor Garcia Satorras, Shoko Ueda, Christopher M. Bishop, Marwin Segler<br><span style="font-size: 0.8em; color: #666;">* Equal contribution</span></div>
    <div style="font-style: italic; color: #666;">arXiv preprint arXiv:2512.13668, 2025</div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://arxiv.org/abs/2512.13668" target="_blank" rel="noopener">arXiv</a> · <a href="https://arxiv.org/pdf/2512.13668.pdf" target="_blank" rel="noopener">PDF</a> · <a href="https://scholar.google.com/scholar?q=A%20Scientific%20Reasoning%20Model%20for%20Organic%20Synthesis%20Procedure%20Generation" target="_blank" rel="noopener">Scholar</a></div>
</div>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://pubs.acs.org/doi/abs/10.1021/acs.chemrev.4c00969" target="_blank" rel="noopener">Computer-Aided Drug Discovery for Undruggable Targets</a></div>
    <div style="color: #444;">Qi Sun, Hanping Wang, Juan Xie, Liying Wang, Junxi Mu, <strong>Junren Li</strong>, Yuhao Ren, Luhua Lai</div>
    <div style="font-style: italic; color: #666;">Chemical Reviews, 2025</div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://scholar.google.com/scholar?q=Computer-Aided%20Drug%20Discovery%20for%20Undruggable%20Targets" target="_blank" rel="noopener">Scholar</a></div>
</div>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://arxiv.org/abs/2512.01274" target="_blank" rel="noopener">SUPERChem: A Multimodal Reasoning Benchmark in Chemistry</a></div>
    <div style="color: #444;">Zehua Zhao*, Zhixian Huang*, <strong>Junren Li</strong>*, Siyu Lin*, et al.<br><span style="font-size: 0.8em; color: #666;">* Equal contribution</span></div>
    <div style="font-style: italic; color: #666;">arXiv preprint arXiv:2512.01274, 2025</div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://arxiv.org/abs/2512.01274" target="_blank" rel="noopener">arXiv</a> · <a href="https://arxiv.org/pdf/2512.01274.pdf" target="_blank" rel="noopener">PDF</a> · <a href="https://scholar.google.com/scholar?q=SUPERChem%3A%20A%20Multimodal%20Reasoning%20Benchmark%20in%20Chemistry" target="_blank" rel="noopener">Scholar</a></div>
</div>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://pubs.rsc.org/en/content/articlehtml/2024/dd/d3dd00219e" target="_blank" rel="noopener">Retro-BLEU: quantifying chemical plausibility of retrosynthesis routes through reaction template sequence analysis</a></div>
    <div style="color: #444;"><strong>Junren Li</strong>, Lei Fang, Jian-Guang Lou</div>
    <div style="font-style: italic; color: #666;">Digital Discovery, 2024</div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://scholar.google.com/scholar?q=Retro-BLEU%3A%20quantifying%20chemical%20plausibility%20of%20retrosynthesis%20routes%20through%20reaction%20template%20sequence%20analysis" target="_blank" rel="noopener">Scholar</a></div>
</div>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://pubs.acs.org/doi/abs/10.1021/acs.jcim.4c00432" target="_blank" rel="noopener">Challenging complexity with simplicity: rethinking the role of single-step models in computer-aided synthesis planning</a></div>
    <div style="color: #444;"><strong>Junren Li</strong>, Kangjie Lin, Jianfeng Pei, Luhua Lai</div>
    <div style="font-style: italic; color: #666;">Journal of Chemical Information and Modeling, 2024</div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://scholar.google.com/scholar?q=Challenging%20complexity%20with%20simplicity%3A%20rethinking%20the%20role%20of%20single-step%20models%20in%20computer-aided%20synthesis%20planning" target="_blank" rel="noopener">Scholar</a></div>
</div>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://link.springer.com/article/10.1186/s13321-023-00727-7" target="_blank" rel="noopener">RetroRanker: leveraging reaction changes to improve retrosynthesis prediction through re-ranking</a></div>
    <div style="color: #444;"><strong>Junren Li</strong>*, Lei Fang*, Jian-Guang Lou<br><span style="font-size: 0.8em; color: #666;">* Equal contribution</span></div>
    <div style="font-style: italic; color: #666;">Journal of Cheminformatics, 2023</div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://scholar.google.com/scholar?q=RetroRanker%3A%20leveraging%20reaction%20changes%20to%20improve%20retrosynthesis%20prediction%20through%20re-ranking" target="_blank" rel="noopener">Scholar</a></div>
</div>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://www.nature.com/articles/s41467-023-37969-w" target="_blank" rel="noopener">Single-step retrosynthesis prediction by leveraging commonly preserved substructures</a></div>
    <div style="color: #444;">Lei Fang, <strong>Junren Li</strong>, Ming Zhao, Li Tan, Jian-Guang Lou</div>
    <div style="font-style: italic; color: #666;">Nature Communications, 2023</div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://scholar.google.com/scholar?q=Single-step%20retrosynthesis%20prediction%20by%20leveraging%20commonly%20preserved%20substructures" target="_blank" rel="noopener">Scholar</a></div>
</div>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://chemrxiv.org/engage/chemrxiv/article-details/62fb8d2f7cdc054b339e829c" target="_blank" rel="noopener">Reaxtica: A knowledge-guided machine learning platform for fast and accurate reaction selectivity and yield prediction</a></div>
    <div style="color: #444;">Kangjie Lin*, <strong>Junren Li</strong>*, Haoyu Lin, Jianfeng Pei, Luhua Lai<br><span style="font-size: 0.8em; color: #666;">* Equal contribution</span></div>
    <div style="font-style: italic; color: #666;">2022</div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://scholar.google.com/scholar?q=Reaxtica%3A%20A%20knowledge-guided%20machine%20learning%20platform%20for%20fast%20and%20accurate%20reaction%20selectivity%20and%20yield%20prediction" target="_blank" rel="noopener">Scholar</a></div>
</div>

<div class="publication-entry" style="margin-bottom: 20px;">
    <div style="font-size: 1.1em; font-weight: bold;"><a href="https://openreview.net/forum?id=FrCL5fDLJl" target="_blank" rel="noopener">Chemist-aligned retrosynthesis by ensembling diverse inductive bias models</a></div>
    <div style="color: #444;">Krzysztof Maziarz*, Guoqing Liu*, Austin Tripp, <strong>Junren Li</strong>, Piotr Gainski, Marwin Segler<br><span style="font-size: 0.8em; color: #666;">* Equal contribution</span></div>
    <div style="font-style: italic; color: #666;"><span class="lang-en">RetroChimera · Nature — Accepted, 2026</span><span class="lang-zh">RetroChimera · Nature — 已接收，2026</span><br><span style="font-size: 0.9em;"><span class="lang-en">Preprint: arXiv:2412.05269</span><span class="lang-zh">预印本：arXiv:2412.05269</span></span></div>
    <div style="margin-top: 4px; font-size: 0.9em; color: #666;"><a href="https://arxiv.org/abs/2412.05269" target="_blank" rel="noopener">arXiv</a> · <a href="https://openreview.net/forum?id=FrCL5fDLJl" target="_blank" rel="noopener">OpenReview</a> · <a href="https://scholar.google.com/scholar?q=Chemist-aligned%20retrosynthesis%20by%20ensembling%20diverse%20inductive%20bias%20models" target="_blank" rel="noopener">Scholar</a></div>
</div>
