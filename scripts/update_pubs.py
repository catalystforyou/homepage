import re
import os
from datetime import datetime

# Configuration
BIB_FILE = 'citations.bib'
OUTPUT_FILE = 'content/research.md'
MY_NAME_PATTERNS = ["Junren Li", "J. Li", "Li, Junren"] # Variations of your name to highlight

def parse_bibtex(file_path):
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found. Please export your BibTeX from Google Scholar and save it as {file_path}.")
        return []

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Simple regex based parser for standard Google Scholar BibTeX
    entries = []
    raw_entries = re.split(r'@(\w+)\s*{', content)
    
    # raw_entries[0] is empty or garbage before first entry
    # then we have pairs: type, body
    
    for i in range(1, len(raw_entries), 2):
        entry_type = raw_entries[i]
        body = raw_entries[i+1]
        
        # Extract key (citation key)
        key_match = re.match(r'([^,]+),', body)
        if not key_match:
            continue
        key = key_match.group(1).strip()
        
        # Extract fields
        fields = {}
        # This regex looks for field = {value} or field = "value" or field = value
        # It handles multi-line values reasonably well for standard bibtex
        field_pattern = re.compile(r'(\w+)\s*=\s*[\{"](.*?)[\}"]\s*(?:,|$)', re.DOTALL)
        
        # A simpler approach: split by lines and look for key=value
        # Google Scholar bibtex is usually well formatted
        lines = body.split('\n')
        current_field = None
        current_value = []
        
        for line in lines:
            line = line.strip()
            if not line or line == '}':
                continue
                
            # Check for new field
            match = re.match(r'(\w+)\s*=\s*[\{"]?(.*)', line)
            if match:
                # Save previous field if exists
                if current_field:
                    fields[current_field] = ' '.join(current_value).replace('},', '').replace('",', '').replace('}', '').replace('"', '').strip()
                
                current_field = match.group(1).lower()
                val = match.group(2)
                # Check if value ends on this line
                if (val.endswith('},') or val.endswith('",') or val.endswith('}')) and not (val.count('{') > val.count('}')):
                     fields[current_field] = val.replace('},', '').replace('",', '').replace('}', '').replace('"', '').strip()
                     current_field = None
                     current_value = []
                else:
                    current_value = [val]
            else:
                # Continuation of previous field
                if current_field:
                    if (line.endswith('},') or line.endswith('",') or line.endswith('}')) and not (line.count('{') > line.count('}')):
                        current_value.append(line.replace('},', '').replace('",', '').replace('}', '').replace('"', '').strip())
                        fields[current_field] = ' '.join(current_value)
                        current_field = None
                        current_value = []
                    else:
                        current_value.append(line)
                        
        entries.append(fields)

    return entries

def decode_latex(text):
    """
    Simple decoder for common LaTeX accents and special characters.
    """
    if not text:
        return ""
    
    replacements = [
        (r"{\\'a}", "á"), (r"\\'a", "á"),
        (r"{\\'e}", "é"), (r"\\'e", "é"),
        (r"{\\'i}", "í"), (r"\\'i", "í"),
        (r"{\\'o}", "ó"), (r"\\'o", "ó"),
        (r"{\\'u}", "ú"), (r"\\'u", "ú"),
        (r"{\\'c}", "ć"), (r"\\'c", "ć"),
        (r"{\\'n}", "ń"), (r"\\'n", "ń"),
        (r"{\\'s}", "ś"), (r"\\'s", "ś"),
        (r"{\\'z}", "ź"), (r"\\'z", "ź"),
        (r"{\\`a}", "à"), (r"\\`a", "à"),
        (r"{\\`e}", "è"), (r"\\`e", "è"),
        (r"{\\`i}", "ì"), (r"\\`i", "ì"),
        (r"{\\`o}", "ò"), (r"\\`o", "ò"),
        (r"{\\`u}", "ù"), (r"\\`u", "ù"),
        (r"{\\\"a}", "ä"), (r"\\\"a", "ä"),
        (r"{\\\"e}", "ë"), (r"\\\"e", "ë"),
        (r"{\\\"i}", "ï"), (r"\\\"i", "ï"),
        (r"{\\\"o}", "ö"), (r"\\\"o", "ö"),
        (r"{\\\"u}", "ü"), (r"\\\"u", "ü"),
        (r"{\\^a}", "â"), (r"\\^a", "â"),
        (r"{\\^e}", "ê"), (r"\\^e", "ê"),
        (r"{\\^i}", "î"), (r"\\^i", "î"),
        (r"{\\^o}", "ô"), (r"\\^o", "ô"),
        (r"{\\^u}", "û"), (r"\\^u", "û"),
        (r"{\\~n}", "ñ"), (r"\\~n", "ñ"),
        (r"{\\c{c}}", "ç"), (r"\\c{c}", "ç"),
        (r"{\\aa}", "å"), (r"\\aa", "å"),
        (r"{\\o}", "ø"), (r"\\o", "ø"),
        (r"{\\ss}", "ß"), (r"\\ss", "ß"),
        (r"---", "—"), (r"--", "–"),
        (r"{", ""), (r"}", "") # Remove remaining braces
    ]
    
    for pattern, replacement in replacements:
        text = text.replace(pattern, replacement)
    return text

