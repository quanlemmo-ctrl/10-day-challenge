import http.server
import socketserver
import urllib.parse
import json
import sqlite3
import os
import urllib.request
import datetime
import threading

PORT = 8000
DB_PATH = os.path.join(os.path.dirname(__file__), 'brain.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Hàm lấy API key từ file (hoặc cấu hình cứng nếu deploy bị xoá)
def get_resend_key():
    try:
        with open('resend_config.txt', 'r') as f:
            return f.read().strip()
    except:
        return "" # Sẽ trả về lỗi nếu không có key

# Hàm gọi API Resend
def send_resend_email(to_email, subject, html_content, scheduled_at=None):
    key = get_resend_key()
    if not key:
        print("Lỗi: Không tìm thấy API Key của Resend")
        return
        
    payload = {
        "from": "Quân <hi@lehoangquan.name.vn>",
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    
    if scheduled_at:
        payload["scheduled_at"] = scheduled_at

    req = urllib.request.Request(
        'https://api.resend.com/emails',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        },
        method='POST'
    )
    
    try:
        urllib.request.urlopen(req)
        print(f"Đã gửi email tới {to_email}")
    except Exception as e:
        print(f"Lỗi gửi email tới {to_email}: {str(e)}")

SEPAY_API_TOKEN = "DÁN_API_TOKEN_CỦA_BẠN_VÀO_ĐÂY"

class AdminAPIHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path

        if path == '/admin' or path == '/admin/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            admin_path = os.path.join(os.path.dirname(__file__), 'admin.html')
            if os.path.exists(admin_path):
                with open(admin_path, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(b"admin.html not found!")
            return

        if path.startswith('/api/'):
            self.handle_api_get(path, parsed_path)
            return
            
        super().do_GET()

    def check_sepay_transaction(self, payment_code):
        if SEPAY_API_TOKEN == "DÁN_API_TOKEN_CỦA_BẠN_VÀO_ĐÂY":
            return False
            
        url = "https://my.sepay.vn/userapi/transactions/list"
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {SEPAY_API_TOKEN}'})
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                if 'transactions' in data:
                    for tx in data['transactions']:
                        if payment_code.upper() in tx.get('transaction_content', '').upper():
                            return True
        except Exception as e:
            print("Error checking Sepay:", e)
        return False

    def handle_api_get(self, path, parsed_path):
        conn = get_db_connection()
        data = []
        try:
            if path == '/api/products':
                rows = conn.execute('SELECT * FROM products').fetchall()
                data = [dict(r) for r in rows]
            elif path == '/api/customers':
                rows = conn.execute('SELECT * FROM customers ORDER BY created_at DESC').fetchall()
                data = [dict(r) for r in rows]
            elif path == '/api/orders':
                rows = conn.execute('''
                    SELECT orders.*, customers.name as customer_name, products.name as product_name 
                    FROM orders 
                    LEFT JOIN customers ON orders.customer_id = customers.id
                    LEFT JOIN products ON orders.product_id = products.id
                    ORDER BY orders.created_at DESC
                ''').fetchall()
                data = [dict(r) for r in rows]
            elif path.startswith('/api/orders/check'):
                query_components = urllib.parse.parse_qs(parsed_path.query)
                order_id = query_components.get('id', [None])[0]
                if order_id:
                    row = conn.execute('SELECT status FROM orders WHERE id = ?', (order_id,)).fetchone()
                    if row:
                        data = {"status": row['status']}
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except Exception as e:
            self.send_error(500, str(e))
        finally:
            conn.close()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        if path.startswith('/api/'):
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            conn = get_db_connection()
            try:
                if path == '/api/products':
                    conn.execute('INSERT INTO products (name, price, description) VALUES (?, ?, ?)', 
                                 (data['name'], data['price'], data.get('description', '')))
                    conn.commit()
                    self.send_response(201)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"status": "ok"}')
                elif path == '/api/orders/update':
                    conn.execute('UPDATE orders SET status = ? WHERE id = ?', 
                                 (data['status'], data['id']))
                    conn.commit()
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"status": "ok"}')
                elif path == '/api/orders/create':
                    cursor = conn.cursor()
                    cursor.execute('INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)', 
                                 (data.get('name', 'Khách'), data['phone'], data.get('email', '')))
                    customer_id = cursor.lastrowid
                    
                    # Giả định mua sản phẩm ID 1 (Hoặc sản phẩm đầu tiên)
                    cursor.execute('INSERT INTO orders (customer_id, product_id, status, payment_code) VALUES (?, ?, ?, ?)', 
                                 (customer_id, 1, 'pending', f"SEVQR HD{data['phone']}"))
                    order_id = cursor.lastrowid
                    conn.commit()
                    
                    self.send_response(201)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "ok", "order_id": order_id}).encode('utf-8'))
                elif path == '/api/waitlist':
                    email = data.get('email', '')
                    cursor = conn.cursor()
                    cursor.execute('INSERT INTO customers (name, email) VALUES (?, ?)', 
                                 (data.get('name', 'Khách'), email))
                    conn.commit()
                    
                    if email:
                        if '+test' in email:
                            # Chế độ test: Gửi cả 3 email ngay lập tức
                            threading.Thread(target=send_resend_email, args=(email, EMAIL_1["subject"], EMAIL_1["html"])).start()
                            threading.Thread(target=send_resend_email, args=(email, EMAIL_2["subject"], EMAIL_2["html"])).start()
                            threading.Thread(target=send_resend_email, args=(email, EMAIL_3["subject"], EMAIL_3["html"])).start()
                        else:
                            # Thực tế: Email 1 gửi ngay, Email 2 sau 2 ngày, Email 3 sau 3 ngày
                            now = datetime.datetime.utcnow()
                            t2 = now + datetime.timedelta(days=2)
                            t3 = now + datetime.timedelta(days=3)
                            
                            threading.Thread(target=send_resend_email, args=(email, EMAIL_1["subject"], EMAIL_1["html"])).start()
                            threading.Thread(target=send_resend_email, args=(email, EMAIL_2["subject"], EMAIL_2["html"], t2.isoformat() + "Z")).start()
                            threading.Thread(target=send_resend_email, args=(email, EMAIL_3["subject"], EMAIL_3["html"], t3.isoformat() + "Z")).start()
                    
                    self.send_response(201)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"status": "ok"}')
                elif path == '/api/webhook/sepay':
                    # Sepay sẽ gọi vào đây khi có tiền vào
                    # Nội dung chuyển khoản thường nằm trong data['transaction_content']
                    content = (data.get('content') or data.get('transaction_content') or '').upper()
                    
                    # Tìm đơn hàng nào có payment_code (VD: HD0912...) nằm trong nội dung chuyển khoản
                    rows = conn.execute('SELECT id, payment_code FROM orders WHERE status = "pending"').fetchall()
                    for row in rows:
                        if row['payment_code'].upper() in content:
                            conn.execute('UPDATE orders SET status = "success" WHERE id = ?', (row['id'],))
                            conn.commit()
                            break
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"success": true}')
                else:
                    self.send_error(404, "Not Found")
            except Exception as e:
                self.send_error(500, str(e))
            finally:
                conn.close()
            return
            
        super().do_POST()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    server_address = ('0.0.0.0', port)
    with socketserver.TCPServer(server_address, AdminAPIHandler) as httpd:
        print(f"Serving at http://0.0.0.0:{port}")
        httpd.serve_forever()
