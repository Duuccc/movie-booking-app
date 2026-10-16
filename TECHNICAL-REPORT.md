# Movie Booking App: Báo cáo kỹ thuật và tiến độ

**Ngày:** 16/10/2026
**Stack:** FastAPI + SQLAlchemy + PostgreSQL 16 (backend), React + Vite (frontend), pytest (kiểm thử)

---

## Phần 1. Các vấn đề kỹ thuật đã giải quyết (ngoài CRUD)

Mỗi dòng gồm vấn đề, cách giải quyết và cách kiểm chứng.

### A. Toàn vẹn dữ liệu và đồng thời

| Vấn đề | Giải pháp | Kiểm chứng |
|---|---|---|
| Hai người đặt cùng một ghế | Ràng buộc `UNIQUE(showtime_id, seat_id)` ở DB, bắt `IntegrityError` rồi rollback cả booking (hoặc tất cả ghế hoặc không ghế nào), không dùng check-then-insert | Test 8 thread cùng tranh một ghế: đúng 1 thắng, 7 nhận 409, không còn booking nửa vời |
| Thanh toán, huỷ và hết hạn chạy chồng lên nhau | `SELECT … FOR UPDATE` rồi kiểm tra lại trạng thái sau khi giữ khoá | Test concurrency cho thấy cách này **chưa đủ**: SQLAlchemy giữ object cũ trong Session nên khách bị trừ tiền hai lần và booking đã trả tiền bị huỷ nhầm. Cách sửa là thêm `populate_existing()` (**chưa xác nhận đã áp dụng**) |
| Trả tiền hai lần (bấm đúp nút Pay) | Từ chối khi đã PAID; mỗi lần thử ghi một dòng `Payment`; thanh toán bị từ chối giữ booking ở PENDING để thử lại | Test đếm số dòng `Payment` sau mỗi kịch bản |
| Giá đổi sau khi khách đã đặt | Lưu `total_amount` ngay lúc đặt. Trang xác nhận từng tính lại theo giá hiện tại, đã sửa lại dùng giá đã lưu | Test: đổi giá suất chiếu rồi trả tiền, số tiền vẫn là giá lúc đặt |
| Ghế bị giữ mãi khi khách bỏ dở | Hold 5 phút, hết hạn tự nhả ghế theo kiểu *lazy expiration* (dọn khi có ai chạm vào suất chiếu), không cần cron | Bộ test hết hạn, dùng booking dựng sẵn với `expires_at` trong quá khứ |
| Xoá phim, rạp hay suất làm mất booking của khách | Chặn xoá khi còn booking đang hiệu lực. Test phát hiện thêm lỗi cascade ở ORM (`Showtime.bookings`) gây 500 khi xoá suất chỉ còn booking đã huỷ; sửa bằng `cascade="all, delete-orphan"` (**chưa xác nhận đã áp dụng**) | Ma trận 3 đối tượng × 3 tình trạng booking |

### B. Bảo mật và phân quyền

| Vấn đề | Giải pháp | Kiểm chứng |
|---|---|---|
| Token cũ giữ quyền sau khi bị hạ quyền | Quyền lấy từ DB mỗi request, không tin claim `role` trong JWT | Test token giả `role=ADMIN` bị 403; admin bị hạ quyền mất quyền ngay |
| Leo thang đặc quyền | Đăng ký luôn tạo CUSTOMER, không endpoint nào tự nâng quyền; admin không thể tự hạ quyền hay tự xoá mình | Test nhận trường `role` thừa vẫn không thành ADMIN |
| Lộ thông tin tồn tại | Người khác xem booking trả 404 (không phải 403); đăng nhập sai email hay sai mật khẩu đều trả lỗi giống hệt | Test so sánh nguyên body |
| Đổi mật khẩu | Bắt buộc mật khẩu cũ, mật khẩu mới phải khác và ≥ 8 ký tự; response không bao giờ chứa hash | Bảng quyết định 5 nhánh |
| Validate đầu vào | Pydantic validator ở backend (hàng ghế A–Z, số ghế 1–50, tên không rỗng...) và kiểm tra cùng quy tắc ở frontend | Test biên giá trị |
| Upload poster | Allowlist loại file, giới hạn 5 MB, đặt tên file ngẫu nhiên (không tin tên client), xoá file cũ khi thay | Test ở `test_movies_admin.py` (đã viết, chưa chạy) |

