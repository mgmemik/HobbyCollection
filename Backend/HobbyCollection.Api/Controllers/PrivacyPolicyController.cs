using Microsoft.AspNetCore.Mvc;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("")]
public class PrivacyPolicyController : ControllerBase
{
    [HttpGet("privacy-policy")]
    [Produces("text/html")]
    public IActionResult GetPrivacyPolicy()
    {
        var html = @"
<!DOCTYPE html>
<html lang=""tr"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Gizlilik Politikası - Save All</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
        }
        ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        li {
            margin: 5px 0;
        }
        .last-updated {
            color: #7f8c8d;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ecf0f1;
        }
        .contact {
            background-color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class=""container"">
        <h1>Gizlilik Politikası</h1>
        
        <p><strong>Son Güncelleme:</strong> 18 Kasım 2024</p>
        
        <p>Save All uygulamasına hoş geldiniz. Bu gizlilik politikası, uygulamamızın verilerinizi nasıl topladığını, kullandığını ve koruduğunu açıklamaktadır.</p>
        
        <h2>1. Veri Toplama</h2>
        <p>Save All uygulaması, koleksiyonunuzu yönetmek ve size en iyi hizmeti sunmak için aşağıdaki verileri toplar:</p>
        <ul>
            <li><strong>Hesap Bilgileri:</strong> E-posta adresi, kullanıcı adı ve şifre (şifrelenmiş olarak saklanır)</li>
            <li><strong>Ürün Bilgileri:</strong> Ürün adı, kategori, fiyat, açıklama ve diğer koleksiyon bilgileri</li>
            <li><strong>Fotoğraflar:</strong> Ürün fotoğrafları (kamera veya galeri erişimi ile)</li>
            <li><strong>Kullanım Verileri:</strong> Uygulama içi tercihler, dil ayarları ve tema seçimleri</li>
        </ul>
        
        <h2>2. Kamera ve Fotoğraf Erişimi</h2>
        <p>Uygulama, ürün fotoğrafları çekmek ve galeriden fotoğraf seçmek için kamera ve fotoğraf erişimine ihtiyaç duyar. Bu izinler sadece aşağıdaki amaçlar için kullanılır:</p>
        <ul>
            <li>Ürün fotoğrafları çekmek</li>
            <li>Galeriden mevcut fotoğrafları seçmek</li>
            <li>Ürün tanıma ve analiz özelliklerini kullanmak</li>
        </ul>
        <p><strong>Önemli:</strong> Fotoğraflarınız sadece koleksiyonunuzu yönetmek için kullanılır ve üçüncü taraflarla paylaşılmaz.</p>
        
        <h2>3. Veri Kullanımı</h2>
        <p>Toplanan veriler aşağıdaki amaçlar için kullanılır:</p>
        <ul>
            <li>Koleksiyonunuzu yönetmek ve saklamak</li>
            <li>Ürün tanıma ve fiyat tespiti gibi AI özelliklerini sağlamak</li>
            <li>Uygulama içi tercihlerinizi hatırlamak</li>
            <li>Hesap güvenliğini sağlamak</li>
            <li>Uygulama geliştirmeleri ve hata düzeltmeleri yapmak</li>
        </ul>
        
        <h2>4. Veri Güvenliği</h2>
        <p>Verilerinizin güvenliği bizim için çok önemlidir:</p>
        <ul>
            <li>Tüm veriler şifrelenmiş bağlantılar (HTTPS) üzerinden iletilir</li>
            <li>Şifreler güvenli bir şekilde hash'lenerek saklanır</li>
            <li>Veriler güvenli sunucularda saklanır</li>
            <li>Düzenli güvenlik güncellemeleri yapılır</li>
        </ul>
        
        <h2>5. Veri Paylaşımı</h2>
        <p>Save All, verilerinizi üçüncü taraflarla paylaşmaz. Ancak aşağıdaki durumlar hariçtir:</p>
        <ul>
            <li>Yasal zorunluluklar gereği</li>
            <li>Ürün tanıma özelliği için Google Cloud Vision API kullanımı (fotoğraflar analiz için gönderilir ancak saklanmaz)</li>
        </ul>
        
        <h2>6. Kullanıcı Hakları</h2>
        <p>Verilerinizle ilgili aşağıdaki haklara sahipsiniz:</p>
        <ul>
            <li>Verilerinize erişim hakkı</li>
            <li>Verilerinizi düzeltme hakkı</li>
            <li>Verilerinizi silme hakkı</li>
            <li>Veri işlemeye itiraz etme hakkı</li>
            <li>Veri taşınabilirliği hakkı</li>
        </ul>
        
        <h2>7. Çerezler ve Takip Teknolojileri</h2>
        <p>Uygulama, temel işlevsellik için gerekli çerezler kullanır. Üçüncü taraf reklam veya takip çerezleri kullanılmaz.</p>
        
        <h2>8. Çocukların Gizliliği</h2>
        <p>Save All, 13 yaş altındaki çocuklardan bilerek veri toplamaz. Eğer 13 yaş altında bir çocuğun verilerini topladığımızı fark edersek, bu verileri derhal sileriz.</p>
        
        <h2>9. Politika Değişiklikleri</h2>
        <p>Bu gizlilik politikası zaman zaman güncellenebilir. Önemli değişiklikler durumunda size bildirim gönderilecektir. Politikanın güncel versiyonu bu sayfada yayınlanacaktır.</p>
        
        <div class=""contact"">
            <h2>10. İletişim</h2>
            <p>Gizlilik politikamız hakkında sorularınız veya endişeleriniz varsa, lütfen bizimle iletişime geçin:</p>
            <p><strong>E-posta:</strong> support@thebarnapp.com</p>
        </div>
        
        <div class=""last-updated"">
            <p><strong>Son Güncelleme:</strong> 18 Kasım 2024</p>
        </div>
    </div>
</body>
</html>";

        return Content(html, "text/html; charset=utf-8");
    }
}


