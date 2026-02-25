using HobbyCollection.Infrastructure;
using HobbyCollection.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace HobbyCollection.Api.Seeders;

public static class CategoryTranslationMap
{
    // Türkçe -> İngilizce çeviri mapping'i
    public static readonly Dictionary<string, string> Translations = new()
    {
        // Ana kategoriler
        { "Paralar", "Coins" },
        { "Postal & Dokümanter", "Postal & Documentary" },
        { "Figürler", "Figures" },
        { "Kartlar", "Cards" },
        { "Çizgi Roman", "Comics" },
        { "Kitaplar", "Books" },
        { "Plaklar", "Records" },
        { "Video Oyunları", "Video Games" },
        { "Saatler", "Watches" },
        { "Fotoğraf Makineleri", "Cameras" },
        { "Bilgisayar ve Elektronik", "Computers & Electronics" },
        { "Rozet ve Pinler", "Badges & Pins" },
        { "Madalyalar ve Nişanlar", "Medals & Decorations" },
        { "Oyuncaklar ve RC", "Toys & RC" },
        { "Model ve Diecastler", "Models & Diecast" },
        { "Sanat", "Art" },
        { "Antika Objeler", "Antiques" },
        { "Dergiler / Gazeteler", "Magazines / Newspapers" },
        { "Ayakkabılar", "Shoes" },
        
        // Alt kategoriler - Paralar
        { "ABD", "USA" },
        { "Almanya", "Germany" },
        { "Birleşik Krallık", "United Kingdom" },
        { "Fransa", "France" },
        { "Japonya", "Japan" },
        { "Rusya", "Russia" },
        { "Diğer Avrupa Ülkeleri", "Other European Countries" },
        { "Diğer Asya Ülkeleri", "Other Asian Countries" },
        { "Diğer Afrika Ülkeleri", "Other African Countries" },
        { "Diğer Amerika Ülkeleri", "Other American Countries" },
        { "Diğer Okyanusya Ülkeleri", "Other Oceania Countries" },
        { "Hatıra Paraları", "Commemorative Coins" },
        
        // Postal & Dokümanter
        { "Pullar", "Stamps" },
        { "Kartpostallar", "Postcards" },
        { "Postal Objeler", "Postal Objects" },
        { "Dokümanter Objeler", "Documentary Objects" },
        { "Vintage Kartpostallar", "Vintage Postcards" },
        { "Turistik Kartpostallar", "Tourist Postcards" },
        { "Sanat Kartpostalları", "Art Postcards" },
        { "Erotik Kartpostallar", "Erotic Postcards" },
        { "Müzik/Film", "Music/Film" },
        { "Spor", "Sports" },
        { "İllüstrasyon", "Illustration" },
        { "Fotoğraf Kartpostalları", "Photo Postcards" },
        { "Posta Kutuları", "Mailboxes" },
        { "Posta Arabaları", "Mail Cars" },
        { "Postacı Üniformaları", "Postman Uniforms" },
        { "Posta Zarfları", "Mail Envelopes" },
        { "Sergiler ve Posterler", "Exhibitions and Posters" },
        { "Postal Aksesuarları", "Postal Accessories" },
        { "Eski Gazeteler", "Old Newspapers" },
        { "Manifesto/Duyuru", "Manifesto/Announcement" },
        { "Tarihi Belgeler", "Historical Documents" },
        { "Eski Haritalar", "Old Maps" },
        { "Turist Brosürleri", "Tourist Brochures" },
        { "Eski Program/Festivaller", "Old Programs/Festivals" },
        
        // Figürler
        { "Action Figure", "Action Figure" },
        { "Anime Figure", "Anime Figure" },
        { "Designer / Vinyl Figure", "Designer / Vinyl Figure" },
        { "Model Kit Figure", "Model Kit Figure" },
        { "Nendoroid / Chibi", "Nendoroid / Chibi" },
        { "Statue", "Statue" },
        
        // Kartlar
        { "Non-Sport", "Non-Sport" },
        // "Spor" zaten Postal & Dokümanter altında tanımlı (satır 59)
        { "TCG", "TCG" },
        { "Basketbol", "Basketball" },
        { "Beyzbol", "Baseball" },
        { "Futbol", "Football" },
        { "Magic: The Gathering", "Magic: The Gathering" },
        { "Pokemon", "Pokemon" },
        { "Yu-Gi-Oh!", "Yu-Gi-Oh!" },
        { "Filmler", "Movies" },
        
        // Kitaplar
        { "Coffee Table (Masaüstü)", "Coffee Table" },
        { "Sanat Kitapları", "Art Books" },
        { "Fotoğraf", "Photography" },
        { "Mimarlık", "Architecture" },
        { "Tasarım", "Design" },
        { "İlk Baskılar", "First Editions" },
        { "İmzalı", "Signed" },
        { "Nadir", "Rare" },
        
        // Plaklar
        { "LP", "LP" },
        { "EP", "EP" },
        { "45'lik (Single)", "45 (Single)" },
        { "Taş Plak", "Shellac Record" },
        
        // Video Oyunları
        { "NES", "NES" },
        { "PS1", "PS1" },
        { "PS2", "PS2" },
        { "PS3", "PS3" },
        { "PS4", "PS4" },
        { "PS5", "PS5" },
        { "SNES", "SNES" },
        { "Switch", "Switch" },
        { "Xbox", "Xbox" },
        
        // Saatler
        { "Kol Saatleri", "Wristwatches" },
        { "Cep Saatleri", "Pocket Watches" },
        { "Masa Saatleri", "Desk Clocks" },
        { "Duvar Saatleri", "Wall Clocks" },
        { "Lüks", "Luxury" },
        { "Dijital", "Digital" },
        { "Kronograf", "Chronograph" },
        { "Dalgıç", "Diver" },
        { "Pilot", "Pilot" },
        { "Güneş Enerjili", "Solar Powered" },
        { "Otomatik", "Automatic" },
        { "Quartz", "Quartz" },
        { "Dress", "Dress" },
        { "Field", "Field" },
        { "Günlük Kullanım", "Daily Use" },
        { "Vintage", "Vintage" },
        { "Köstek", "Chain" },
        { "Antika", "Antique" },
        { "Kurmalı", "Mechanical" },
        { "Dijital Alarm", "Digital Alarm" },
        { "Analog Alarm", "Analog Alarm" },
        { "Radyo Kontrollü", "Radio Controlled" },
        { "Ahşap", "Wood" },
        { "Modern", "Modern" },
        { "Grandfather", "Grandfather" },
        { "Sarkaçlı", "Pendulum" },
        { "Guguklu", "Cuckoo" },
        { "Atomik", "Atomic" },
        { "Zemberekli", "Spring" },
        { "Mutfak", "Kitchen" },
        
        // Fotoğraf Makineleri
        { "Aynasız", "Mirrorless" },
        { "DSLR", "DSLR" },
        { "Instant", "Instant" },
        { "Kompakt", "Compact" },
        { "Orta Format", "Medium Format" },
        { "Rangefinder", "Rangefinder" },
        { "SLR", "SLR" },
        
        // Bilgisayar ve Elektronik
        { "Bilgisayarlar", "Computers" },
        { "Aksesuar ve Ekipman", "Accessories & Equipment" },
        { "Bilgisayar Bileşenleri", "Computer Components" },
        { "Telefonlar", "Phones" },
        { "Tabletler", "Tablets" },
        { "Kulaklıklar ve Ses", "Headphones & Audio" },
        { "Gaming", "Gaming" },
        { "Ev Elektronikleri", "Home Electronics" },
        { "Retro Elektronik & Bilgisayar", "Retro Electronics & Computer" },
        { "Desktop", "Desktop" },
        { "Laptop", "Laptop" },
        { "All-in-One", "All-in-One" },
        { "Mini PC", "Mini PC" },
        { "Workstation", "Workstation" },
        { "iPhone", "iPhone" },
        { "Android", "Android" },
        { "Vintage Telefon", "Vintage Phone" },
        { "Smartphone Aksesuarları", "Smartphone Accessories" },
        { "iPad", "iPad" },
        { "Android Tablet", "Android Tablet" },
        { "Windows Tablet", "Windows Tablet" },
        { "E-reader", "E-reader" },
        { "Wireless Kulaklık", "Wireless Headphones" },
        { "Wired Kulaklık", "Wired Headphones" },
        { "Hoparlör", "Speaker" },
        { "Mikrofon", "Microphone" },
        { "Amp", "Amp" },
        { "Gaming PC", "Gaming PC" },
        { "Konsol", "Console" },
        { "Controller", "Controller" },
        { "Gaming Monitör", "Gaming Monitor" },
        { "Gaming Klavye", "Gaming Keyboard" },
        { "Gaming Mouse", "Gaming Mouse" },
        { "Akıllı Ev", "Smart Home" },
        { "Streaming Cihazlar", "Streaming Devices" },
        { "Router", "Router" },
        { "Adapter ve Kablolar", "Adapters & Cables" },
        { "Power Bank", "Power Bank" },
        { "Retro Computer", "Retro Computer" },
        { "Retro Konsol", "Retro Console" },
        { "Eski Telefon", "Old Phone" },
        { "Analog Cihazlar", "Analog Devices" },
        
        // Oyuncaklar ve RC
        // "Modern" zaten Saatler altında tanımlı (satır 146)
        { "RC", "RC" },
        { "Döküm", "Die-cast" },
        { "Teneke", "Tin" },
        { "Lego Setleri", "Lego Sets" },
        { "Architecture", "Architecture" },
        { "Bionicle", "Bionicle" },
        { "Castle", "Castle" },
        { "City", "City" },
        { "Classic", "Classic" },
        { "Creator", "Creator" },
        { "Harry Potter", "Harry Potter" },
        { "Ideas", "Ideas" },
        { "Modular Buildings", "Modular Buildings" },
        { "Ninjago", "Ninjago" },
        { "Pirates", "Pirates" },
        { "Star Wars", "Star Wars" },
        { "Technic", "Technic" },
        { "Trains", "Trains" },
        { "Town", "Town" },
        { "UCS", "UCS" },
        
        // Model ve Diecastler
        { "Model Araba / Diecast", "Model Car / Diecast" },
        { "Model Tren", "Model Train" },
        { "Model Uçak", "Model Aircraft" },
        { "Model Tank", "Model Tank" },
        { "Diorama Ürünleri", "Diorama Products" },
        
        // Sanat
        { "Baskı", "Print" },
        { "Heykel", "Sculpture" },
        { "Resim", "Painting" },
        
        // Antika Objeler
        { "Cam", "Glass" },
        { "Metal Objeler", "Metal Objects" },
        { "Mobilya", "Furniture" },
        { "Seramik", "Ceramic" },
        { "Şişeler", "Bottles" },
        
        // Dergiler / Gazeteler
        { "Bilim", "Science" },
        { "Ev & Dekorasyon", "Home & Decoration" },
        // "Fotoğraf" zaten Kitaplar altında tanımlı (satır 98)
        { "Günlük Gazeteler", "Daily Newspapers" },
        { "Moda", "Fashion" },
        { "Müzik", "Music" },
        { "Müzik Aletleri", "Musical Instruments" },
        { "Gitar", "Guitar" },
        { "Elektro Gitar", "Electric Guitar" },
        { "Akustik Gitar", "Acoustic Guitar" },
        { "Klasik Gitar", "Classical Guitar" },
        { "Bas Gitar", "Bass Guitar" },
        { "Piyano", "Piano" },
        { "Dijital Piyano", "Digital Piano" },
        { "Akustik Piyano", "Acoustic Piano" },
        { "Grand Piyano", "Grand Piano" },
        { "Davul", "Drums" },
        { "Akustik Davul", "Acoustic Drums" },
        { "Elektronik Davul", "Electronic Drums" },
        { "Bateri", "Drum Kit" },
        { "Keman", "Violin" },
        { "Viyola", "Viola" },
        { "Çello", "Cello" },
        { "Kontrbas", "Double Bass" },
        { "Flüt", "Flute" },
        { "Saksafon", "Saxophone" },
        { "Trompet", "Trumpet" },
        { "Trombon", "Trombone" },
        { "Kornet", "Cornet" },
        { "Klavye", "Keyboard" },
        { "Synthesizer", "Synthesizer" },
        { "Org", "Organ" },
        { "Akordeon", "Accordion" },
        { "Mızıka", "Harmonica" },
        { "Banjo", "Banjo" },
        { "Mandolin", "Mandolin" },
        { "Ukulele", "Ukulele" },
        { "Arp", "Harp" },
        { "Perküsyon", "Percussion" },
        { "Darbuka", "Darbuka" },
        { "Bongo", "Bongo" },
        { "Konga", "Conga" },
        { "Djembe", "Djembe" },
        { "Vintage Müzik Aletleri", "Vintage Musical Instruments" },
        { "Yaylı Çalgılar", "String Instruments" },
        { "Üflemeli Çalgılar", "Wind Instruments" },
        { "Klavye ve Synthesizer", "Keyboard & Synthesizer" },
        { "Diğer Çalgılar", "Other Instruments" },
        { "Otomotiv", "Automotive" },
        { "Oyun", "Gaming" },
        { "Seyahat", "Travel" },
        { "Teknoloji", "Technology" },
        
        // Ayakkabılar
        { "Adidas", "Adidas" },
        { "New Balance", "New Balance" },
        { "Nike", "Nike" },
    };
}

