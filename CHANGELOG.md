# Changelog

## Unreleased

- Keep analysis in sync with the active `.map` editor, in-place document changes, and configuration updates
- Clear stale webview lookup state when switching MAP data or clearing the current analysis
- Use VS Code text documents for file loading to improve compatibility with non-UTF-8 MAP files
- Clear previous analysis results on parse failures to avoid showing stale data

## 0.1.0

- Initial release
- Keil MDK/armlink MAP file parsing
- Memory layout visualization with Flash/RAM Code/RO/RW/ZI breakdown
- Module size bar chart with explicit Official/Derived source labels
- Symbol browser with type filtering
- Address reverse lookup (single/batch)
- Memory usage warning thresholds
- TreeView sidebar integration
- Data source provenance for Official, Computed, Derived, Inferred, and N/A values
- Honest unsupported-format handling for detected GCC/ARM LD and IAR MAP files
- Non-blocking file I/O via vscode.workspace.fs API (parsing is synchronous)
- Webview message listener cleanup and latest-data handling for reused panels
- Chinese README
