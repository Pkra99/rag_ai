const fs = require('fs');
const path = require('path');

async function testUpload() {
    const formData = new FormData();
    const blob = new Blob(["This is a test file content"], { type: 'text/plain' });
    formData.append('file', blob, 'test.txt');

    try {
        console.log("🚀 Sending upload request WITHOUT session ID...");
        const response = await fetch("http://localhost:3000/api/indexing", {
            method: "POST",
            body: formData,
            // No x-session-id header
        });

        const data = await response.json();
        console.log(`Response Status: ${response.status}`);
        console.log("Response Data:", JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
            console.log("✅ Upload SUCCESS! Default session fallback is working.");
        } else {
            console.log("❌ Upload FAILED.");
        }
    } catch (error) {
        console.error("❌ Request Error:", error.message);
    }
}

testUpload();