public static class CategorySeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        // PERFORMANCE: Tüm mevcut kategorileri ve closure'ları belleğe yükle
        var existingCategories = await db.Categories.AsNoTracking().ToListAsync();
        var existingClosures = await db.CategoryClosures.AsNoTracking()
            .Select(c => new { c.AncestorId, c.DescendantId, c.Distance })
            .ToListAsync();
        var closureSet = new HashSet<(Guid, Guid, int)>(
            existingClosures.Select(c => (c.AncestorId, c.DescendantId, c.Distance))
        );

        var tree = new List<SeedNode>
        {
            // Paralar: Pullar ile aynı kırılım + Hatıra Paraları
            new("Paralar", new()
            {
                new("ABD"), new("Almanya"), new("Birleşik Krallık"), new("Fransa"), new("Japonya"), new("Rusya"),
                new("Diğer Avrupa Ülkeleri"), new("Diğer Asya Ülkeleri"), new("Diğer Afrika Ülkeleri"), new("Diğer Amerika Ülkeleri"), new("Diğer Okyanusya Ülkeleri"),
                new("Hatıra Paraları")
            }),
            // Postal & Dokümanter: pullar, kartpostallar ve benzer koleksiyonlar
            new("Postal & Dokümanter", new()
            {
                new("Pullar", new()
                {
                    new("ABD"), new("Almanya"), new("Birleşik Krallık"), new("Fransa"), new("Japonya"), new("Rusya"),
                    new("Diğer Avrupa Ülkeleri"), new("Diğer Asya Ülkeleri"), new("Diğer Afrika Ülkeleri"), new("Diğer Amerika Ülkeleri"), new("Diğer Okyanusya Ülkeleri")
                }),
                new("Kartpostallar", new()
                {
                    new("Vintage Kartpostallar"), new("Turistik Kartpostallar"), new("Sanat Kartpostalları"), new("Erotik Kartpostallar"),
                    new("Müzik/Film"), new("Spor"), new("İllüstrasyon"), new("Fotoğraf Kartpostalları")
                }),
                new("Postal Objeler", new()
                {
                    new("Posta Kutuları"), new("Posta Arabaları"), new("Postacı Üniformaları"), new("Posta Zarfları"),
                    new("Sergiler ve Posterler"), new("Postal Aksesuarları")
                }),
                new("Dokümanter Objeler", new()
                {
                    new("Eski Gazeteler"), new("Manifesto/Duyuru"), new("Tarihi Belgeler"), new("Eski Haritalar"),
                    new("Turist Brosürleri"), new("Eski Program/Festivaller")
                })
            }),
            // Figürler: tip bazlı, scale altları kaldırıldı
            new("Figürler", new()
            {
                new("Action Figure"),
                new("Anime Figure"),
                new("Designer / Vinyl Figure"),
                new("Model Kit Figure"),
                new("Nendoroid / Chibi"),
                new("Statue")
            }),
            new("Kartlar", new()
            {
                new("Non-Sport", new(){ new("Çizgi Roman"), new("Filmler") }),
                new("Spor", new(){ new("Basketbol"), new("Beyzbol"), new("Futbol") }),
                new("TCG", new(){ new("Magic: The Gathering"), new("Pokemon"), new("Yu-Gi-Oh!") })
            }),
            // Çizgi Roman: alt kırılımlar (Dil/Yayımcı) kaldırıldı
            new("Çizgi Roman"),
            new("Kitaplar", new(){ new("Coffee Table (Masaüstü)"), new("Sanat Kitapları"), new("Fotoğraf"), new("Mimarlık"), new("Tasarım"), new("İlk Baskılar"), new("İmzalı"), new("Nadir") }),
            // Plaklar: sadece plak tipleri
            new("Plaklar", new(){ new("LP"), new("EP"), new("45'lik (Single)"), new("Taş Plak") }),
            // Müzik Aletleri: geniş kategori yapısı
            new("Müzik Aletleri", new(){
                new("Gitar", new(){
                    new("Elektro Gitar"),
                    new("Akustik Gitar"),
                    new("Klasik Gitar"),
                    new("Bas Gitar")
                }),
                new("Piyano", new(){
                    new("Dijital Piyano"),
                    new("Akustik Piyano"),
                    new("Grand Piyano")
                }),
                new("Davul", new(){
                    new("Akustik Davul"),
                    new("Elektronik Davul"),
                    new("Bateri")
                }),
                new("Yaylı Çalgılar", new(){
                    new("Keman"),
                    new("Viyola"),
                    new("Çello"),
                    new("Kontrbas")
                }),
                new("Üflemeli Çalgılar", new(){
                    new("Flüt"),
                    new("Saksafon"),
                    new("Trompet"),
                    new("Trombon"),
                    new("Kornet")
                }),
                new("Klavye ve Synthesizer", new(){
                    new("Klavye"),
                    new("Synthesizer"),
                    new("Org")
                }),
                new("Diğer Çalgılar", new(){
                    new("Akordeon"),
                    new("Mızıka"),
                    new("Banjo"),
                    new("Mandolin"),
                    new("Ukulele"),
                    new("Arp")
                }),
                new("Perküsyon", new(){
                    new("Darbuka"),
                    new("Bongo"),
                    new("Konga"),
                    new("Djembe")
                }),
                new("Vintage Müzik Aletleri")
            }),
            new("Video Oyunları", new(){ new("NES"), new("PS1"), new("PS2"), new("PS3"), new("PS4"), new("PS5"), new("SNES"), new("Switch"), new("Xbox") }),
            // Saatler: dört ana dal ve alt kırılımlar
            new("Saatler", new(){
                new("Kol Saatleri", new(){
                    new("Lüks"),
                    new("Dijital"),
                    new("Kronograf"),
                    new("Dalgıç"),
                    new("Pilot"),
                    new("Güneş Enerjili"),
                    new("Otomatik"),
                    new("Quartz"),
                    new("Dress"),
                    new("Field"),
                    new("Günlük Kullanım"),
                    new("Vintage")
                }),
                new("Cep Saatleri", new(){
                    new("Köstek"),
                    new("Antika"),
                    new("Vintage")
                }),
                new("Masa Saatleri", new(){
                    new("Kurmalı"),
                    new("Quartz"),
                    new("Dijital Alarm"),
                    new("Analog Alarm"),
                    new("Radyo Kontrollü"),
                    new("Ahşap"),
                    new("Modern"),
                    new("Vintage")
                }),
                new("Duvar Saatleri", new(){
                    new("Grandfather"),
                    new("Sarkaçlı"),
                    new("Guguklu"),
                    new("Atomik"),
                    new("Dijital"),
                    new("Zemberekli"),
                    new("Mutfak")
                })
            }),
            // Fotoğraf makineleri: Orta Format daha önce eklendi
            new("Fotoğraf Makineleri", new(){ new("Aynasız"), new("DSLR"), new("Instant"), new("Kompakt"), new("Orta Format"), new("Rangefinder"), new("SLR") }),
            // Bilgisayar ve Elektronik: geniş kategori yapısı
            new("Bilgisayar ve Elektronik", new(){ 
                new("Bilgisayarlar", new(){ 
                    new("Desktop"), 
                    new("Laptop"), 
                    new("All-in-One"), 
                    new("Mini PC"), 
                    new("Workstation"),
                    new("Aksesuar ve Ekipman"),
                    new("Bilgisayar Bileşenleri")
                }),
                new("Telefonlar", new(){ 
                    new("iPhone"), 
                    new("Android"), 
                    new("Vintage Telefon"), 
                    new("Smartphone Aksesuarları") 
                }),
                new("Tabletler", new(){ 
                    new("iPad"), 
                    new("Android Tablet"), 
                    new("Windows Tablet"), 
                    new("E-reader") 
                }),
                new("Kulaklıklar ve Ses", new(){ 
                    new("Wireless Kulaklık"), 
                    new("Wired Kulaklık"), 
                    new("Hoparlör"), 
                    new("Mikrofon"), 
                    new("Amp") 
                }),
                new("Gaming", new(){ 
                    new("Gaming PC"), 
                    new("Konsol"), 
                    new("Controller"), 
                    new("Gaming Monitör"), 
                    new("Gaming Klavye"), 
                    new("Gaming Mouse") 
                }),
                new("Ev Elektronikleri", new(){ 
                    new("Akıllı Ev"), 
                    new("Streaming Cihazlar"), 
                    new("Router"), 
                    new("Adapter ve Kablolar"), 
                    new("Power Bank") 
                }),
                new("Retro Elektronik & Bilgisayar", new(){ 
                    new("Retro Computer"), 
                    new("Retro Konsol"), 
                    new("Eski Telefon"), 
                    new("Analog Cihazlar") 
                })
            }),
            new("Rozet ve Pinler"),
            new("Madalyalar ve Nişanlar"),
            // Oyuncaklar ve RC
            new("Oyuncaklar ve RC", new(){ 
                new("Modern"), 
                new("RC"), 
                new("Vintage", new(){ new("Döküm"), new("Teneke") }),
                new("Lego Setleri", new(){ 
                    new("Architecture"), 
                    new("Bionicle"), 
                    new("Castle"), 
                    new("City"), 
                    new("Classic"), 
                    new("Creator"), 
                    new("Harry Potter"), 
                    new("Ideas"), 
                    new("Modular Buildings"), 
                    new("Ninjago"), 
                    new("Pirates"), 
                    new("Star Wars"), 
                    new("Technic"), 
                    new("Trains"), 
                    new("Town"), 
                    new("UCS") 
                })
            }),
            // Model ve Diecastler
            new("Model ve Diecastler", new(){ 
                new("Model Araba / Diecast"), 
                new("Model Tren"),
                new("Model Uçak"),
                new("Model Tank"),
                new("Diorama Ürünleri")
            }),
            // Sanat: Heykel eklendi
            new("Sanat", new(){ new("Baskı"), new("Heykel"), new("Resim") }),
            new("Antika Objeler", new(){ new("Cam"), new("Metal Objeler"), new("Mobilya"), new("Seramik"), new("Şişeler") }),
            new("Dergiler / Gazeteler", new(){ new("Bilim"), new("Ev & Dekorasyon"), new("Fotoğraf"), new("Günlük Gazeteler"), new("Moda"), new("Müzik"), new("Otomotiv"), new("Oyun"), new("Seyahat"), new("Teknoloji") }),
            new("Ayakkabılar", new(){ new("Adidas"), new("New Balance"), new("Nike") })
        };

        // Idempotent upsert: find by (ParentId, Name); create if missing; ensure closure rows
        // OPTIMIZED: Bellek içi kontroller ile N+1 sorgu problemi çözüldü
        async Task<Category> AddNodeAsync(SeedNode node, Guid? parentId)
        {
            // Bellek içinde kontrol et
            var existing = existingCategories.FirstOrDefault(c => c.ParentId == parentId && c.Name == node.Name);
            var cat = existing ?? new Category { Name = node.Name, ParentId = parentId, Slug = node.Name.ToLower().Replace(' ', '-') };
            
            if (existing == null)
            {
                db.Categories.Add(cat);
                await db.SaveChangesAsync(); // ID elde etmek için gerekli
                existingCategories.Add(cat); // Belleğe ekle
                
                // Çevirileri ekle
                var translations = new List<CategoryTranslation>();
                
                // Türkçe çeviri (orijinal isim)
                translations.Add(new CategoryTranslation
                {
                    CategoryId = cat.Id,
                    LanguageCode = "tr",
                    Name = node.Name
                });
                
                // İngilizce çeviri
                if (CategoryTranslationMap.Translations.TryGetValue(node.Name, out var englishName))
                {
                    translations.Add(new CategoryTranslation
                    {
                        CategoryId = cat.Id,
                        LanguageCode = "en",
                        Name = englishName
                    });
                }
                else
                {
                    // Çeviri bulunamazsa orijinal ismi kullan
                    translations.Add(new CategoryTranslation
                    {
                        CategoryId = cat.Id,
                        LanguageCode = "en",
                        Name = node.Name
                    });
                }
                
                db.CategoryTranslations.AddRange(translations);
                await db.SaveChangesAsync();
            }
            else
            {
                // Mevcut kategori için çevirileri kontrol et ve eksikleri ekle
                var existingTranslations = await db.CategoryTranslations
                    .Where(t => t.CategoryId == cat.Id)
                    .ToListAsync();
                
                var hasTr = existingTranslations.Any(t => t.LanguageCode == "tr");
                var hasEn = existingTranslations.Any(t => t.LanguageCode == "en");
                
                var newTranslations = new List<CategoryTranslation>();
                
                if (!hasTr)
                {
                    newTranslations.Add(new CategoryTranslation
                    {
                        CategoryId = cat.Id,
                        LanguageCode = "tr",
                        Name = node.Name
                    });
                }
                
                if (!hasEn)
                {
                    var englishName = CategoryTranslationMap.Translations.TryGetValue(node.Name, out var enName) 
                        ? enName 
                        : node.Name;
                    
                    newTranslations.Add(new CategoryTranslation
                    {
                        CategoryId = cat.Id,
                        LanguageCode = "en",
                        Name = englishName
                    });
                }
                
                if (newTranslations.Any())
                {
                    db.CategoryTranslations.AddRange(newTranslations);
                    await db.SaveChangesAsync();
                }
            }

            // ensure closure rows - bellekteki set'i kullan
            var toAdd = new List<CategoryClosure>();
            var needSelf = !closureSet.Contains((cat.Id, cat.Id, 0));
            if (needSelf)
            {
                var selfClosure = new CategoryClosure { AncestorId = cat.Id, DescendantId = cat.Id, Distance = 0 };
                toAdd.Add(selfClosure);
                closureSet.Add((cat.Id, cat.Id, 0));
            }
            
            if (parentId.HasValue)
            {
                // Bellek içinden ancestor'ları bul
                var ancestors = existingClosures.Where(x => x.DescendantId == parentId.Value).ToList();
                foreach (var a in ancestors)
                {
                    if (!closureSet.Contains((a.AncestorId, cat.Id, a.Distance + 1)))
                    {
                        var closure = new CategoryClosure { AncestorId = a.AncestorId, DescendantId = cat.Id, Distance = a.Distance + 1 };
                        toAdd.Add(closure);
                        closureSet.Add((a.AncestorId, cat.Id, a.Distance + 1));
                        existingClosures.Add(new { closure.AncestorId, closure.DescendantId, closure.Distance });
                    }
                }
            }
            
            if (toAdd.Count > 0)
            {
                db.CategoryClosures.AddRange(toAdd);
                await db.SaveChangesAsync();
            }

            if (node.Children != null)
            {
                foreach (var child in node.Children)
                {
                    await AddNodeAsync(child, cat.Id);
                }
            }
            return cat;
        }

        // alfabetik sıralama (tüm seviyeler)
        static SeedNode SortNode(SeedNode n) => n with { Children = n.Children?.OrderBy(c => c.Name).Select(SortNode).ToList() };
        var sortedRoots = tree.OrderBy(t => t.Name).Select(SortNode).ToList();

        foreach (var root in sortedRoots)
        {
            await AddNodeAsync(root, null);
        }
    }

    private record SeedNode(string Name, List<SeedNode>? Children = null);
}


