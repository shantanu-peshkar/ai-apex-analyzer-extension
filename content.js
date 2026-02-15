console.log("🧠 AI Apex Explainer Loaded");

/* =========================================
   PREVENT DUPLICATE INJECTION
========================================= */
if (!window.apexAnalyzerInjected) {
    window.apexAnalyzerInjected = true;
    setTimeout(injectButton, 2000);
}

/* =========================================
   INJECT BUTTON
========================================= */
function injectButton() {

    if (document.getElementById("analyze-apex-btn")) return;

    const button = document.createElement("button");
    button.id = "analyze-apex-btn";
    button.innerText = "🤖 Analyze Apex";

    Object.assign(button.style, {
        position: "fixed",
        top: "120px",
        right: "30px",
        zIndex: "9999",
        padding: "10px 18px",
        background: "#1f2937",
        color: "#ffffff",
        border: "1px solid #374151",
        borderRadius: "8px",
        cursor: "pointer",
        fontWeight: "600",
        boxShadow: "0 6px 18px rgba(0,0,0,0.5)"
    });

    button.onclick = handleAnalyze;
    document.body.appendChild(button);
}

/* =========================================
   HANDLE ANALYZE CLICK
========================================= */
async function handleAnalyze() {

    const apexCode = extractApexCode();

    if (!apexCode) {
        alert("❌ Could not extract Apex code.");
        return;
    }

    const staticResult = runStaticAnalysis(apexCode);
    showAnalysisPanel(staticResult, true);

    try {
        const aiResponse = await callGeminiAI(apexCode, staticResult);
        updateAISection(aiResponse);
    } catch (err) {
        updateAISection("⚠ AI analysis failed. Check API key or quota.");
        console.error(err);
    }
}

/* =========================================
   GEMINI CALL
========================================= */
function callGeminiAI(code, staticResult) {

    return new Promise((resolve, reject) => {

        chrome.runtime.sendMessage(
            {
                type: "ANALYZE_WITH_GEMINI",
                apexCode: code,
                staticResult: staticResult
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (!response || response.error) {
                    reject(response?.error || "Unknown error");
                } else {
                    resolve(response.result);
                }
            }
        );
    });
}

/* =========================================
   EXTRACT APEX CODE
========================================= */
function extractApexCode() {

    let apexCode = null;

    const mainCode =
        document.querySelector("pre") ||
        document.querySelector("code");

    if (mainCode) {
        apexCode = mainCode.innerText;
    }

    if (!apexCode) {
        const iframes = document.querySelectorAll("iframe");

        for (let iframe of iframes) {
            try {
                const iframeDoc =
                    iframe.contentDocument ||
                    iframe.contentWindow.document;

                const iframeCode =
                    iframeDoc.querySelector("pre") ||
                    iframeDoc.querySelector("code");

                if (iframeCode) {
                    apexCode = iframeCode.innerText;
                    break;
                }
            } catch (err) {}
        }
    }

    return apexCode;
}

/* =========================================
   STATIC ANALYZER
========================================= */
function runStaticAnalysis(code) {

    const findings = {
        soqlInLoop: /for\s*\(.*?\)\s*{[^}]*SELECT[^}]*}/gis.test(code),
        dmlInLoop: /for\s*\(.*?\)\s*{[^}]*(insert|update|delete|upsert)[^}]*}/gis.test(code),
        missingSharing: !/public\s+(with\s+sharing|without\s+sharing)\s+class/i.test(code),
        queryCount: (code.match(/SELECT\s+/gi) || []).length,
        dmlCount: (code.match(/\b(insert|update|delete|upsert)\b/gi) || []).length
    };

    findings.riskScore = calculateRisk(findings);
    return findings;
}

function calculateRisk(f) {
    let score = 0;
    if (f.soqlInLoop) score += 30;
    if (f.dmlInLoop) score += 30;
    if (f.missingSharing) score += 20;
    if (f.queryCount > 5) score += 10;
    if (f.dmlCount > 5) score += 10;
    return Math.min(score, 100);
}

