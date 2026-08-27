import os
import time
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
cache = {
    "data": None,
    "timestamp": 0
}
CACHE_DURATION = 300  # 5 minutes in seconds

def parse_content(html_content):
    """
    Parses BigQuery release notes HTML content and splits it into discrete sub-updates
    by grouping elements following each <h3> tag (which lists the update type like Feature, Change, etc.).
    """
    if not html_content:
        return []
        
    soup = BeautifulSoup(html_content, 'html.parser')
    updates = []
    
    headings = soup.find_all('h3')
    if not headings:
        # If no h3 is found, represent the entire content block as a single generic update
        text_content = soup.get_text().strip()
        updates.append({
            'type': 'Update',
            'html': str(soup),
            'text': text_content
        })
        return updates
        
    for h3 in headings:
        update_type = h3.get_text().strip()
        sibling_html = []
        sibling_text = []
        
        # Traverse siblings until the next h3 heading
        curr = h3.next_sibling
        while curr and curr.name != 'h3':
            if curr.name:
                sibling_html.append(str(curr))
                sibling_text.append(curr.get_text().strip())
            elif isinstance(curr, str) and curr.strip():
                sibling_text.append(curr.strip())
            curr = curr.next_sibling
            
        html_str = "".join(sibling_html).strip()
        text_str = " ".join([t for t in sibling_text if t]).strip()
        
        updates.append({
            'type': update_type,
            'html': html_str,
            'text': text_str
        })
        
    return updates

def fetch_and_parse():
    """
    Fetches the BigQuery Atom feed and parses the XML structure.
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=10)
        response.raise_for_status()
        xml_content = response.content
        
        # Parse XML
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(xml_content)
        
        entries = root.findall('atom:entry', namespaces)
        parsed_entries = []
        
        for entry in entries:
            title_elem = entry.find('atom:title', namespaces)
            title = title_elem.text if title_elem is not None else "Unknown Date"
            
            updated_elem = entry.find('atom:updated', namespaces)
            updated = updated_elem.text if updated_elem is not None else ""
            
            link_elem = entry.find("atom:link[@rel='alternate']", namespaces)
            link = link_elem.attrib.get('href') if link_elem is not None else ""
            
            id_elem = entry.find('atom:id', namespaces)
            entry_id = id_elem.text if id_elem is not None else ""
            
            content_elem = entry.find('atom:content', namespaces)
            html_content = content_elem.text if content_elem is not None else ""
            
            updates = parse_content(html_content)
            
            parsed_entries.append({
                'id': entry_id,
                'title': title,
                'updated': updated,
                'link': link,
                'updates': updates
            })
            
        return parsed_entries, None
    except Exception as e:
        return None, str(e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    if force_refresh or not cache["data"] or (current_time - cache["timestamp"] > CACHE_DURATION):
        data, error = fetch_and_parse()
        if error:
            # Fallback to cache if feed server is down/unreachable
            if cache["data"]:
                return jsonify({
                    "data": cache["data"],
                    "warning": f"Failed to fetch live updates ({error}). Displaying cached content.",
                    "cached_at": cache["timestamp"],
                    "is_cached": True
                })
            return jsonify({"error": f"Failed to fetch release notes: {error}"}), 500
        
        cache["data"] = data
        cache["timestamp"] = current_time
        
    return jsonify({
        "data": cache["data"],
        "cached_at": cache["timestamp"],
        "is_cached": not force_refresh and (current_time - cache["timestamp"] <= CACHE_DURATION)
    })

if __name__ == '__main__':
    # Run Flask server locally
    app.run(debug=True, host='127.0.0.1', port=5001)
