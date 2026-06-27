from flask import Flask, send_from_directory, request, jsonify
import json
import os
import urllib.request
import urllib.parse

app = Flask(__name__, static_folder='frontend/dist', static_url_path='')

DB_FILE = 'db.json'

def load_db():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading database: {e}")
    return {"gestures": [], "stats": {}}

def save_db(data):
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error writing to database: {e}")
        return False

# Serve React static site
@app.route('/')
def serve_index():
    if not os.path.exists(os.path.join(app.static_folder, 'index.html')):
        return "React app has not been built yet. Please run 'npm run build' in the frontend folder.", 404
    return send_from_directory(app.static_folder, 'index.html')

# Serve static asset files directly
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# Sync APIs
@app.route('/api/sync', methods=['GET'])
def get_sync():
    data = load_db()
    return jsonify(data)

@app.route('/api/sync', methods=['POST'])
def post_sync():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request payload"}), 400
    
    gestures = data.get('gestures', [])
    stats = data.get('stats', {})
    
    db_data = {
        "gestures": gestures,
        "stats": stats
    }
    
    if save_db(db_data):
        return jsonify({"status": "success", "message": "Data synchronized successfully"})
    else:
        return jsonify({"error": "Failed to save data"}), 500

# Server-Side Translation Proxy
@app.route('/api/translate', methods=['POST'])
def translate():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request payload"}), 400
    
    text = data.get('text', '')
    target_lang = data.get('target_lang', 'en')
    
    if not text or text.strip() == '' or target_lang == 'en':
        return jsonify({"translatedText": text})
    
    langpair = f"en|{target_lang}"
    url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(text)}&langpair={langpair}"
    
    try:
        # Include User-Agent to avoid being blocked by the service
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            translated_text = res_data.get('responseData', {}).get('translatedText', '')
            if translated_text:
                return jsonify({"translatedText": translated_text})
    except Exception as e:
        print(f"Server-side translation error: {e}")
        
    return jsonify({"translatedText": ""})

if __name__ == '__main__':
    # Running Flask backend locally on port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
