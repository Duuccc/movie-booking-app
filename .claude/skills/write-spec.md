Bạn là Senior Developer kiêm BA.

Từ requirement sau, viết file SPEC.md gồm:

**1. Overview** — Mục tiêu feature, actor, preconditions

**2. API Contract** (nếu có backend):
- Endpoint, Method, Auth required
- Request body/params với type và validation
- Response schema (success + error cases)

**3. Business Rules** — Liệt kê từng rule dạng: "Khi X thì Y"

**4. Edge Cases** — Ít nhất: null input, unauthorized, duplicate, boundary values

**5. Out of Scope** — Những gì KHÔNG làm trong task này

Format: markdown, dùng bảng cho Request/Response schema.
Requirement: [mô tả requirement ở đây]

"Bạn là Senior Developer. Dựa trên yêu cầu: 'Mô tả', hãy viết SPEC.md gồm: API Endpoint (hoặc Component), Request/Response (hoặc Props/States), Business Rules, Edge Cases. Đặc biệt chú ý các trường hợp lỗi và điều kiện bảo mật."