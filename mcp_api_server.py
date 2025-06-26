# filepath: d:\git_ck\openglass_laiii\openglass_laiii_618\openglass_laiii_1\mcp_api_server.py
from flask import Flask, request, jsonify
import sys
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('MCP_API')

try:
    # 使用本地复制的mcp_tools.py
    import mcp_tools
    get_weather = mcp_tools.get_weather
    geocode = mcp_tools.geocode
    logger.info("Successfully imported local MCP tools")
except Exception as e:
    logger.error(f"Failed to import MCP tools: {e}")
    import traceback
    logger.error(traceback.format_exc())
    sys.exit(1)

# Create Flask application
app = Flask(__name__)

# Add CORS support
@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

@app.route('/api/weather', methods=['GET'])
def weather():
    city = request.args.get('city', '')
    if not city:
        return jsonify({"success": False, "error": "City parameter is required"}), 400
    
    logger.info(f"Querying weather: {city}")
    result = get_weather(city)
    logger.info(f"Weather query result: {result}")
    return jsonify(result)

@app.route('/api/geocode', methods=['GET'])
def geo():
    address = request.args.get('address', '')
    city = request.args.get('city', '')
    
    if not address:
        return jsonify({"success": False, "error": "Address parameter is required"}), 400
    
    logger.info(f"Querying geocode: {address}, city: {city}")
    result = geocode(address, city)
    return jsonify(result)

if __name__ == '__main__':
    logger.info("MCP API server starting...")
    app.run(debug=True, host='0.0.0.0', port=5000)