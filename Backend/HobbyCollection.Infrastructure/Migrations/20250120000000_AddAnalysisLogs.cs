using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HobbyCollection.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAnalysisLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AnalysisLogs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    ProductId = table.Column<string>(type: "TEXT", nullable: true),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    Language = table.Column<string>(type: "TEXT", nullable: false),
                    PhotoCount = table.Column<int>(type: "INTEGER", nullable: false),
                    FinalProductName = table.Column<string>(type: "TEXT", nullable: true),
                    FinalConfidence = table.Column<double>(type: "REAL", nullable: true),
                    DetectedCategory = table.Column<string>(type: "TEXT", nullable: true),
                    ProcessingTimeMs = table.Column<long>(type: "INTEGER", nullable: false),
                    IsSuccessful = table.Column<bool>(type: "INTEGER", nullable: false),
                    ErrorMessage = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnalysisLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AnalysisLogEntries",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    AnalysisLogId = table.Column<string>(type: "TEXT", nullable: false),
                    Step = table.Column<string>(type: "TEXT", nullable: false),
                    StepName = table.Column<string>(type: "TEXT", nullable: false),
                    Message = table.Column<string>(type: "TEXT", nullable: false),
                    Data = table.Column<string>(type: "TEXT", nullable: true),
                    Level = table.Column<string>(type: "TEXT", nullable: false),
                    DurationMs = table.Column<long>(type: "INTEGER", nullable: true),
                    Order = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnalysisLogEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AnalysisLogEntries_AnalysisLogs_AnalysisLogId",
                        column: x => x.AnalysisLogId,
                        principalTable: "AnalysisLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnalysisLogs_UserId",
                table: "AnalysisLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AnalysisLogs_ProductId",
                table: "AnalysisLogs",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_AnalysisLogs_CreatedAtUtc",
                table: "AnalysisLogs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_AnalysisLogEntries_AnalysisLogId",
                table: "AnalysisLogEntries",
                column: "AnalysisLogId");

            migrationBuilder.CreateIndex(
                name: "IX_AnalysisLogEntries_AnalysisLogId_Order",
                table: "AnalysisLogEntries",
                columns: new[] { "AnalysisLogId", "Order" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnalysisLogEntries");

            migrationBuilder.DropTable(
                name: "AnalysisLogs");
        }
    }
}

