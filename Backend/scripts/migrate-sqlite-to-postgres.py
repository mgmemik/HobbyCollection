#!/usr/bin/env python3
"""
SQLite'tan PostgreSQL'e veri migration script'i
"""
import sqlite3
import psycopg2
import sys
from datetime import datetime

SQLITE_DB = "/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST = "localhost"
PG_DB = "hobbycollection_dev"
PG_USER = "gokhanmemik"
PG_PASSWORD = ""

def migrate_table(sqlite_conn, pg_conn, table_name, columns_map=None):
    """Bir tabloyu SQLite'tan PostgreSQL'e migrate eder"""
    print(f"Migrating {table_name}...")
    
    # SQLite'tan veriyi oku
    cursor_sqlite = sqlite_conn.cursor()
    cursor_sqlite.execute(f"SELECT * FROM {table_name}")
    rows = cursor_sqlite.fetchall()
    column_names = [description[0] for description in cursor_sqlite.description]
    
    if not rows:
        print(f"  No data in {table_name}")
        return
    
    # PostgreSQL'e yaz
    cursor_pg = pg_conn.cursor()
    
    # Column mapping varsa kullan
    if columns_map:
        pg_columns = [columns_map.get(col, col) for col in column_names]
    else:
        pg_columns = column_names
    
    # Placeholder oluştur
    placeholders = ', '.join(['%s'] * len(pg_columns))
    columns_str = ', '.join([f'"{col}"' for col in pg_columns])
    
    # Insert query
    insert_query = f'INSERT INTO "{table_name}" ({columns_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
    
    try:
        for row in rows:
            cursor_pg.execute(insert_query, row)
        pg_conn.commit()
        print(f"  Migrated {len(rows)} rows")
    except Exception as e:
        pg_conn.rollback()
        print(f"  Error migrating {table_name}: {e}")
        raise

def main():
    print("Starting SQLite to PostgreSQL migration...")
    
    # SQLite bağlantısı
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    
    # PostgreSQL bağlantısı
    pg_conn = psycopg2.connect(
        host=PG_HOST,
        database=PG_DB,
        user=PG_USER,
        password=PG_PASSWORD
    )
    
    try:
        # Önemli tabloları migrate et
        tables = [
            "AspNetUsers",
            "Categories",
            "Products",
            "ProductPhotos",
            "Brands",
            "CategoryTranslations",
            "CategoryClosures",
            "ProductLikes",
            "ProductSaves",
            "Comments",
            "CommentLikes",
            "Notifications",
            "Follows",
        ]
        
        for table in tables:
            try:
                migrate_table(sqlite_conn, pg_conn, table)
            except Exception as e:
                print(f"Failed to migrate {table}: {e}")
                continue
        
        print("\nMigration completed!")
        
    finally:
        sqlite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    main()

