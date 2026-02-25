using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HobbyCollection.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateAccountAndFollowStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // AspNetUsers tablosuna IsPrivateAccount kolonu ekle
            migrationBuilder.AddColumn<bool>(
                name: "IsPrivateAccount",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Follows tablosuna Status kolonu ekle (0 = Pending, 1 = Accepted)
            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Follows",
                type: "integer",
                nullable: false,
                defaultValue: 1); // Varsayılan olarak Accepted (mevcut takipler için)
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPrivateAccount",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Follows");
        }
    }
}

