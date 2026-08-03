import sqlite3
import urllib.request
import json

conn = sqlite3.connect('brain.db')
conn.row_factory = sqlite3.Row
row = conn.execute("SELECT * FROM orders WHERE status='pending' ORDER BY id DESC LIMIT 1").fetchone()
if row:
    payment_code = row['payment_code']
    print(f"Latest pending code: {payment_code}")
    
    # Simulate webhook
    url = "http://localhost:8000/api/webhook/sepay"
    req = urllib.request.Request(url, data=json.dumps({"transaction_content": payment_code}).encode(), headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(req)
    print("Webhook simulated successfully.")
else:
    print("No pending orders found.")
