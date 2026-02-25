using Microsoft.EntityFrameworkCore.Migrations;
using System;

#nullable disable

namespace HobbyCollection.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductBadges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Product tablosuna badge alanlarını ekle
            migrationBuilder.AddColumn<bool>(
                name: "IsRare",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsMint",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsGraded",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsSigned",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsLimited",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsFeatured",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsOnSale",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "OriginalPrice",
                table: "Products",
                type: "numeric(18,2)",
                nullable: true);

            // 2. ProductBadges tablosunu oluştur
            migrationBuilder.CreateTable(
                name: "ProductBadges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Badge = table.Column<int>(type: "integer", nullable: false),
                    IsAutomatic = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now() AT TIME ZONE 'utc'"),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductBadges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductBadges_Products",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                },
                comment: "Ürün rozetleri - Retro koleksiyoncular için özel badge sistemi");

            // 3. Index'leri oluştur
            migrationBuilder.CreateIndex(
                name: "IX_ProductBadges_ProductId",
                table: "ProductBadges",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductBadges_Badge",
                table: "ProductBadges",
                column: "Badge");

            migrationBuilder.CreateIndex(
                name: "IX_ProductBadges_ExpiresAt",
                table: "ProductBadges",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_ProductBadges_ProductId_Badge",
                table: "ProductBadges",
                columns: new[] { "ProductId", "Badge" },
                unique: true);

            // 4. Column comments ekle
            migrationBuilder.Sql(@"
                COMMENT ON COLUMN ""ProductBadges"".""Badge"" IS 'Badge türü: 1=Hot, 2=New, 3=Rare, 4=Mint, 5=Graded, 6=Signed, 7=Limited, 8=Featured, 9=Trending, 10=Sale';
                COMMENT ON COLUMN ""Products"".""IsRare"" IS 'Nadir ürün rozeti';
                COMMENT ON COLUMN ""Products"".""IsMint"" IS 'Mint kondisyon rozeti';
                COMMENT ON COLUMN ""Products"".""IsGraded"" IS 'Profesyonel puanlanmış rozeti';
                COMMENT ON COLUMN ""Products"".""IsSigned"" IS 'İmzalı/otograflı rozeti';
                COMMENT ON COLUMN ""Products"".""IsLimited"" IS 'Sınırlı üretim rozeti';
                COMMENT ON COLUMN ""Products"".""IsFeatured"" IS 'Editör seçimi rozeti';
                COMMENT ON COLUMN ""Products"".""IsOnSale"" IS 'İndirimli rozeti';
                COMMENT ON COLUMN ""Products"".""OriginalPrice"" IS 'İndirimli fiyat için orijinal fiyat';
            ");

            // 5. Mevcut ürünler için otomatik badge'leri hesapla
            migrationBuilder.Sql(@"
                -- NEW Badge: Son 7 günde eklenen ürünler
                INSERT INTO ""ProductBadges"" (""ProductId"", ""Badge"", ""IsAutomatic"", ""AssignedAt"", ""ExpiresAt"")
                SELECT 
                    ""Id"" as ""ProductId"",
                    2 as ""Badge"",
                    true as ""IsAutomatic"",
                    now() AT TIME ZONE 'utc' as ""AssignedAt"",
                    ""CreatedAt"" + INTERVAL '7 days' as ""ExpiresAt""
                FROM ""Products""
                WHERE ""CreatedAt"" >= (now() AT TIME ZONE 'utc') - INTERVAL '7 days'
                ON CONFLICT (""ProductId"", ""Badge"") DO NOTHING;

                -- HOT Badge: 10+ beğeni alan ürünler
                INSERT INTO ""ProductBadges"" (""ProductId"", ""Badge"", ""IsAutomatic"", ""AssignedAt"", ""ExpiresAt"")
                SELECT 
                    p.""Id"" as ""ProductId"",
                    1 as ""Badge"",
                    true as ""IsAutomatic"",
                    now() AT TIME ZONE 'utc' as ""AssignedAt"",
                    NULL as ""ExpiresAt""
                FROM ""Products"" p
                WHERE (
                    SELECT COUNT(*) 
                    FROM ""ProductLikes"" pl 
                    WHERE pl.""ProductId"" = p.""Id""
                ) >= 10
                ON CONFLICT (""ProductId"", ""Badge"") DO NOTHING;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // ProductBadges tablosunu sil
            migrationBuilder.DropTable(name: "ProductBadges");

            // Product tablosundaki badge alanlarını kaldır
            migrationBuilder.DropColumn(name: "IsRare", table: "Products");
            migrationBuilder.DropColumn(name: "IsMint", table: "Products");
            migrationBuilder.DropColumn(name: "IsGraded", table: "Products");
            migrationBuilder.DropColumn(name: "IsSigned", table: "Products");
            migrationBuilder.DropColumn(name: "IsLimited", table: "Products");
            migrationBuilder.DropColumn(name: "IsFeatured", table: "Products");
            migrationBuilder.DropColumn(name: "IsOnSale", table: "Products");
            migrationBuilder.DropColumn(name: "OriginalPrice", table: "Products");
        }
    }
}

