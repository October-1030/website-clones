# StudyPal Page Sync extension

This is the unpacked local Chrome companion for StudyPal AI.

## Install locally

1. Start StudyPal at `http://127.0.0.1:3000`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this `extension` folder.
5. In StudyPal, open **Browser extension**, create a pairing token, and copy it.
6. Click the StudyPal extension icon, paste the token, and save it locally.
7. Open a study page and click **Sync this page**.

## Permission boundary

- `activeTab`: temporary access only after the user clicks the extension.
- `scripting`: runs the extraction function in that active tab.
- `storage`: stores the pairing token in `chrome.storage.local`; it is not synced through the Chrome account.
- `sidePanel`: provides the user-controlled sync interface.
- Host access is limited to the local StudyPal server on port 3000.

The extension has no persistent access to arbitrary websites, no background content script, no history permission, no cookies permission, and no tabs permission. Page extraction excludes forms, inputs, textareas, selects, password fields, editable elements, hidden content, navigation, sidebars, and footers. It never captures automatically.
