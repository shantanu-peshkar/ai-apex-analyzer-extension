document.addEventListener("DOMContentLoaded", async () => {

    const input = document.getElementById("apiKey");
    const status = document.getElementById("status");

    // Load existing key
    const stored = await chrome.storage.local.get(["geminiApiKey"]);
    if (stored.geminiApiKey) {
        input.value = stored.geminiApiKey;
    }

    document.getElementById("saveBtn").addEventListener("click", async () => {

        const key = input.value.trim();

        if (!key) {
            status.innerText = "Please enter API key.";
            status.style.color = "red";
            return;
        }

        await chrome.storage.local.set({
            geminiApiKey: key
        });

        status.innerText = "Saved successfully!";
        status.style.color = "green";

        setTimeout(() => {
            status.innerText = "";
        }, 2000);
    });
});
