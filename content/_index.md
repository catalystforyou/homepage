---
title: "About Me"
date: 2025-12-05
draft: false
---

<style>
.geoguess-hint {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 6px;
    padding: 0.25em 0.7em;
    background: rgba(0, 0, 0, 0.05);
    color: var(--secondary, #888) !important;
    text-decoration: none;
    border-radius: 999px;
    font-size: 0.68em;
    font-weight: normal;
    letter-spacing: 0;
    white-space: nowrap;
    transition: background 0.18s ease, color 0.18s ease;
}
.geoguess-hint:hover {
    background: rgba(0, 0, 0, 0.1);
    color: var(--primary, #1a1a1a) !important;
}
.geoguess-hint em { font-style: italic; }
@media (prefers-color-scheme: dark) {
    .geoguess-hint { background: rgba(255, 255, 255, 0.07); }
    .geoguess-hint:hover { background: rgba(255, 255, 255, 0.14); }
}
</style>

<script>
(function () {
    function placeHint() {
        var menu = document.getElementById('menu');
        if (!menu) return;
        var items = menu.querySelectorAll('li');
        for (var i = 0; i < items.length; i++) {
            var txt = items[i].textContent.trim().toLowerCase();
            if (txt === 'off-duty' || txt.indexOf('off-duty') === 0) {
                if (items[i].querySelector('.geoguess-hint')) return;
                items[i].style.position = 'relative';
                var a = document.createElement('a');
                a.className = 'geoguess-hint';
                a.href = '/off-duty/life-diffusion-model/';
                a.title = 'A geoguess game inside my travel-photo map';
                a.innerHTML = '🎯 <em>geoguess inside</em>';
                items[i].appendChild(a);
                return;
            }
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', placeHint);
    } else {
        placeHint();
    }
})();
</script>

<div style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;">
    <div style="flex: 0 0 300px; max-width: 100%;">
        <img src="https://img.junren.li/Lindau_talk.jpg" alt="Junren Li at Lindau" style="width: 100%; height: auto; border-radius: 8px;">
        <p style="font-size: 0.9em; color: #666; margin-top: 10px; font-style: italic;">
            I am honored to attend and give a talk at the 74th Lindau Nobel Laureate Meeting as a selected young scientist in July 2025.
        </p>
    </div>
    <div style="flex: 1; min-width: 300px;">
        <p>
            I am currently a Ph.D. candidate at the College of Chemistry and Molecular Engineering, Peking University, where I also received my B.S. in Chemistry (2018–2022). I am fortunate to be advised by Prof. Luhua Lai and Prof. Zhirong Liu.
        </p>
        <p>
            My research philosophy is rooted in a single, driving ambition: to accelerate scientific discovery by bridging the gap between fundamental chemistry and artificial intelligence. I am passionate about liberating researchers from the tedious trial-and-error loops of traditional experiments through data-driven approaches and automation.
        </p>
        <p>
            My primary research interests lie in chemical reaction prediction, including:
        </p>
        <ul>
            <li><strong>Retrosynthesis Planning:</strong> Navigating the vast chemical space to find optimal synthetic routes.</li>
            <li><strong>Reaction Mechanism Analysis:</strong> Deciphering the underlying logic of chemical transformations.</li>
            <li><strong>Reaction Procedure Recommendation:</strong> Predicting experimental actions to maximize yield and efficiency.</li>
        </ul>
        <p>
            Beyond my academic studies at Peking University, my journey has been shaped by continuous engagement with world-class research labs. I have spent extensive time as a research intern within the Microsoft Research (MSR) ecosystem, collaborating with leading experts to push the boundaries of AI for Science. This includes my time at MSRA (May 2022 – Nov 2023), MSR AI4S Beijing (Mar 2025 – Sep 2025), and most recently MSR AI4S Cambridge (Jan 2026 – May 2026), where I explored the intersection of LLMs and chemistry.
        </p>
        <p>
            To ensure my computational work remains grounded in physical reality, I also served as a visiting research student at the Center for Algorithmic and Roboticized Synthesis, IBS (Oct 2024 – Dec 2024). Advised by Prof. Bartosz Grzybowski, I gained valuable insights into chemical automation and catalyst development, effectively balancing my AI expertise with deep chemical domain knowledge.
        </p>
        <p>
            I am always open to discussions on AI, Chemistry, and the future of automated science, you can also find my publications on <a href="https://scholar.google.com/citations?user=0Fu_GpMmuUcC" target="_blank">Google Scholar</a>. Feel free to reach out me at <a href="catalystforyou@outlook.com" target="_blank">catalystforyou@outlook.com</a>! 
        </p>
    </div>
</div>
