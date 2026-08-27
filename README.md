# BigQuery Release Notes Tracker & Twitter Sharer

A modern, highly-polished web application built using **Python Flask** and **Vanilla HTML/CSS/JavaScript**. It fetches Google Cloud's BigQuery release notes in real-time, splits them into individual updates (Features, Changes, Deprecations), and lets you draft, format, and share updates on Twitter (X) in one click.

## Features

- **Live RSS Fetching**: Dynamically reads Google's live XML Atom feed and parses it cleanly.
- **Granular Updates**: Splits bulk date entries into discrete sub-updates so you can focus on individual changes.
- **Smart Search & Filters**: Search titles/descriptions instantly, and filter updates dynamically by type (e.g. `Feature`, `Change`, `Deprecation`).
- **Tweet Composer & Preview**: Pre-populates clean Twitter drafts containing emojis, summaries, official link, and hashtags. Shows character length using a dynamic circular progress indicator.
- **One-Click Sharing**: Opens Twitter Web Intent directly or copies the tweet draft to your clipboard with a single click.
- **Responsive Layout**: Designed for seamless usage on desktop, tablet, and mobile screens.
- **Caching Mechanism**: Respects Google's feed server with a 5-minute memory cache, which can be forced to bypass by pressing "Refresh Feed".

## Getting Started

### Prerequisites
- Python 3.8 or higher

### Installation

1. Clone or download this project directory.
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On macOS/Linux
   # or
   .venv\Scripts\activate     # On Windows
   ```
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the App

Start the Flask development server:
```bash
python3 app.py
```

Open your browser and navigate to `http://127.0.0.1:5001`.

## File Structure

- [app.py](file:///Users/aryalkatkar/Desktop/agy-cli-projects/bq-releases-notes/app.py): Flask application backend with XML parser.
- [templates/index.html](file:///Users/aryalkatkar/Desktop/agy-cli-projects/bq-releases-notes/templates/index.html): HTML structure with rich semantic layouts.
- [static/css/style.css](file:///Users/aryalkatkar/Desktop/agy-cli-projects/bq-releases-notes/static/css/style.css): Vanilla CSS styling, responsive rules, animations, and typography.
- [static/js/app.js](file:///Users/aryalkatkar/Desktop/agy-cli-projects/bq-releases-notes/static/js/app.js): Vanilla JS managing app state, interactions, filters, and sharing intents.