def format_authors(author_str):
    if not author_str:
        return ""
    
    # Decode LaTeX characters first
    author_str = decode_latex(author_str)
    
    authors = author_str.split(' and ')
    formatted_authors = []
    has_equal_contrib = False

    for author in authors:
        author = author.strip()
        is_me = False
        is_equal = False
        
        # Check for equal contribution marker (user should add * in bibtex)
        if author.endswith('*'):
            is_equal = True
            author = author[:-1].strip()
            has_equal_contrib = True
            
        for my_name in MY_NAME_PATTERNS:
            # Simple check: if my name is in the author string
            # We remove * before checking
            if my_name.lower() in author.lower():
                is_me = True
                break
        
        display_name = author
        if is_me:
            display_name = f"<strong>{display_name}</strong>"
            
        if is_equal:
            display_name += "*"
            
        formatted_authors.append(display_name)
            
    result = ", ".join(formatted_authors)
    if has_equal_contrib:
        result += '<br><span style="font-size: 0.8em; color: #666;">* Equal contribution</span>'
        
    return result

def generate_markdown(entries):
    # Sort by year descending
    entries.sort(key=lambda x: x.get('year', '0000'), reverse=True)
    
    md_content = """---
title: "Research"
date: 2025-12-05
draft: false
summary: "My publications and research projects."
---

## Publications

"""
    current_year = None
    
    for entry in entries:
        title = entry.get('title', 'Untitled')
        authors = format_authors(entry.get('author', ''))
        journal = entry.get('journal', entry.get('booktitle', entry.get('publisher', '')))
        year = entry.get('year', 'Unknown')
        url = entry.get('url', '')
        
        # Group by year (optional, but looks nice)
        # if year != current_year:
        #     md_content += f"### {year}\n\n"
        #     current_year = year

        md_content += f'<div class="publication-entry" style="margin-bottom: 20px;">\n'
        md_content += f'    <div style="font-size: 1.1em; font-weight: bold;">{title}</div>\n'
        md_content += f'    <div style="color: #444;">{authors}</div>\n'
        
        venue = f"{journal}, {year}" if journal else year
        md_content += f'    <div style="font-style: italic; color: #666;">{venue}</div>\n'
        
        links = []
        if url:
            links.append(f'<a href="{url}" target="_blank">[Link]</a>')
        # You can add logic here to find PDF links if you have a naming convention or extra fields
        
        if links:
            md_content += f'    <div style="margin-top: 4px;">{" ".join(links)}</div>\n'
            
        md_content += f'</div>\n\n'
        
    return md_content

def main():
    print("Parsing BibTeX...")
    entries = parse_bibtex(BIB_FILE)
    if not entries:
        return

    print(f"Found {len(entries)} publications.")
    md_content = generate_markdown(entries)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    print(f"Successfully updated {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