### C. Thời gian và múi giờ

| Vấn đề | Giải pháp | Kiểm chứng |
|---|---|---|
| DB lưu UTC nhưng "ngày" của nghiệp vụ là ngày Việt Nam (UTC+7) | Datetime có timezone; mọi bộ lọc ngày và thống kê theo ngày, giờ, thứ đều quy về giờ VN, dùng khoảng nửa mở `[đầu, cuối)` | Ca 00:30, 23:59 và 00:00 đều có test |
| Backend và frontend lệch quy ước ngày | Một hàm `toVnDateKey` dùng chung ở frontend, khớp cách backend tính | Kiểm tra thủ công qua trang lịch chiếu |

### D. Truy vấn và hiệu năng

| Vấn đề | Giải pháp |
|---|---|
| Hiển thị số ghế trống cần N request (mỗi suất một request) | Endpoint batch trả số ghế trống của nhiều suất bằng 3 query; xử lý xung đột thứ tự route (`/availability` bị `/{id}` nuốt) |
| Báo cáo doanh thu | SQL aggregation theo ngày, format, loại ghế, rạp; top phim; tỷ lệ huỷ; so sánh với kỳ trước; giờ và thứ cao điểm; heatmap lấp đầy suất chiếu; điền đủ ngày/giờ trống; chọn khoảng ngày tuỳ ý. Test kiểm tra các lát cắt cộng lại bằng tổng doanh thu |
| Danh mục Trending | Tính từ booking thật trong 14 ngày, không đổi schema |
| Danh sách dài | Hook phân trang dùng chung; lọc phía server khi logic phụ thuộc múi giờ, phía client khi chỉ so khớp chuỗi |

### E. Mô hình hoá nghiệp vụ

| Vấn đề | Giải pháp |
|---|---|
| Giá theo loại ghế và định dạng chiếu | Phụ phí cố định, tính qua **một hàm dùng chung** để bản đồ ghế và lúc đặt vé không lệch nhau (có test chứng minh) |
| Bổ sung ghế cho rạp | Thao tác idempotent; hàng đã tồn tại thì khoá, không cho mở rộng để không ảnh hưởng booking; validate chặt |
| Tạo nhiều suất chiếu cùng lúc | Endpoint batch atomic: một dòng lỗi thì không dòng nào được tạo |
| Thao tác hai bước dễ hỏng một nửa (lưu phim rồi upload poster; tạo rạp rồi tạo ghế) | Nếu bước 2 lỗi, form chuyển sang chế độ sửa bản ghi đã tạo để thử lại, không tạo bản trùng |
| Enum Postgres và Python có tên khác giá trị (`TWO_D` / `"2D"`) | `values_callable` cho cột Enum |
| Không có Alembic | SQL migration idempotent và quy trình ghi lại trong tài liệu |

### F. Frontend

| Vấn đề | Giải pháp |
|---|---|
| Token hết hạn nhưng giao diện vẫn "đăng nhập" | `api.js` phát sự kiện `auth:expired` khi gặp 401, `AuthContext` tự đăng xuất |
| Cần chọn ghế trước khi đăng nhập | Trang ghế công khai; bấm đặt thì chuyển sang login và giữ các ghế đã chọn qua `location.state` (kèm sửa lỗi `=` thay vì `===` làm mọi lỗi đều đá về login) |
| Mất tab, bộ lọc khi bấm Back | Đưa trạng thái vào URL (`useSearchParams`); nút Back dùng `navigate(-1)`, không dùng `<Link>` |
| Timer hết giờ va vào nút Pay | Chặn ở UI bằng `payingRef`; việc bảo vệ thật nằm ở backend (mục A) |
| Nhiều lỗi giao diện khó thấy | Vòng lặp request vô hạn do mảng không memo, flexbox `stretch` ghi đè `aspect-ratio`, ghép class thiếu dấu cách, `flex-wrap` làm lệch hàng (đổi sang grid) |
| Giao diện admin | Layout sidebar dùng nested routes; form dạng modal; `ConfirmDialog` thay `window.confirm`; trang in vé |

