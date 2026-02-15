chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.type === "ANALYZE_WITH_GEMINI") {

        runGeminiAnalysis(request.apexCode, request.staticResult)
            .then(result => {
                sendResponse({ result: result });
            })
            .catch(error => {
                console.error("Gemini Error:", error);
                sendResponse({ error: error.message });
            });

        return true; // Required for async
    }
});

async function runGeminiAnalysis(code, staticResult) {

    const storage = await chrome.storage.local.get(["geminiApiKey"]);

    if (!storage.geminiApiKey) {
        throw new Error("Gemini API key not configured.");
    }

    const apiKey = storage.geminiApiKey;

    const prompt = `
You are a Salesforce Apex architect.

Static Findings:
- SOQL in loop: ${staticResult.soqlInLoop}
- DML in loop: ${staticResult.dmlInLoop}
- Missing sharing: ${staticResult.missingSharing}
- Query count: ${staticResult.queryCount}
- DML count: ${staticResult.dmlCount}
- Risk score: ${staticResult.riskScore}

Now analyze this Apex class deeply.

Provide:
1. Executive Summary
2. Bulkification Issues
3. Governor Limit Risks
4. Security Issues
5. Refactoring Suggestions
6. Final Risk Score (0-100)

Apex Code:
${code}
`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ]
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || "Gemini API error");
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No AI response.";
}
