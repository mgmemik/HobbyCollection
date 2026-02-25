#!/bin/bash

# AI Credits tablolarını migrate et
SQLITE_DB="/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST="localhost"
PG_DB="hobbycollection_dev"
PG_USER="gokhanmemik"

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "📊 UserAICredits migrate ediliyor..."

# UserAICredits - UserId unique olduğu için ON CONFLICT UPDATE kullanıyoruz
sqlite3 "$SQLITE_DB" "SELECT * FROM UserAICredits;" | while IFS='|' read -r id user_id package_id current_balance total_earned total_spent last_recharge_date next_recharge_date created_at updated_at; do
    [ -z "$updated_at" ] && updated_at="NULL" || updated_at="'$updated_at'::timestamp"
    
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"UserAICredits\" (
            \"Id\", \"UserId\", \"PackageId\", \"CurrentBalance\", \"TotalEarned\", \"TotalSpent\",
            \"LastRechargeDate\", \"NextRechargeDate\", \"CreatedAt\", \"UpdatedAt\"
        )
        VALUES (
            $id, '$user_id', $package_id, $current_balance, $total_earned, $total_spent,
            '$last_recharge_date'::timestamp, '$next_recharge_date'::timestamp,
            '$created_at'::timestamp, $updated_at
        )
        ON CONFLICT (\"UserId\") DO UPDATE SET
            \"PackageId\" = EXCLUDED.\"PackageId\",
            \"CurrentBalance\" = EXCLUDED.\"CurrentBalance\",
            \"TotalEarned\" = EXCLUDED.\"TotalEarned\",
            \"TotalSpent\" = EXCLUDED.\"TotalSpent\",
            \"LastRechargeDate\" = EXCLUDED.\"LastRechargeDate\",
            \"NextRechargeDate\" = EXCLUDED.\"NextRechargeDate\",
            \"UpdatedAt\" = EXCLUDED.\"UpdatedAt\";
    " 2>&1 | grep -v "already exists" || true
done

echo "📊 AICreditTransactions migrate ediliyor..."

# AICreditTransactions - Tüm transaction'ları migrate et
sqlite3 "$SQLITE_DB" "SELECT * FROM AICreditTransactions;" | while IFS='|' read -r id user_id transaction_type amount balance_before balance_after operation_type description product_id is_successful created_at; do
    [ -z "$operation_type" ] && operation_type="NULL" || operation_type="'$operation_type'"
    [ -z "$description" ] && description="NULL" || description="'${description//\'/\'\'}'"
    [ -z "$product_id" ] && product_id="NULL" || product_id="$product_id"
    
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"AICreditTransactions\" (
            \"Id\", \"UserId\", \"TransactionType\", \"Amount\", \"BalanceBefore\", \"BalanceAfter\",
            \"OperationType\", \"Description\", \"ProductId\", \"IsSuccessful\", \"CreatedAt\"
        )
        VALUES (
            $id, '$user_id', '$transaction_type', $amount, $balance_before, $balance_after,
            $operation_type, $description, $product_id, '$is_successful', '$created_at'::timestamp
        )
        ON CONFLICT (\"Id\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

# Sequence'i güncelle (eğer Id'ler migrate edildiyse)
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
    SELECT setval('\"AICreditTransactions_Id_seq\"', (SELECT MAX(\"Id\") FROM \"AICreditTransactions\"));
    SELECT setval('\"UserAICredits_Id_seq\"', (SELECT MAX(\"Id\") FROM \"UserAICredits\"));
" > /dev/null 2>&1

echo "✅ AI Credits migration tamamlandı!"

