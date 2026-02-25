using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HobbyCollection.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRelatedFollowIdToNotification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Notifications tablosuna RelatedFollowId kolonu ekle (PostgreSQL için TEXT kullan)
            migrationBuilder.AddColumn<string>(
                name: "RelatedFollowId",
                table: "Notifications",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RelatedFollowId",
                table: "Notifications");
        }
    }
}

