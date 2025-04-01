from flask import Flask, request, jsonify, send_from_directory, session
import json
import os
from flask_cors import CORS
from functools import wraps

app = Flask(__name__, static_folder=".", static_url_path="")
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev')  # Use environment variable for secret key
CORS(app, supports_credentials=True)  # Enable CORS with credentials

# Get password from environment variable
PASSWORD = os.environ.get('START_ICHI_PASSWORD', 'admin')  # Default to 'admin' if not set

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('authenticated'):
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

# Define data directory relative to this file
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "data.json")
BANNER_FILE = os.path.join(DATA_DIR, "banner.json")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")

# Create data directory if it doesn't exist
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Initialize JSON file if it doesn't exist
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump({"items": []}, f)

# Initialize banner JSON file if it doesn't exist
if not os.path.exists(BANNER_FILE):
    with open(BANNER_FILE, "w") as f:
        json.dump({"bannerUrl": "https://cdn.midjourney.com/11cffed4-8a58-41de-98ff-d0cbd01cc75a/0_2.png"}, f)

# Initialize config JSON file if it doesn't exist
if not os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, "w") as f:
        json.dump({"pageTitle": "start:ichi", "favicon": "%PUBLIC_URL%/favicon.ico"}, f)

# Helper function to read from JSON file
def read_data():
    with open(DATA_FILE, "r") as f:
        return json.load(f)

# Helper function to write to JSON file
def write_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

# Helper function to read banner data
def read_banner():
    with open(BANNER_FILE, "r") as f:
        return json.load(f)

# Helper function to write banner data
def write_banner(data):
    with open(BANNER_FILE, "w") as f:
        json.dump(data, f, indent=2)

# Helper function to read config data
def read_config():
    with open(CONFIG_FILE, "r") as f:
        return json.load(f)

# Helper function to write config data
def write_config(data):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=2)

# Add login endpoint
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    if data.get('password') == PASSWORD:
        session['authenticated'] = True
        return jsonify({"message": "Login successful"})
    return jsonify({"error": "Invalid password"}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop('authenticated', None)
    return jsonify({"message": "Logged out successfully"})

@app.route("/api/check-auth", methods=["GET"])
def check_auth():
    return jsonify({"authenticated": session.get('authenticated', False)})

# Protect all API routes with authentication
@app.route("/api/items", methods=["GET"])
@login_required
def get_items():
    data = read_data()
    return jsonify(data["items"])

@app.route("/api/banner", methods=["GET"])
@login_required
def get_banner():
    banner_data = read_banner()
    return jsonify(banner_data)

@app.route("/api/banner", methods=["POST"])
@login_required
def update_banner():
    new_banner_data = request.json
    write_banner(new_banner_data)
    return jsonify(new_banner_data), 200

@app.route("/api/config", methods=["GET"])
@login_required
def get_config():
    config_data = read_config()
    return jsonify(config_data)

@app.route("/api/config", methods=["POST"])
@login_required
def update_config():
    new_config_data = request.json
    write_config(new_config_data)
    return jsonify(new_config_data), 200

@app.route("/api/items", methods=["POST"])
@login_required
def add_item():
    data = read_data()
    new_item = request.json
    
    if data["items"]:
        new_id = max(item["id"] for item in data["items"]) + 1
    else:
        new_id = 1
        
    new_item["id"] = new_id
    data["items"].append(new_item)
    write_data(data)
    return jsonify(new_item), 201

@app.route("/api/items/<int:item_id>", methods=["PUT"])
@login_required
def update_item(item_id):
    data = read_data()
    for i, item in enumerate(data["items"]):
        if item["id"] == item_id:
            updated_item = request.json
            updated_item["id"] = item_id
            data["items"][i] = updated_item
            write_data(data)
            return jsonify(updated_item)
    return jsonify({"error": "Item not found"}), 404

@app.route("/api/items/<int:item_id>", methods=["DELETE"])
@login_required
def delete_item(item_id):
    data = read_data()
    for i, item in enumerate(data["items"]):
        if item["id"] == item_id:
            del data["items"][i]
            write_data(data)
            return jsonify({"message": "Item deleted"})
    return jsonify({"error": "Item not found"}), 404

# Serve React app
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    print(f"Serving path: {path}")
    print(f"Static folder: {app.static_folder}")
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True) 
