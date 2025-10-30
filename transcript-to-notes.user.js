// ==UserScript==
// @name         Transcript to Course Notes
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Convert lecture transcripts to beautiful course notes with AI
// @author       You
// @match        https://*.deeplearning.ai/*
// @match        https://deeplearning.ai/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/marked/marked.min.js
// ==/UserScript==

(function() {
    'use strict';

    let rawMarkdown = '';
    let isPreviewMode = true;
    let panelOpen = false;

    // LocalStorage keys
    const STORAGE_KEY_API = 'transcript_notes_api_key';
    const STORAGE_KEY_MODEL = 'transcript_notes_model';

    // Configure marked options
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    // Create styles
    const styles = `
        .transcript-notes-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            transition: transform 0.2s, box-shadow 0.2s, opacity 0.3s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-btn.hidden {
            opacity: 0;
            pointer-events: none;
        }

        .transcript-notes-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .transcript-notes-overlay {
            position: fixed;
            top: 0;
            right: -25%;
            width: 25%;
            min-width: 400px;
            height: 100vh;
            background: white;
            z-index: 1000000;
            transition: right 0.3s ease-in-out, width 0.3s ease-in-out;
            box-shadow: -5px 0 25px rgba(0, 0, 0, 0.3);
            overflow-y: auto;
        }

        .transcript-notes-overlay.open {
            right: 0;
        }

        .transcript-notes-overlay.collapsed {
            width: 40px;
            min-width: 40px;
            right: 0;
        }

        .transcript-notes-panel {
            width: 100%;
            height: 100vh;
            background: white;
            overflow-y: auto;
            position: relative;
        }

        .transcript-notes-toggle-handle {
            position: absolute;
            left: 0;
            top: 0;
            width: 40px;
            height: 100%;
            background: linear-gradient(to right, rgba(102, 126, 234, 0.1), transparent);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            z-index: 10;
            border-right: 2px solid rgba(102, 126, 234, 0.2);
        }

        .transcript-notes-toggle-handle:hover {
            background: linear-gradient(to right, rgba(102, 126, 234, 0.2), transparent);
        }

        .transcript-notes-toggle-handle::before {
            content: '◀';
            font-size: 20px;
            color: #667eea;
            transition: transform 0.3s;
        }

        .transcript-notes-overlay.collapsed .transcript-notes-toggle-handle {
            width: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-right: none;
            writing-mode: vertical-rl;
            text-orientation: mixed;
            font-size: 12px;
            color: white;
            font-weight: 600;
            padding: 10px 0;
        }

        .transcript-notes-overlay.collapsed .transcript-notes-toggle-handle::before {
            content: '▶ Notes';
            color: white;
            font-size: 14px;
            writing-mode: vertical-rl;
            text-orientation: mixed;
        }

        .transcript-notes-overlay.collapsed .transcript-notes-panel-content {
            display: none;
        }

        .transcript-notes-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0;
        }

        .transcript-notes-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .transcript-notes-header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-header p {
            font-size: 1.1em;
            opacity: 0.9;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            font-size: 24px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        .transcript-notes-close:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .transcript-notes-content {
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 30px;
        }

        .transcript-notes-section h2 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.5em;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-input-group {
            margin-bottom: 15px;
        }

        .transcript-notes-input-group label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-input-group input,
        .transcript-notes-input-group select,
        .transcript-notes-input-group textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: border-color 0.3s;
        }

        .transcript-notes-input-group input:focus,
        .transcript-notes-input-group select:focus,
        .transcript-notes-input-group textarea:focus {
            outline: none;
            border-color: #667eea;
        }

        .transcript-notes-input-group textarea {
            resize: vertical;
            font-family: 'Courier New', monospace;
            min-height: 300px;
        }

        .transcript-notes-btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            margin-top: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }

        .transcript-notes-btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .transcript-notes-output {
            background: #ffffff;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            padding: 30px;
            min-height: 400px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            overflow-y: auto;
            max-height: 600px;
        }

        .transcript-notes-output h1 {
            color: #2c3e50;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
            margin-top: 30px;
            margin-bottom: 20px;
            font-size: 2em;
        }

        .transcript-notes-output h1:first-child {
            margin-top: 0;
        }

        .transcript-notes-output h2 {
            color: #34495e;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 8px;
            margin-top: 25px;
            margin-bottom: 15px;
            font-size: 1.6em;
        }

        .transcript-notes-output h3 {
            color: #667eea;
            margin-top: 20px;
            margin-bottom: 12px;
            font-size: 1.3em;
        }

        .transcript-notes-output p {
            margin-bottom: 15px;
            color: #333;
        }

        .transcript-notes-output ul, .transcript-notes-output ol {
            margin-bottom: 15px;
            padding-left: 30px;
        }

        .transcript-notes-output li {
            margin-bottom: 8px;
            color: #333;
        }

        .transcript-notes-output strong {
            color: #667eea;
            font-weight: 600;
        }

        .transcript-notes-output code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #e83e8c;
        }

        .transcript-notes-output pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
        }

        .transcript-notes-output pre code {
            background: none;
            padding: 0;
            color: #333;
        }

        .transcript-notes-output blockquote {
            border-left: 4px solid #667eea;
            padding-left: 20px;
            margin: 20px 0;
            color: #555;
            font-style: italic;
            background: #f8f9fa;
            padding: 15px 20px;
            border-radius: 4px;
        }

        .transcript-notes-output.empty {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            font-style: italic;
        }

        .transcript-notes-loading {
            display: none;
            text-align: center;
            padding: 20px;
            color: #667eea;
        }

        .transcript-notes-loading.active {
            display: block;
        }

        .transcript-notes-spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: transcript-notes-spin 1s linear infinite;
            margin: 0 auto 10px;
        }

        @keyframes transcript-notes-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .transcript-notes-error {
            background: #fee;
            color: #c33;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-error.active {
            display: block;
        }

        .transcript-notes-info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-copy-btn {
            background: #4caf50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
            margin-right: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-copy-btn:hover {
            background: #45a049;
        }

        .transcript-notes-toggle-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-toggle-btn:hover {
            background: #5568d3;
        }

        .transcript-notes-button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .transcript-notes-success {
            background: #d4edda;
            color: #155724;
            padding: 10px 15px;
            border-radius: 6px;
            margin-top: 10px;
            display: none;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcript-notes-success.active {
            display: block;
        }
    `;

    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Function to load saved settings
    function loadSavedSettings() {
        const savedApiKey = localStorage.getItem(STORAGE_KEY_API);
        const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);

        if (savedApiKey) {
            document.getElementById('tn-apiKey').value = savedApiKey;
        }

        if (savedModel) {
            document.getElementById('tn-model').value = savedModel;
        }
    }

    // Function to save settings
    function saveSettings() {
        const apiKey = document.getElementById('tn-apiKey').value.trim();
        const model = document.getElementById('tn-model').value;

        if (apiKey) {
            localStorage.setItem(STORAGE_KEY_API, apiKey);
        }

        localStorage.setItem(STORAGE_KEY_MODEL, model);
    }

    // Function to clear saved API key
    function clearSavedApiKey() {
        localStorage.removeItem(STORAGE_KEY_API);
        document.getElementById('tn-apiKey').value = '';
        showSuccess('API key cleared from storage');
    }

    // Create floating button
    const floatingBtn = document.createElement('button');
    floatingBtn.className = 'transcript-notes-btn';
    floatingBtn.innerHTML = '📝 Notes';
    floatingBtn.title = 'Transcript to Course Notes';
    document.body.appendChild(floatingBtn);

    // Create overlay panel
    const overlay = document.createElement('div');
    overlay.className = 'transcript-notes-overlay';
    overlay.innerHTML = `
        <div class="transcript-notes-panel">
            <div class="transcript-notes-toggle-handle" title="Toggle panel"></div>
            <div class="transcript-notes-panel-content">
                <div class="transcript-notes-container">
                    <div class="transcript-notes-header">
                        <button class="transcript-notes-close">×</button>
                        <h1>📝 Transcript to Course Notes</h1>
                        <p>Transform your lecture transcripts into beautiful, structured course notes with AI</p>
                    </div>

                    <div class="transcript-notes-content">
                        <div class="transcript-notes-section">
                            <h2>Input</h2>

                            <div class="transcript-notes-input-group">
                                <label for="tn-apiKey">OpenAI API Key</label>
                                <input type="password" id="tn-apiKey" placeholder="sk-...">
                                <div class="transcript-notes-button-group" style="margin-top: 8px;">
                                    <button class="transcript-notes-copy-btn" id="tn-save-key" style="background: #2196f3; font-size: 12px; padding: 6px 12px; margin: 0;">💾 Save Key</button>
                                    <button class="transcript-notes-copy-btn" id="tn-clear-key" style="background: #f44336; font-size: 12px; padding: 6px 12px; margin: 0;">🗑️ Clear Key</button>
                                </div>
                                <small style="color: #666; font-size: 12px; margin-top: 5px; display: block;">Your API key is stored locally in your browser</small>
                            </div>

                            <div class="transcript-notes-input-group">
                                <label for="tn-model">Model</label>
                                <select id="tn-model">
                                    <option value="gpt-4.1">GPT-4.1 (Recommended)</option>
                                    <option value="gpt-4o-mini">GPT-4o Mini (Faster)</option>
                                </select>
                            </div>

                            <div class="transcript-notes-info-box">
                                <strong>Quick Start:</strong> Click the "Fetch Transcript from Page" button below to automatically extract the transcript from the current page, or paste your own transcript with timestamps.
                            </div>

                            <div class="transcript-notes-input-group">
                                <label for="tn-transcript">Transcript</label>
                                <div class="transcript-notes-button-group" style="margin-bottom: 10px;">
                                    <button class="transcript-notes-toggle-btn" id="tn-fetch">📥 Fetch Transcript from Page</button>
                                </div>
                                <textarea id="tn-transcript" placeholder="[00:00] Welcome to today's lecture on Machine Learning...
[05:30] Let's start with the basics of neural networks...
[12:45] Now, moving on to backpropagation..."></textarea>
                            </div>

                            <div class="transcript-notes-success" id="tn-fetch-success"></div>

                            <button class="transcript-notes-btn-primary" id="tn-generate">Generate Course Notes</button>

                            <div class="transcript-notes-error" id="tn-error"></div>
                        </div>

                        <div class="transcript-notes-section">
                            <h2>Generated Course Notes</h2>

                            <div class="transcript-notes-loading" id="tn-loading">
                                <div class="transcript-notes-spinner"></div>
                                <p>Generating your course notes...</p>
                            </div>

                            <div class="transcript-notes-output empty" id="tn-output">Your generated course notes will appear here...</div>

                            <div class="transcript-notes-button-group">
                                <button class="transcript-notes-copy-btn" id="tn-copy">Copy Markdown</button>
                                <button class="transcript-notes-toggle-btn" id="tn-toggle" style="display: none;">View Raw Markdown</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Function to fetch transcript from page
    function fetchTranscriptFromPage() {
        const errorDiv = document.getElementById('tn-error');
        const successDiv = document.getElementById('tn-fetch-success');
        const transcriptTextarea = document.getElementById('tn-transcript');
        const fetchBtn = document.getElementById('tn-fetch');

        errorDiv.classList.remove('active');
        successDiv.classList.remove('active');

        try {
            // First, try to click the "Show Transcript" button if it exists and transcript panel is not open
            const showTranscriptBtn = document.querySelector('button[aria-label="Show transcript panel"]');

            if (showTranscriptBtn) {
                // Check if transcript panel is already visible
                const transcriptPanel = document.querySelector('.flex-1.overflow-y-auto.p-4.max-w-4xl.mx-auto');

                if (!transcriptPanel) {
                    // Click the button to show transcript
                    showTranscriptBtn.click();

                    // Wait a bit for the panel to appear
                    setTimeout(() => {
                        extractTranscript();
                    }, 500);
                } else {
                    extractTranscript();
                }
            } else {
                extractTranscript();
            }

            function extractTranscript() {
                // Look for transcript items in the page
                const transcriptItems = document.querySelectorAll('.flex.p-2.gap-3.items-start');

                if (transcriptItems.length === 0) {
                    showError('No transcript found on this page. Make sure the transcript panel is open or paste your transcript manually.');
                    return;
                }

                let transcriptText = '';

                transcriptItems.forEach(item => {
                    // Get timestamp
                    const timeButton = item.querySelector('button[aria-label^="Jump to"]');
                    const textSpan = item.querySelector('span');

                    if (timeButton && textSpan) {
                        const timestamp = timeButton.textContent.trim();
                        const text = textSpan.textContent.trim();

                        transcriptText += `[${timestamp}] ${text}\n`;
                    }
                });

                if (transcriptText) {
                    transcriptTextarea.value = transcriptText;
                    successDiv.textContent = `✓ Successfully fetched ${transcriptItems.length} transcript segments!`;
                    successDiv.classList.add('active');

                    // Auto-scroll to transcript textarea
                    transcriptTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    showError('Could not extract transcript text. Please paste manually.');
                }
            }

        } catch (error) {
            showError(`Error fetching transcript: ${error.message}`);
        }
    }

    // Event handlers
    floatingBtn.addEventListener('click', () => {
        overlay.classList.add('open');
        overlay.classList.remove('collapsed');
        floatingBtn.classList.add('hidden');
        panelOpen = true;
    });

    overlay.querySelector('.transcript-notes-close').addEventListener('click', () => {
        overlay.classList.remove('open');
        overlay.classList.remove('collapsed');
        floatingBtn.classList.remove('hidden');
        panelOpen = false;
    });

    // Toggle handle click to collapse/expand
    overlay.querySelector('.transcript-notes-toggle-handle').addEventListener('click', () => {
        overlay.classList.toggle('collapsed');
        // Show button when collapsed to thin bar
        if (overlay.classList.contains('collapsed')) {
            floatingBtn.classList.remove('hidden');
        } else {
            floatingBtn.classList.add('hidden');
        }
    });

    // Generate notes function
    async function generateNotes() {
        const apiKey = document.getElementById('tn-apiKey').value.trim();
        const model = document.getElementById('tn-model').value;
        const transcript = document.getElementById('tn-transcript').value.trim();
        const errorDiv = document.getElementById('tn-error');
        const loadingDiv = document.getElementById('tn-loading');
        const outputDiv = document.getElementById('tn-output');
        const toggleBtn = document.getElementById('tn-toggle');

        errorDiv.classList.remove('active');
        errorDiv.textContent = '';

        if (!apiKey) {
            showError('Please enter your OpenAI API key');
            return;
        }

        if (!transcript) {
            showError('Please enter a transcript or fetch it from the page');
            return;
        }

        // Save settings before generating
        saveSettings();

        loadingDiv.classList.add('active');
        outputDiv.innerHTML = '';
        outputDiv.classList.add('empty');
        toggleBtn.style.display = 'none';

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expert educational assistant that creates beautiful, comprehensive course notes from lecture transcripts.

Your task is to:
1. Analyze the transcript and organize it into clear, structured course notes
2. Use markdown formatting to create a beautiful, hierarchical structure
3. Include ALL timestamp references from the original transcript in your notes (format them as clickable references like [→ 05:30])
4. Create clear sections with descriptive headers
5. Highlight key concepts, definitions, and important points
6. Include examples and explanations where present
7. Add bullet points for lists and important details
8. Make the notes scannable and easy to study from

Format guidelines:
- Use # for main topics, ## for sections, ### for subsections
- Use **bold** for key terms and important concepts
- Use > for important quotes or key takeaways
- Include timestamp references as [→ HH:MM] or [→ MM:SS] next to relevant content
- Create a table of contents if the lecture is long
- Add a summary section at the end

Make the notes professional, comprehensive, and beautifully formatted.`
                        },
                        {
                            role: 'user',
                            content: `Please create comprehensive course notes from this transcript:\n\n${transcript}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 4000
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
            }

            const data = await response.json();
            rawMarkdown = data.choices[0].message.content;

            outputDiv.classList.remove('empty');
            outputDiv.innerHTML = marked.parse(rawMarkdown);
            isPreviewMode = true;
            toggleBtn.style.display = 'inline-block';
            toggleBtn.textContent = 'View Raw Markdown';
        } catch (error) {
            showError(`Error: ${error.message}`);
            outputDiv.innerHTML = '<p style="color: #c33;">Failed to generate notes. Please check your API key and try again.</p>';
        } finally {
            loadingDiv.classList.remove('active');
        }
    }

    function toggleView() {
        const outputDiv = document.getElementById('tn-output');
        const toggleBtn = document.getElementById('tn-toggle');

        if (isPreviewMode) {
            outputDiv.innerHTML = `<pre style="margin: 0; white-space: pre-wrap; font-family: 'Courier New', monospace;">${escapeHtml(rawMarkdown)}</pre>`;
            toggleBtn.textContent = 'View Rendered Preview';
            isPreviewMode = false;
        } else {
            outputDiv.innerHTML = marked.parse(rawMarkdown);
            toggleBtn.textContent = 'View Raw Markdown';
            isPreviewMode = true;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError(message) {
        const errorDiv = document.getElementById('tn-error');
        errorDiv.textContent = message;
        errorDiv.classList.add('active');
    }

    function showSuccess(message) {
        const successDiv = document.getElementById('tn-fetch-success');
        successDiv.textContent = `✓ ${message}`;
        successDiv.classList.add('active');

        setTimeout(() => {
            successDiv.classList.remove('active');
        }, 3000);
    }

    function copyToClipboard() {
        if (!rawMarkdown) {
            showError('No notes to copy. Please generate notes first.');
            return;
        }

        navigator.clipboard.writeText(rawMarkdown).then(() => {
            const btn = document.getElementById('tn-copy');
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            btn.style.background = '#2196f3';

            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '#4caf50';
            }, 2000);
        }).catch(err => {
            showError('Failed to copy to clipboard');
        });
    }

    // Attach event listeners
    document.getElementById('tn-generate').addEventListener('click', generateNotes);
    document.getElementById('tn-copy').addEventListener('click', copyToClipboard);
    document.getElementById('tn-toggle').addEventListener('click', toggleView);
    document.getElementById('tn-fetch').addEventListener('click', fetchTranscriptFromPage);
    document.getElementById('tn-save-key').addEventListener('click', () => {
        saveSettings();
        showSuccess('API key and model saved!');
    });
    document.getElementById('tn-clear-key').addEventListener('click', clearSavedApiKey);

    // Auto-save model selection
    document.getElementById('tn-model').addEventListener('change', saveSettings);

    // Load saved settings when panel opens
    floatingBtn.addEventListener('click', loadSavedSettings);

    // Allow Ctrl+Enter to generate
    document.getElementById('tn-transcript').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            generateNotes();
        }
    });

    console.log('Transcript to Course Notes userscript loaded!');
})();