### G. Chất lượng

| Việc | Chi tiết |
|---|---|
| Bộ test pytest trên **Postgres thật** | Cô lập từng test bằng transaction và savepoint; có chốt chặn tên DB phải kết thúc bằng `_test`; thiết kế theo 4 kỹ thuật EP, BVA, Decision Table, State Transition; test đồng thời bằng thread thật và kịch bản xen kẽ xác định. Lần chạy đầy đủ gần nhất có số liệu (sau Milestone 4): **220 pass, 1 xfail, 1 fail**. Test fail đó chính là lỗi cascade ở mục A. Sau đó đã thêm test analytics, concurrency và các test lấp ô trống, chưa có số liệu tổng mới |
| Test phát hiện lỗi thật | Hai lỗi: cascade khi xoá suất chiếu và race thanh toán/huỷ do identity map |
| Tài liệu cho AI và dev mới | `AGENTS.md` ghi quyết định cốt lõi, các lỗi đã gặp (footguns) và quy ước |

### Giới hạn đã biết (nên nêu khi review)

- Hai bản sửa ở mục A (`populate_existing()` và cascade) cần xác nhận đã áp dụng và test xanh.
- Thanh toán là mock; chưa có migration tool; `JWT` không thu hồi được và không tự đăng xuất khi đang đứng yên.
- Doanh thu theo loại ghế là ước lượng (chia đều trong từng booking).
- API chấp nhận `price` âm (đã có test `xfail` theo dõi). `availability` còn tính cả hold đã hết hạn (cũng `xfail`).
- Chặn xoá đang coi hold bỏ dở chưa được dọn là "đang hiệu lực".
- Đặt nhiều ghế cùng lúc chưa sắp xếp `seat_ids` nên có nguy cơ deadlock hiếm gặp.
- Xoá user là xoá cứng, kéo theo xoá toàn bộ booking của họ.
- Poster chỉ kiểm tra `Content-Type`, chưa kiểm tra nội dung file; frontend chưa có test.

---

## Phần 2. Báo cáo hôm nay

### Đã làm

- Hoàn thành Milestone 6 (concurrency): test 8 request tranh một ghế, thanh toán đôi và 4 kịch bản xen kẽ. Chạy thật được 4 xanh, 5 đỏ.
- Chẩn đoán nguyên nhân gốc của 5 test đỏ: `with_for_update()` không ghi đè object đã nằm trong Session, dẫn đến trừ tiền hai lần và huỷ nhầm booking đã trả tiền; đề xuất sửa bằng `populate_existing()` ở 3 hàm.
- Đối chiếu bộ test với 4 kỹ thuật thiết kế (EP, BVA, Decision Table, State Transition) và chỉ ra các ô còn trống.
- Viết bổ sung khoảng 20 hàm test (~65 case) lấp các ô trống: biên mật khẩu 7/8 ký tự, biên thời gian hết hạn bằng cách đóng băng đồng hồ, ma trận phân quyền đủ 3 vai trò, test phim và upload poster.

### Đang làm

- Áp dụng `populate_existing()` và chạy lại, đích là 9/9 test concurrency xanh ổn định qua 20 lần lặp.

### Kế hoạch ngày mai

- Milestone 7: viết test frontend bằng Vitest và React Testing Library, rồi thiết lập CI chạy bộ test mỗi lần push.