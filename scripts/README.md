# UCSC Course Scraper

This directory contains scripts to scrape UCSC courses and import them into the database.

## Setup

### 1. Install Python Dependencies

```bash
pip install -r scripts/requirements.txt
```

You'll also need Chrome and ChromeDriver installed:
- **macOS**: `brew install chromedriver`
- **Linux**: Install via your package manager or download from [ChromeDriver downloads](https://chromedriver.chromium.org/downloads)
- **Windows**: Download from [ChromeDriver downloads](https://chromedriver.chromium.org/downloads)

### 2. Install Node.js Dependencies

The import script uses Node.js dependencies that should already be installed:
```bash
npm install
```

## Usage

### Step 1: Scrape Courses (Python)

Run the Python scraper to fetch courses from UCSC and save them to a JSON file:

```bash
python3 scripts/scrape_ucsc.py [output_file.json] [--verbose] [--screenshot]
```

**Arguments:**
- `output_file.json` (optional): Output JSON file path (default: `ucsc_courses.json`)
- `--verbose` or `-v`: Print detailed debugging information
- `--screenshot` or `-s`: Take screenshots when errors occur (saves to current directory)

**Examples:**
```bash
# Basic usage
python3 scripts/scrape_ucsc.py ucsc_courses.json

# With verbose debugging
python3 scripts/scrape_ucsc.py ucsc_courses.json --verbose

# With error screenshots
python3 scripts/scrape_ucsc.py ucsc_courses.json --screenshot

# All options
python3 scripts/scrape_ucsc.py ucsc_courses.json --verbose --screenshot
```

The scraper will:
- Navigate to the UCSC class search page
- Use multiple strategies to find form elements (more robust)
- Set status to "All Classes"
- Set term to "2026 Winter Quarter"
- Extract all courses with professor and quarter information
- Handle pagination automatically
- Save results to JSON file

**Troubleshooting:**
- If the scraper can't find elements, use `--verbose` to see what it's finding
- If it fails, use `--screenshot` to capture the page state for debugging
- The scraper tries multiple selector strategies, so it should work even if the page structure changes slightly

### Step 2: Import Courses to Database (Node.js)

After scraping, import the courses into your Supabase database:

```bash
npm run import-courses [path/to/courses.json]
```

If no file path is specified, it defaults to `ucsc_courses.json` in the current directory.

**Example:**
```bash
npm run import-courses ucsc_courses.json
```

The import script will:
- Read courses from the JSON file
- Check for duplicates (by name, professor, and quarter)
- Insert new courses into the database
- Show a summary of inserted/skipped/errors

## JSON Format

The scraper outputs a JSON file with the following structure:

```json
[
  {
    "name": "CSE 101 - Introduction to Computer Science",
    "subject": "CSE",
    "professor": "Smith",
    "quarter": "2026 Winter",
    "course_link": "https://pisa.ucsc.edu/..."
  },
  ...
]
```

## Notes

- The scraper handles pagination automatically
- Duplicate courses (same name, professor, quarter) are skipped during import
- Make sure your `.env.local` file has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set
- The scraper may take several minutes to complete depending on the number of courses
