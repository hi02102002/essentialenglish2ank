# Anki AI Deck Builder

> Biến các bài học từ vựng tiếng Anh và danh sách từ tự do thành các bộ thẻ Anki (`.apkg`) đầy đủ âm thanh phát âm chuẩn và hình ảnh minh họa, được hỗ trợ bởi **TanStack AI** và giao diện **coss.com/ui**.

![Tech Stack](https://img.shields.io/badge/TanStack%20Start-1.168-blue?style=flat-square)
![TanStack AI](https://img.shields.io/badge/TanStack%20AI-0.53-orange?style=flat-square)
![coss.com/ui](https://img.shields.io/badge/coss.com%2Fui-Base%20UI-purple?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-38bdf8?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square)

---

## 🌟 Tính năng nổi bật

- **Hỗ trợ đa bộ sách & Tùy biến nguồn dữ liệu không hardcode**:
  - Hỗ trợ toàn bộ các bộ sách *English Vocabulary in Use*: **Elementary** (60 units), **Pre-intermediate & Intermediate** (100 units), **Upper-intermediate** (100 units), **Advanced** (100 units).
  - Chọn nhanh bộ sách và số Unit (1 - 100) qua menu trực quan, hoặc dán bất kỳ URL bài học (`/apps/...`) / link file `data.json` tùy ý.
- **Mô hình thẻ Anki kép (Dual Card Models)**:
  - **Vocabulary Card**: Từ vựng, phiên âm IPA, hình ảnh Bing, định nghĩa tiếng Anh, nghĩa tiếng Việt, câu ví dụ và 2 file phát âm offline.
  - **Language Note Card**: Bóc tách các cụm từ cố định (common expressions), quy tắc ngữ pháp, ghi chú chú ý (important phrases/collocations) từ bài học, được AI dịch giải thích sang tiếng Việt và tạo câu ví dụ thực hành.
- **Quy trình Wizard 3 bước tinh gọn**:
  1. **Nguồn dữ liệu**: Chọn bộ sách + Unit hoặc dán link `data.json` / dán từ tự do.
  2. **Chọn nội dung**: Phân tách riêng biệt giữa **Từ vựng** và **Ghi chú quan trọng (Language Notes)** với checkbox, lọc tìm kiếm, chọn/bỏ chọn tất cả.
  3. **Xem trước & Xuất thẻ**: Lọc xem theo loại thẻ (Tất cả / Từ vựng / Ghi chú), chỉnh sửa nội dung, nghe thử phát âm Youdao, và tải file `.apkg` hoàn chỉnh.
- **TanStack AI Structured Output**:
  - Tích hợp `@tanstack/ai` và `@tanstack/ai-openai` với Zod schema (`outputSchema`).
  - Sinh thẻ từ vựng và thẻ ghi chú song song, đảm bảo đầu ra luôn chuẩn xác.
- **Làm giàu Media tự động**:
  - **Hình ảnh**: Tự động lấy thumbnail hình ảnh chất lượng cao từ Bing Images theo ngữ cảnh từ.
  - **Âm thanh**: Tự động tải file phát âm chuẩn Youdao (UK) cho cả từ vựng, câu ví dụ và thẻ ghi chú, nhúng trực tiếp vào gói `.apkg` để học offline.
- **Giao diện hiện đại (coss.com/ui + Tailwind CSS v4)**:
  - Xây dựng trên các primitive `@base-ui/react` (Base UI / React 19).
  - Chủ đề **Dark Mode** mặc định sắc nét, phong cách công cụ AI hiện đại.
  - Bộ components tùy biến: `Button`, `Badge`, `Card`, `CardFrame`, `Input`, `Textarea`, `Checkbox`, `Spinner`.
- **Runtime Nitro Production**:
  - Tích hợp `nitro/vite` tạo server production tự động với SSR, phục vụ assets tối ưu và hỗ trợ triển khai mượt mà trên Coolify, Docker, Railpack.
- **Bảo mật toàn diện (Access Gate)**:
  - Khóa truy cập bằng biến môi trường `APP_PASSWORD`.
  - Kiểm tra mật khẩu an toàn phía server bằng `crypto.timingSafeEqual` (chống timing attack).
  - **Bảo vệ toàn diện cả ở tầng API**: Mọi API và server function (`analyzeLesson`, `generateVocabulary`, `generateNotes`, `/api/export`) đều bắt buộc token hoặc mật khẩu hợp lệ mới được thực thi.

---

## 🛠️ Công nghệ sử dụng

| Lớp | Công nghệ | Mục đích |
|---|---|---|
| **Framework** | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) | Full-stack React 19 framework với SSR và Server Functions |
| **AI Engine** | [TanStack AI](https://tanstack.com/ai) (`@tanstack/ai`, `@tanstack/ai-openai`) | Tạo dữ liệu thẻ có cấu trúc type-safe với Zod schema |
| **UI Components** | [coss.com/ui](https://coss.com/ui) + [@base-ui/react](https://base-ui.com/) | Primitive UI không định kiểu, chuẩn a11y cao |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + `@tailwindcss/vite` | Styling hiện đại với CSS variables và `--alpha()` tokens |
| **Anki Engine** | `anki-apkg-export` | Đóng gói SQLite database và media thành file `.apkg` Anki |
| **Icons** | [lucide-react](https://lucide.dev/) | Hệ thống icon chuẩn giao diện coss |

---

## 🚀 Cài đặt & Khởi chạy

### Yêu cầu hệ thống
- **Node.js**: `>= 22.12.0`
- **pnpm**: `>= 9.0.0`

### 1. Clone repository & Cài đặt dependencies
```bash
git clone <repository-url>
cd anki-ai-tanstack-json
pnpm install
```

### 2. Cấu hình biến môi trường
Sao chép file mẫu và điền thông tin:
```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:
```env
# URL endpoint OpenAI hoặc Reverse Proxy tương thích OpenAI
OPENAI_URL=http://your-proxy-endpoint/v1

# API Key
OPENAI_API_KEY=your_api_key_here

# Model sử dụng (ví dụ: gpt-5-6, gpt-4o, gpt-4o-mini)
OPENAI_MODEL=gpt-5-6

# Mật khẩu bảo vệ ứng dụng (để trống nếu muốn tắt màn hình khóa)
APP_PASSWORD=your_secure_password
```

### 3. Chạy môi trường phát triển (Development)
```bash
pnpm dev
```
Mở trình duyệt tại: `http://localhost:3000`

---

## 📦 Các lệnh Scripts

| Lệnh | Chức năng |
|---|---|
| `pnpm dev` | Khởi chạy Vite dev server |
| `pnpm build` | Biên dịch production cả Client bundle và SSR Server bundle |
| `pnpm start` | Chạy ứng dụng production server |
| `pnpm typecheck` | Kiểm tra toàn bộ kiểu dữ liệu TypeScript (`tsc --noEmit`) |

---

## 📁 Cấu trúc thư mục

```text
anki-ai-tanstack-json/
├── src/
│   ├── components/
│   │   └── ui/              # Bộ components coss UI (Button, Card, Input, Checkbox, Badge...)
│   ├── lib/
│   │   ├── bing-image.ts    # Tạo URL tìm kiếm ảnh Bing
│   │   ├── types.ts         # TypeScript definitions cho thẻ và bài học
│   │   ├── utils.ts         # Tiện ích cn() kết hợp clsx & tailwind-merge
│   │   └── youdao.ts        # Tạo URL âm thanh từ điển Youdao (UK/US)
│   ├── routes/
│   │   ├── api/
│   │   │   └── export.ts    # Endpoint POST /api/export tạo file .apkg
│   │   ├── __root.tsx       # Root layout với cấu hình Dark mode & meta tags
│   │   └── index.tsx        # Trang chính: Wizard 3 bước + Lock Screen
│   ├── server/
│   │   ├── ai.ts            # Tích hợp TanStack AI sinh flashcard có cấu trúc
│   │   ├── anki.ts          # Đóng gói và xử lý Anki deck với media
│   │   ├── auth.ts          # Xác thực token và mật khẩu timing-safe
│   │   ├── functions.ts     # TanStack Start Server Functions (analyze, generate, auth)
│   │   ├── lesson.ts        # Trích xuất từ vựng từ Essential English Review
│   │   └── media.ts         # Tải media hình ảnh và âm thanh từ xa
│   └── styles/
│       └── app.css          # Tailwind CSS v4 & theme tokens coss Dark Mode
├── .env.example             # File mẫu biến môi trường
├── package.json             # Dependencies và scripts
├── tsconfig.json            # Cấu hình TypeScript
└── vite.config.ts           # Cấu hình Vite với TanStack Start và Tailwind v4
```

---

## 🔒 Cơ chế bảo mật (Access Gate)

- **UI Level**: Nếu `APP_PASSWORD` được thiết lập trong `.env`, người dùng bắt buộc phải nhập đúng mật khẩu để mở giao diện. Phiên làm việc được duy trì qua `sessionStorage` để không phải nhập lại sau mỗi lần tải lại trang. Có nút **"Khóa ứng dụng"** để chủ động khóa phiên.
- **API Level**: Toàn bộ server functions và endpoint `/api/export` đều xác thực token hoặc header `x-access-token`. Nếu gửi request không hợp lệ, server sẽ trả về mã lỗi `401 Unauthorized` ngay lập tức.
- **Bypass tự động**: Nếu không đặt biến `APP_PASSWORD` trong `.env`, ứng dụng sẽ tự động mở tự do cho mọi truy cập.

---

## 📄 Bản quyền

Mã nguồn được phân phối dưới giấy phép MIT.
