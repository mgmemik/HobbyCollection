using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HobbyCollection.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAICreditSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // AICreditPackages tablosu
            migrationBuilder.CreateTable(
                name: "AICreditPackages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    MonthlyCredits = table.Column<int>(type: "INTEGER", nullable: false),
                    Price = table.Column<decimal>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    IsDefault = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AICreditPackages", x => x.Id);
                });

            // AIOperationCosts tablosu
            migrationBuilder.CreateTable(
                name: "AIOperationCosts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OperationType = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    CreditCost = table.Column<int>(type: "INTEGER", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AIOperationCosts", x => x.Id);
                });

            // UserAICredits tablosu
            migrationBuilder.CreateTable(
                name: "UserAICredits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    PackageId = table.Column<int>(type: "INTEGER", nullable: false),
                    CurrentBalance = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    TotalEarned = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    TotalSpent = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    LastRechargeDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    NextRechargeDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAICredits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserAICredits_AICreditPackages_PackageId",
                        column: x => x.PackageId,
                        principalTable: "AICreditPackages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // AICreditTransactions tablosu
            migrationBuilder.CreateTable(
                name: "AICreditTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    TransactionType = table.Column<string>(type: "TEXT", nullable: false),
                    Amount = table.Column<int>(type: "INTEGER", nullable: false),
                    BalanceBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    BalanceAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    OperationType = table.Column<string>(type: "TEXT", nullable: true),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    ProductId = table.Column<int>(type: "INTEGER", nullable: true),
                    IsSuccessful = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AICreditTransactions", x => x.Id);
                });

            // Indexler
            migrationBuilder.CreateIndex(
                name: "IX_AICreditPackages_Name",
                table: "AICreditPackages",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AICreditPackages_IsDefault",
                table: "AICreditPackages",
                column: "IsDefault");

            migrationBuilder.CreateIndex(
                name: "IX_AICreditPackages_IsActive",
                table: "AICreditPackages",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_AIOperationCosts_OperationType",
                table: "AIOperationCosts",
                column: "OperationType",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AIOperationCosts_IsActive",
                table: "AIOperationCosts",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_UserAICredits_UserId",
                table: "UserAICredits",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserAICredits_NextRechargeDate",
                table: "UserAICredits",
                column: "NextRechargeDate");

            migrationBuilder.CreateIndex(
                name: "IX_UserAICredits_PackageId",
                table: "UserAICredits",
                column: "PackageId");

            migrationBuilder.CreateIndex(
                name: "IX_AICreditTransactions_UserId",
                table: "AICreditTransactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AICreditTransactions_CreatedAt",
                table: "AICreditTransactions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AICreditTransactions_TransactionType",
                table: "AICreditTransactions",
                column: "TransactionType");

            migrationBuilder.CreateIndex(
                name: "IX_AICreditTransactions_UserId_CreatedAt",
                table: "AICreditTransactions",
                columns: new[] { "UserId", "CreatedAt" });

            // Seed Data - Standart Paket
            migrationBuilder.InsertData(
                table: "AICreditPackages",
                columns: new[] { "Name", "Description", "MonthlyCredits", "Price", "IsActive", "IsDefault", "CreatedAt" },
                values: new object[] { "Standard", "Aylık 50 AI kredisi içeren standart paket", 50, 0m, true, true, DateTime.UtcNow });

            // Seed Data - İşlem Maliyetleri
            migrationBuilder.InsertData(
                table: "AIOperationCosts",
                columns: new[] { "OperationType", "Description", "CreditCost", "IsActive", "CreatedAt" },
                values: new object[] { "ProductRecognition", "Ürün tanıma işlemi", 3, true, DateTime.UtcNow });

            migrationBuilder.InsertData(
                table: "AIOperationCosts",
                columns: new[] { "OperationType", "Description", "CreditCost", "IsActive", "CreatedAt" },
                values: new object[] { "PriceDetection", "Fiyat tespit işlemi", 1, true, DateTime.UtcNow });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AICreditTransactions");

            migrationBuilder.DropTable(
                name: "UserAICredits");

            migrationBuilder.DropTable(
                name: "AIOperationCosts");

            migrationBuilder.DropTable(
                name: "AICreditPackages");
        }
    }
}

