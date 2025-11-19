Changelog

All notable changes to this project will be documented in this file.

[1.0.0] - Stable Release - 2025-05-21

Added

Live Database Indicator: Added a visual badge in the bottom-left corner to detect if the app is connected to Firestore ("Live") or falling back to config.json ("Offline").

Admin Panel: Full CRUD capabilities for modifying base prices, dog fees, ZIP codes, and page text.

Fixed

Admin Panel Input Bug: Fixed an issue where typing in the "Features" or "ZIP Codes" fields would cause the cursor to jump or prevent spaces/newlines. Sanitization (trimming) now occurs only on Save, not during typing.

Firebase Connection: Resolved race conditions in App.jsx where the app would revert to offline mode immediately.

Import Resolution: Fixed build errors related to firebaseConfig.js resolution in the Admin Panel.

Security Rules: Updated Firestore rules to allow public read access to configuration while restricting writes to authenticated admins.

Changed

Config Loading: The app now prioritizes Firestore data and gracefully falls back to local config.json only if the database is unreachable.