/* =========================================
   DARK PANEL UI
========================================= */
function showAnalysisPanel(result, showLoading = false) {

    const oldPanel = document.getElementById("ai-apex-panel");
    if (oldPanel) oldPanel.remove();

    const riskColor =
        result.riskScore < 30 ? "#22c55e" :
        result.riskScore < 60 ? "#f59e0b" :
        "#ef4444";

    const panel = document.createElement("div");
    panel.id = "ai-apex-panel";

    panel.innerHTML = `
    <div id="panel-inner" style="
        position: fixed;
        top: 0;
        right: -500px;
        width: 500px;
        height: 100vh;
        background: #0f0f0f;
        color: #e5e5e5;
        box-shadow: -12px 0 40px rgba(0,0,0,0.8);
        z-index: 999999;
        padding: 30px;
        overflow-y: auto;
        font-family: 'Segoe UI', sans-serif;
        transition: right 0.4s ease;
    ">

        <div style="display:flex;justify-content:space-between;">
            <h2 style="margin:0;color:#ffffff;">🧠 AI Apex Analyzer</h2>
            <button id="close-panel" style="
                background:#1f1f1f;
                border:1px solid #333;
                color:#ccc;
                padding:6px 10px;
                border-radius:6px;
                cursor:pointer;
            ">✖</button>
        </div>

        <hr style="margin:20px 0;border:none;border-top:1px solid #2a2a2a;"/>

        <div style="margin-bottom:25px;">
            <div style="font-size:14px;color:#9ca3af;">Risk Score</div>
            <div style="font-size:42px;font-weight:700;color:${riskColor};">
                ${result.riskScore}/100
            </div>
        </div>

        <h3 style="color:#d1d5db;">🔍 Static Findings</h3>
            ${row("SOQL in Loop", result.soqlInLoop)}
            ${row("DML in Loop", result.dmlInLoop)}
            ${row("Missing Sharing", result.missingSharing)}

        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #2a2a2a;">
            <div style="display:flex;justify-content:space-between;padding:4px 0;">
                <span style="color:#9ca3af;">Total SOQL Queries</span>
                <span style="font-weight:600;">${result.queryCount}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;">
                <span style="color:#9ca3af;">Total DML Statements</span>
                <span style="font-weight:600;">${result.dmlCount}</span>
            </div>
        </div>

        <hr style="margin:25px 0;border:none;border-top:1px solid #2a2a2a;"/>

        <h3 style="color:#d1d5db;">🤖 AI Analysis</h3>
        <div id="ai-section">
            ${showLoading ? loadingSpinner() : ""}
        </div>
    </div>
    `;

    document.body.appendChild(panel);

    setTimeout(() => {
        document.getElementById("panel-inner").style.right = "0";
    }, 50);

    document.getElementById("close-panel").onclick = () => {
        document.getElementById("panel-inner").style.right = "-500px";
        setTimeout(() => panel.remove(), 300);
    };
}

/* =========================================
   DARK AI SECTION
========================================= */
function updateAISection(text) {

    const section = document.getElementById("ai-section");
    if (!section) return;

    let formatted = text
        .replace(/^###\s?(.*)$/gm, '<h3 style="margin-top:20px;color:#ffffff;">$1</h3>')
        .replace(/^##\s?(.*)$/gm, '<h2 style="margin-top:25px;color:#ffffff;">$1</h2>')
        .replace(/^#\s?(.*)$/gm, '<h2 style="margin-top:25px;color:#ffffff;">$1</h2>')
        .replace(/^---$/gm, '<hr style="margin:20px 0;border:none;border-top:1px solid #2a2a2a;">')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#ffffff;">$1</strong>')
        .replace(/`([^`]+)`/g, '<code style="background:#1f1f1f;color:#e5e5e5;padding:3px 8px;border-radius:6px;font-size:13px;">$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    section.innerHTML = `
        <div style="
            background:#1a1a1a;
            padding:22px;
            border-radius:14px;
            font-size:14px;
            line-height:1.8;
            box-shadow:0 10px 30px rgba(0,0,0,0.6);
            color:#d1d5db;
        ">
            <p>${formatted}</p>
        </div>
    `;
}

/* =========================================
   UI HELPERS
========================================= */
function row(label, value) {
    const color = value ? "#ef4444" : "#22c55e";
    const text = value ? "Detected" : "Safe";
    return `
        <div style="display:flex;justify-content:space-between;padding:6px 0;">
            <span style="color:#9ca3af;">${label}</span>
            <span style="font-weight:600;color:${color};">${text}</span>
        </div>
    `;
}

function loadingSpinner() {
    return `
        <div style="display:flex;align-items:center;gap:10px;">
            <div style="
                width:18px;
                height:18px;
                border:3px solid #333;
                border-top:3px solid #888;
                border-radius:50%;
                animation:spin 1s linear infinite;
            "></div>
            <span style="color:#9ca3af;">Analyzing with Gemini...</span>
        </div>

        <style>
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        </style>
    `;
}
