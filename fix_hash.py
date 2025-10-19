import pyodbc

conn_str = (
    "Driver={ODBC Driver 17 for SQL Server};"
    "Server=tcp:deepbluedb.database.windows.net,1433;"
    "Database=DeepBlueDB;"
    "Uid=Deepblueadmin;"
    "Pwd=Atlantic!Beaufort6633;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
    "Connection Timeout=30;"
)

hash_value = "$pbkdf2-sha256$29000$McoCszbKslFSl1a1m5xYhA$YoF7ELKhY.LnJeAcV1knIrhlF4Zyt4AT4ZDLc1Dnd3I"

conn = pyodbc.connect(conn_str)
cursor = conn.cursor()
cursor.execute("UPDATE dbo.Users SET HashedPassword=? WHERE Username='admin2'", (hash_value,))
conn.commit()
cursor.close()
conn.close()
print("✅ Hash updated successfully")
