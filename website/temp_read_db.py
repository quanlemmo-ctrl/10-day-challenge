import sqlite3
import json

conn = sqlite3.connect('brain.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

result = {}
for table in tables:
    table_name = table[0]
    cursor.execute(f"SELECT * FROM {table_name}")
    result[table_name] = cursor.fetchall()

with open('db_dump.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
