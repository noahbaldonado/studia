#!/usr/bin/env python3
"""
UCSC Course Scraper
Scrapes courses from https://pisa.ucsc.edu/class_search/index.php
and saves them to a JSON file.
"""

import json
import time
import sys
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

def scrape_ucsc_courses(output_file='ucsc_courses.json', verbose=False, screenshot_on_error=False):
    """
    Scrape UCSC courses and save to JSON file.
    
    Args:
        output_file: Path to output JSON file
        verbose: Print detailed debugging information
        screenshot_on_error: Take screenshot when errors occur
    """
    print("🚀 Starting UCSC course scraper...\n")
    
    # Setup Chrome options
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 20)
    
    try:
        print("📄 Navigating to UCSC class search page...")
        driver.get('https://pisa.ucsc.edu/class_search/index.php')
        
        # Wait for page to load - check for key elements
        print("⏳ Waiting for page to load...")
        try:
            # Wait for any form element to appear
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "form")))
            print("✅ Page loaded")
        except TimeoutException:
            print("⚠️  Form not found, but continuing...")
            if screenshot_on_error:
                driver.save_screenshot('error_no_form.png')
                print("   Screenshot saved to error_no_form.png")
        
        if verbose:
            print(f"   Page title: {driver.title}")
            print(f"   Current URL: {driver.current_url}")
        
        print("⚙️  Configuring search parameters...")
        
        # Find status select element with multiple strategies
        status_select = None
        status_selectors = [
            (By.NAME, "binds[:reg_status]"),
            (By.ID, "reg_status"),
            (By.CSS_SELECTOR, "select[name='binds[:reg_status]']"),
            (By.XPATH, "//select[@name='binds[:reg_status]']"),
            (By.NAME, "status"),  # Fallback
            (By.ID, "status"),  # Fallback
        ]
        
        for selector_type, selector_value in status_selectors:
            try:
                element = wait.until(EC.presence_of_element_located((selector_type, selector_value)))
                status_select = Select(element)
                if verbose:
                    print(f"   Found status select using {selector_type}: {selector_value}")
                break
            except (TimeoutException, NoSuchElementException):
                continue
        
        if status_select is None:
            print("⚠️  Could not find status select element")
            if verbose:
                # Print all select elements found
                selects = driver.find_elements(By.TAG_NAME, "select")
                print(f"   Found {len(selects)} select elements on page")
                for i, sel in enumerate(selects):
                    name = sel.get_attribute('name')
                    id_attr = sel.get_attribute('id')
                    print(f"   Select {i+1}: name='{name}', id='{id_attr}'")
            if screenshot_on_error:
                driver.save_screenshot('error_no_status_select.png')
        else:
            # Change status from "Open Classes" to "All Classes"
            status_values = ['all', 'All Classes', 'ALL', '1', '0']
            status_set = False
            for value in status_values:
                try:
                    status_select.select_by_value(value)
                    if status_select.first_selected_option.get_attribute('value') == value:
                        print(f"✅ Changed status to 'All Classes' (value: {value})")
                        status_set = True
                        break
                except:
                    continue
            
            if not status_set:
                # Try selecting by visible text
                try:
                    status_select.select_by_visible_text("All Classes")
                    print("✅ Changed status to 'All Classes' (by text)")
                    status_set = True
                except:
                    pass
            
            if not status_set:
                print("⚠️  Could not set status to 'All Classes', continuing anyway...")
        
        # Find term select element with multiple strategies
        selected_quarter = "2026 Winter"
        term_select = None
        term_selectors = [
            (By.NAME, "binds[:term]"),
            (By.ID, "term_dropdown"),
            (By.CSS_SELECTOR, "select[name='binds[:term]']"),
            (By.XPATH, "//select[@name='binds[:term]']"),
            (By.NAME, "term"),  # Fallback
            (By.ID, "term"),  # Fallback
        ]
        
        for selector_type, selector_value in term_selectors:
            try:
                element = wait.until(EC.presence_of_element_located((selector_type, selector_value)))
                term_select = Select(element)
                if verbose:
                    print(f"   Found term select using {selector_type}: {selector_value}")
                break
            except (TimeoutException, NoSuchElementException):
                continue
        
        if term_select is None:
            print("⚠️  Could not find term select element")
            if verbose:
                # Print all select elements found
                selects = driver.find_elements(By.TAG_NAME, "select")
                print(f"   Found {len(selects)} select elements on page")
                for i, sel in enumerate(selects):
                    name = sel.get_attribute('name')
                    id_attr = sel.get_attribute('id')
                    options = sel.find_elements(By.TAG_NAME, "option")
                    print(f"   Select {i+1}: name='{name}', id='{id_attr}', {len(options)} options")
            if screenshot_on_error:
                driver.save_screenshot('error_no_term_select.png')
        else:
            # Get all term options
            term_options = [option.get_attribute('value') for option in term_select.options]
            term_texts = [option.text for option in term_select.options]
            
            if verbose:
                print(f"   Found {len(term_options)} term options")
                for i, (val, text) in enumerate(zip(term_options[:5], term_texts[:5])):
                    print(f"     Option {i+1}: value='{val}', text='{text}'")
            
            # Find "2026 Winter Quarter" option
            winter_2026_idx = None
            for idx, text in enumerate(term_texts):
                if '2026' in text and 'Winter' in text:
                    winter_2026_idx = idx
                    break
            
            if winter_2026_idx is not None:
                term_select.select_by_index(winter_2026_idx)
                print(f"✅ Set term to '2026 Winter Quarter'")
                # Extract quarter format
                selected_text = term_texts[winter_2026_idx]
                match = re.search(r'(\d{4})\s+(Winter|Spring|Summer|Fall)', selected_text)
                if match:
                    selected_quarter = f"{match.group(1)} {match.group(2)}"
            else:
                # Use current selection
                try:
                    current_text = term_select.first_selected_option.text
                    print(f"📅 Current term: {current_text}")
                    match = re.search(r'(\d{4})\s+(Winter|Spring|Summer|Fall)', current_text)
                    if match:
                        selected_quarter = f"{match.group(1)} {match.group(2)}"
                    print(f"⚠️  Using current selection, quarter: {selected_quarter}")
                except:
                    print("⚠️  Could not determine current term")
        
        print("🔍 Submitting search form...")
        
        # Find and click search button with multiple strategies
        search_clicked = False
        search_button_selectors = [
            (By.CSS_SELECTOR, 'input[type="submit"][value="Search"]'),
            (By.CSS_SELECTOR, 'input.btn.btn-lg.btn-primary[value="Search"]'),
            (By.XPATH, '//input[@type="submit" and @value="Search"]'),
            (By.CSS_SELECTOR, 'input[type="submit"]'),
            (By.XPATH, '//input[@type="submit"]'),
            (By.CSS_SELECTOR, 'button[type="submit"]'),
            (By.XPATH, '//button[@type="submit"]'),
        ]
        
        for selector_type, selector_value in search_button_selectors:
            try:
                search_button = wait.until(EC.element_to_be_clickable((selector_type, selector_value)))
                search_button.click()
                search_clicked = True
                if verbose:
                    print(f"   Clicked search button using {selector_type}: {selector_value}")
                break
            except (TimeoutException, NoSuchElementException):
                continue
        
        if not search_clicked:
            # Try submitting form directly
            try:
                form = driver.find_element(By.TAG_NAME, "form")
                driver.execute_script("arguments[0].submit();", form)
                print("✅ Submitted form via JavaScript")
                search_clicked = True
            except Exception as e:
                print(f"⚠️  Could not submit form: {e}")
                if screenshot_on_error:
                    driver.save_screenshot('error_form_submit.png')
        
        if search_clicked:
            # Wait for navigation/URL change or results to load
            print("📊 Waiting for results to load...")
            try:
                # Wait for URL to change or for course panels to appear
                wait.until(lambda d: d.current_url != 'https://pisa.ucsc.edu/class_search/index.php' or 
                          len(d.find_elements(By.CSS_SELECTOR, "div.panel.panel-default.row[id^='rowpanel_']")) > 0)
                time.sleep(2)  # Additional wait for dynamic content
                print("✅ Results page loaded")
            except TimeoutException:
                print("⚠️  Timeout waiting for results, but continuing...")
                time.sleep(3)
        
        if verbose:
            print(f"   Current URL: {driver.current_url}")
            print(f"   Page title: {driver.title}")
        
        all_courses = []
        page_num = 1
        max_pages = 100  # Safety limit
        
        while page_num <= max_pages:
            print(f"   Parsing page {page_num}...")
            
            # Wait for course panels to load
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.panel.panel-default.row")))
                time.sleep(1)  # Additional wait for dynamic content
            except TimeoutException:
                print("⚠️  No course panels found on this page")
                if screenshot_on_error:
                    driver.save_screenshot(f'error_no_panels_page_{page_num}.png')
                break
            
            # Extract courses from current page
            try:
                # Find all course panels
                panels = driver.find_elements(By.CSS_SELECTOR, "div.panel.panel-default.row[id^='rowpanel_']")
                page_courses = []
                
                if verbose:
                    print(f"     Found {len(panels)} course panels on page {page_num}")
                
                for panel in panels:
                    try:
                        # Extract course name from h2 link
                        course_name_full = ""
                        course_link = None
                        try:
                            h2_link = panel.find_element(By.CSS_SELECTOR, "div.panel-heading h2 a")
                            course_name_full = h2_link.text.strip()
                            href = h2_link.get_attribute('href')
                            if href:
                                if href.startswith('http'):
                                    course_link = href
                                else:
                                    course_link = f"https://pisa.ucsc.edu{href}"
                        except NoSuchElementException:
                            # Try alternative selector
                            try:
                                h2 = panel.find_element(By.CSS_SELECTOR, "div.panel-heading h2")
                                course_name_full = h2.text.strip()
                                # Remove status icon text if present
                                course_name_full = re.sub(r'^(Open|Closed|Closed with Wait List)\s+', '', course_name_full)
                            except:
                                pass
                        
                        if not course_name_full:
                            continue
                        
                        # Parse course name: format is "AM 10 - 01    Lin Algebra for Engrs"
                        # Or "AM 10 - 01&nbsp;&nbsp;&nbsp;Lin Algebra for Engrs"
                        # Pattern: SUBJECT NUMBER - SECTION    TITLE
                        course_name_clean = re.sub(r'\s+', ' ', course_name_full)  # Normalize whitespace
                        course_match = re.match(r'^([A-Z]{2,4})\s+(\d+[A-Z]?)\s*-\s*(\d+)\s+(.+)$', course_name_clean)
                        if not course_match:
                            # Try without section: "AM 10 Lin Algebra for Engrs"
                            course_match = re.match(r'^([A-Z]{2,4})\s+(\d+[A-Z]?)\s+(.+)$', course_name_clean)
                        
                        if course_match:
                            subject = course_match.group(1)
                            course_num = course_match.group(2)
                            if len(course_match.groups()) == 4:
                                section = course_match.group(3)
                                title = course_match.group(4)
                            else:
                                section = "01"
                                title = course_match.group(3)
                        else:
                            # Fallback: try to extract at least subject and number
                            fallback_match = re.match(r'^([A-Z]{2,4})\s+(\d+[A-Z]?)', course_name_clean)
                            if fallback_match:
                                subject = fallback_match.group(1)
                                course_num = fallback_match.group(2)
                                title = course_name_clean.replace(f"{subject} {course_num}", "").strip()
                                if title.startswith('-'):
                                    title = title[1:].strip()
                                section = "01"
                            else:
                                if verbose:
                                    print(f"     Could not parse course name: {course_name_full}")
                                continue
                        
                        # Extract professor
                        professor = "TBA"
                        try:
                            # Look for the specific div structure: div with class "col-xs-6 col-sm-3" that contains fa-user icon
                            # This should be the instructor div, not a parent div
                            instructor_divs = panel.find_elements(By.XPATH, ".//div[@class='col-xs-6 col-sm-3' and .//i[contains(@class, 'fa-user')]]")
                            
                            # If that doesn't work, try a more general approach
                            if not instructor_divs:
                                instructor_divs = panel.find_elements(By.XPATH, ".//div[.//i[contains(@class, 'fa-user')]]")
                            
                            for div in instructor_divs:
                                # Get the full text of the div
                                full_text = div.text.strip()
                                
                                # Skip if this div contains "Class Number:" - we want the instructor div, not the class number div
                                if 'Class Number:' in full_text:
                                    continue
                                
                                # The div structure is: <i class="fa fa-user"></i><i class="sr-only">Instructor:</i> Name
                                # Remove "Instructor:" label if present (from sr-only element)
                                instructor_text = re.sub(r'^Instructor:?\s*', '', full_text, flags=re.IGNORECASE)
                                instructor_text = instructor_text.strip()
                                
                                # If there are still newlines or unwanted text, extract just the name part
                                if '\n' in instructor_text:
                                    # Split by newline and find the line that looks like a name
                                    lines = instructor_text.split('\n')
                                    for line in lines:
                                        line = line.strip()
                                        # Skip empty lines and lines with labels
                                        if not line or 'Instructor:' in line.lower() or 'Class Number' in line:
                                            continue
                                        # Check if this looks like a name (starts with capital letter, reasonable length)
                                        if re.match(r'^[A-Z][a-z]+', line) and len(line) > 2 and len(line) < 100:
                                            instructor_text = line
                                            break
                                
                                # Clean up: remove extra whitespace
                                instructor_text = re.sub(r'\s+', ' ', instructor_text).strip()
                                
                                # Validate it looks like a name
                                if instructor_text and instructor_text.lower() != 'tba':
                                    # Should start with capital letter and be reasonable length
                                    if re.match(r'^[A-Z]', instructor_text) and len(instructor_text) > 2 and len(instructor_text) < 100:
                                        professor = instructor_text
                                        break
                        except NoSuchElementException:
                            # Try alternative: look for any text that looks like a name in panel body
                            try:
                                panel_body = panel.find_element(By.CSS_SELECTOR, "div.panel-body")
                                # Look for pattern like "Ioannidis,N." or "Last,First" or "Last First"
                                # Find text that looks like a name after "Instructor:" or standalone
                                name_pattern = re.search(r'(?:Instructor:?\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,[A-Z]\.?)?)', panel_body.text)
                                if name_pattern:
                                    potential_name = name_pattern.group(1).strip()
                                    # Make sure it's not part of "Class Number:" or other labels
                                    if 'Class Number' not in potential_name and len(potential_name) > 2:
                                        professor = potential_name
                            except:
                                pass
                        
                        # Build full course name
                        course_name = f"{subject} {course_num} - {title}"
                        
                        # Check for duplicates
                        if not any(c['name'] == course_name and 
                                  c['professor'] == professor and 
                                  c['quarter'] == selected_quarter 
                                  for c in page_courses):
                            page_courses.append({
                                'name': course_name,
                                'subject': subject,
                                'professor': professor,
                                'quarter': selected_quarter,
                                'course_link': course_link
                            })
                    
                    except Exception as e:
                        if verbose:
                            print(f"     Error parsing panel: {e}")
                        continue
                
                all_courses.extend(page_courses)
                print(f"   Found {len(page_courses)} courses on page {page_num}")
                
                if len(page_courses) == 0:
                    # No courses found, might be last page
                    break
                
            except Exception as e:
                print(f"⚠️  Error parsing page {page_num}: {e}")
                if verbose:
                    import traceback
                    traceback.print_exc()
                if screenshot_on_error:
                    driver.save_screenshot(f'error_parse_page_{page_num}.png')
                break
            
            # Check for next page and navigate
            next_found = False
            try:
                # Look for "next" link in the pagination area
                next_link = driver.find_element(By.XPATH, "//a[contains(text(), 'next') or contains(text(), 'Next')]")
                if next_link.is_displayed():
                    # The link uses onclick to submit a form, so we need to execute the JavaScript
                    # Or we can find the form and submit it with action='next'
                    try:
                        # Find the resultsForm
                        results_form = driver.find_element(By.NAME, "resultsForm")
                        # Set the action to 'next'
                        driver.execute_script("document.resultsForm.action.value = 'next'; document.resultsForm.submit();")
                        next_found = True
                        page_num += 1
                        # Wait for next page to load
                        time.sleep(2)
                        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.panel.panel-default.row")))
                        if verbose:
                            print(f"     Navigated to page {page_num}")
                    except Exception as e:
                        if verbose:
                            print(f"     Could not submit form for next page: {e}")
                        # Try clicking the link directly as fallback
                        try:
                            next_link.click()
                            time.sleep(2)
                            next_found = True
                            page_num += 1
                        except:
                            pass
            except NoSuchElementException:
                # No next link found, we're on the last page
                if verbose:
                    print("     No 'next' link found, reached last page")
                break
            except Exception as e:
                if verbose:
                    print(f"     Error checking for next page: {e}")
                break
            
            if not next_found:
                # No next page found
                break
        
        print(f"\n✅ Found {len(all_courses)} total courses\n")
        
        # Save to JSON
        print(f"💾 Saving to {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_courses, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Saved {len(all_courses)} courses to {output_file}")
        
        # Show sample
        if all_courses:
            print("\n📋 Sample courses:")
            for i, course in enumerate(all_courses[:5], 1):
                print(f"   {i}. {course['name']} ({course['subject']}) - {course['professor']} - {course['quarter']}")
            if len(all_courses) > 5:
                print(f"   ... and {len(all_courses) - 5} more")
        else:
            print("\n⚠️  No courses were scraped. The page structure may have changed.")
            print("💡 Try running with --verbose flag to see debugging information")
            if screenshot_on_error:
                print("💡 Screenshots may have been saved for debugging")
        
        return all_courses
        
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        if screenshot_on_error:
            try:
                driver.save_screenshot('error_fatal.png')
                print("   Screenshot saved to error_fatal.png")
            except:
                pass
        raise
    finally:
        driver.quit()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Scrape UCSC courses')
    parser.add_argument('output_file', nargs='?', default='ucsc_courses.json',
                       help='Output JSON file path (default: ucsc_courses.json)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Print detailed debugging information')
    parser.add_argument('--screenshot', '-s', action='store_true',
                       help='Take screenshots on errors')
    
    args = parser.parse_args()
    
    scrape_ucsc_courses(args.output_file, verbose=args.verbose, screenshot_on_error=args.screenshot)
