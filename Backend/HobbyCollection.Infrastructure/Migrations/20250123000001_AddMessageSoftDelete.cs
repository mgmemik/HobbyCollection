using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HobbyCollection.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Messages tablosuna soft delete kolonları ekle
            migrationBuilder.AddColumn<bool>(
                name: "IsDeletedBySender",
                table: "Messages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeletedByReceiver",
                table: "Messages",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDeletedBySender",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "IsDeletedByReceiver",
                table: "Messages");
        }
    }
}

