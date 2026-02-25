using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HobbyCollection.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserLanguages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserSettings");

            migrationBuilder.AddColumn<string>(
                name: "AiLanguage",
                table: "AspNetUsers",
                type: "TEXT",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UiLanguage",
                table: "AspNetUsers",
                type: "TEXT",
                maxLength: 8,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiLanguage",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "UiLanguage",
                table: "AspNetUsers");

            migrationBuilder.CreateTable(
                name: "UserSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AiLanguage = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false, defaultValue: "en"),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UiLanguage = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserSettings_UserId",
                table: "UserSettings",
                column: "UserId",
                unique: true);
        }
    }
}
