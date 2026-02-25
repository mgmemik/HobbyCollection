using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HobbyCollection.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLoginLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LoginLogs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    IpAddress = table.Column<string>(type: "TEXT", maxLength: 45, nullable: false),
                    UserAgent = table.Column<string>(type: "TEXT", nullable: true),
                    IsSuccessful = table.Column<bool>(type: "INTEGER", nullable: false),
                    FailureReason = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoginLogs_UserId",
                table: "LoginLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_LoginLogs_Email",
                table: "LoginLogs",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_LoginLogs_CreatedAtUtc",
                table: "LoginLogs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_LoginLogs_UserId_CreatedAtUtc",
                table: "LoginLogs",
                columns: new[] { "UserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_LoginLogs_IsSuccessful",
                table: "LoginLogs",
                column: "IsSuccessful");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoginLogs");
        }
    }
}

