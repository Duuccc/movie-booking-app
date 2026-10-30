# SPEC: Movie Booking API

Tài liệu mô tả **hành vi mong đợi** của từng endpoint, theo mẫu *Business Rules* và *Edge Cases*. Tài liệu này không mô tả hình dạng request/response (đó là việc của API contract, ví dụ OpenAPI tại `/docs`).

Những chỗ code hiện tại **chưa đúng spec** được đánh dấu ⚠ và tổng hợp ở mục "Sai lệch đã biết" cuối tài liệu.

---

## Quy ước chung

**Xác thực và phân quyền**
- Xác thực bằng header `Authorization: Bearer <JWT>`. Token thiếu, rác, hết hạn, sai chữ ký, hoặc thuộc về user đã bị xoá → `401`.
- Vai trò (`CUSTOMER`, `ADMIN`) luôn được đọc **từ database** ở mỗi request, không tin claim `role` trong token. Đổi vai trò có hiệu lực ngay với token cũ.
- Đã đăng nhập nhưng không đủ quyền → `403`.
- Tài nguyên của người khác (booking) → `404`, không phải `403`, để không lộ việc tài nguyên đó tồn tại.

**Lỗi**
- Mọi lỗi có dạng `{"detail": "..."}`.
- Path param sai kiểu (ví dụ `:id` không phải số) → `422` (FastAPI validate kiểu), không phải `400`.
- Body hoặc query sai schema, thiếu trường bắt buộc → `422`.
- Vi phạm quy tắc nghiệp vụ → `400`. Xung đột tài nguyên (ghế đã bị giữ) → `409`.

**Tiền và thời gian**
- Tiền là số nguyên VND, không có phần thập phân.
- Thời gian lưu ở UTC, có timezone. **"Ngày" luôn tính theo giờ Việt Nam (UTC+7)**, khoảng nửa mở `[00:00, 24:00)`: 00:30 giờ VN thuộc ngày đó, 00:00 giờ VN thuộc ngày kế.

**Giá vé** (dùng chung cho bản đồ ghế và lúc đặt vé)
- Giá một ghế = giá suất chiếu + phụ phí loại ghế + phụ phí định dạng.
- Phụ phí loại ghế: `STANDARD` +0, `VIP` +15.000, `COUPLE` +35.000.
- Phụ phí định dạng: `2D` +0, `3D` +25.000, `IMAX` +50.000.

**Trạng thái booking**
- `status`: `CONFIRMED` hoặc `CANCELLED`. `payment_status`: `PENDING`, `PAID` (hoặc `FAILED`, hiện chưa được dùng).
- *Hold*: booking `CONFIRMED` + `PENDING` giữ ghế đến `expires_at` (5 phút sau khi tạo). Hold quá hạn chưa trả tiền sẽ được tự chuyển `CANCELLED` và nhả ghế khi có người chạm vào suất chiếu hoặc booking đó (xem `GET /showtimes/:id/seats`, `POST /bookings`, `GET /bookings`, `GET /bookings/:id`). Không có tác vụ nền.
- "Ghế đã đặt" luôn có nghĩa: tồn tại một dòng `BookingSeat` cho (suất, ghế), bất kể `payment_status`.
- Booking `PAID` không bao giờ bị huỷ hoặc bị dọn hết hạn.

---

## 1. Auth

### POST /auth/register

**Business Rules**
- Endpoint POST /auth/register
- Công khai, không cần đăng nhập
- Body gồm `name`, `email`, `password`
- Luôn tạo tài khoản `CUSTOMER`; không có cách nào chọn vai trò qua API
- `email` là duy nhất
- Không tự đăng nhập sau khi đăng ký; client phải gọi `POST /auth/login`
- Response `201` không bao giờ chứa `password` hoặc `password_hash`

**Edge Cases**
- Email đã được đăng ký → 400
- Body có thêm trường `role` (ví dụ `ADMIN`) → trường bị bỏ qua hoặc request bị từ chối, nhưng tài khoản không bao giờ được tạo với vai trò `ADMIN`
- Thiếu `name`, `email` hoặc `password`, hoặc sai kiểu → 422

### POST /auth/login

**Business Rules**
- Endpoint POST /auth/login
- Công khai
- Body dạng form (`application/x-www-form-urlencoded`), email đặt trong trường `username` (chuẩn OAuth2 password flow)
- Thành công trả `access_token` và `token_type = "bearer"`
- Token chứa id user (`sub`), `role`, thời điểm hết hạn (mặc định 60 phút)

**Edge Cases**
- Sai mật khẩu → 401 `Incorrect email or password`
- Email không tồn tại → 401, **cùng status và cùng nội dung** với trường hợp sai mật khẩu (không để lộ email nào đã đăng ký)
- Thiếu `username` hoặc `password` → 422
- Gửi JSON thay vì form → 422

### GET /auth/me

**Business Rules**
- Endpoint GET /auth/me
- Phải đăng nhập
- Trả về thông tin của chính user đang đăng nhập, đọc mới từ database ở mỗi lần gọi

**Edge Cases**
- Không có token → 401
- Token rác, hết hạn hoặc sai chữ ký → 401
- Token hợp lệ nhưng user đã bị xoá → 401

### PUT /auth/me

**Business Rules**
- Endpoint PUT /auth/me
- Phải đăng nhập; chỉ đổi được tên của chính mình
- Body gồm `name`; khoảng trắng đầu và cuối bị cắt bỏ
- Không đổi được `email` hoặc `role` qua endpoint này

**Edge Cases**
- `name` rỗng hoặc chỉ có khoảng trắng → 422
- Chưa đăng nhập → 401

### PUT /auth/me/password

**Business Rules**
- Endpoint PUT /auth/me/password
- Phải đăng nhập
- Body gồm `current_password` và `new_password`
- Phải đúng mật khẩu hiện tại
- Mật khẩu mới phải khác mật khẩu hiện tại và có tối thiểu 8 ký tự
- Thành công trả `204`, không có body
- Không thu hồi các token đã phát hành trước đó (token cũ vẫn dùng được đến khi hết hạn)

**Edge Cases**
- `current_password` sai → 400 `Current password is incorrect`; mật khẩu không đổi
- `new_password` trùng `current_password` → 400
- `new_password` ngắn hơn 8 ký tự (7 ký tự bị từ chối, 8 ký tự được nhận) → 422
- Chưa đăng nhập → 401

---

## 2. Movies

### GET /movies

**Business Rules**
- Endpoint GET /movies
- Công khai
- Query `category` tùy chọn, một trong `showing`, `coming_soon`, `trending`
- `showing`: phim có ít nhất một suất chiếu bắt đầu từ thời điểm hiện tại trở đi
- `coming_soon`: phim có `release_date` **sau** ngày hôm nay (đúng hôm nay thì chưa tính là sắp chiếu)
- `trending`: tối đa 10 phim, xếp theo tổng số ghế được đặt giảm dần, tính trên booking `CONFIRMED` (kể cả chưa thanh toán) tạo trong 14 ngày gần nhất; booking `CANCELLED` không tính
- Không truyền `category` → trả mọi phim

**Edge Cases**
- `category` không hợp lệ → trả mọi phim, không báo lỗi
- Không có phim nào khớp → danh sách rỗng
- `showing`: phim chỉ có suất đã qua, hoặc chưa có suất nào → không xuất hiện
- `coming_soon`: phim không có `release_date` → không xuất hiện; phim đã phát hành → không xuất hiện
- `trending`: chưa có booking nào → danh sách rỗng
- `trending`: booking tạo 13 ngày 23 giờ trước → được tính; 14 ngày 1 giờ trước → không tính

### GET /movies/:id

**Business Rules**
- Endpoint GET /movies/:id
- Công khai
- Trả chi tiết phim, gồm `poster_url` và `trailer_url`

**Edge Cases**
- `:id` không tồn tại → 404
- `:id` không phải số → 422

### POST /movies

**Business Rules**
- Endpoint POST /movies
- Chỉ ADMIN
- Bắt buộc `title` và `duration` (phút); các trường khác tùy chọn: `description`, `genre`, `release_date`, `poster_url`, `trailer_url`
- Thành công trả `201` kèm phim vừa tạo

**Edge Cases**
- Thiếu `title` hoặc `duration` → 422
- Chưa đăng nhập → 401
- CUSTOMER → 403

### PUT /movies/:id

**Business Rules**
- Endpoint PUT /movies/:id
- Chỉ ADMIN
- Cập nhật một phần: chỉ các trường có trong body mới bị đổi

**Edge Cases**
- `:id` không tồn tại → 404
- `:id` không phải số → 422
- Chưa đăng nhập → 401; CUSTOMER → 403

### DELETE /movies/:id

**Business Rules**
- Endpoint DELETE /movies/:id
- Chỉ ADMIN
- Không xóa được phim nếu có **booking đang hiệu lực** (`CONFIRMED`) ở bất kỳ suất chiếu nào của phim
- Xóa phim xóa luôn các suất chiếu của phim, kể cả các booking đã hủy gắn với những suất đó
- Nếu `poster_url` trỏ vào file đã upload (`/static/posters/...`) thì file đó bị xóa; URL ngoài không bị đụng tới
- Thành công trả `204`

**Edge Cases**
- Còn booking đang hiệu lực → 400; phim và suất chiếu vẫn còn
- Chỉ còn booking đã hủy → xóa được (204)
- Không có booking → xóa được (204)
- `:id` không tồn tại → 404
- Chưa đăng nhập → 401; CUSTOMER → 403
- ⚠ Hold đã quá hạn nhưng chưa được dọn vẫn bị tính là "đang hiệu lực" (xem Sai lệch đã biết)

### POST /movies/:id/poster

**Business Rules**
- Endpoint POST /movies/:id/poster
- Chỉ ADMIN
- Body dạng `multipart/form-data`, trường `file`
- Chỉ nhận JPEG, PNG, WEBP (theo `Content-Type` khai báo)
- Dung lượng tối đa 5 MB: đúng 5 MB được nhận, vượt dù chỉ 1 byte thì bị từ chối
- File được lưu với tên ngẫu nhiên do server sinh, không dùng tên client gửi; `poster_url` trở thành `/static/posters/<tên>`
- Thay poster: file cũ (nếu là file đã upload) bị xóa
- Thành công trả phim đã cập nhật

**Edge Cases**
- Loại file khác (text, PDF, GIF) → bị từ chối (4xx), không lưu file nào
- File lớn hơn 5 MB → bị từ chối, không lưu file nào
- Phim không tồn tại → 404
- Thiếu trường `file` → 422
- Chưa đăng nhập → 401; CUSTOMER → 403
- ⚠ Chỉ kiểm tra `Content-Type` khai báo, không kiểm tra nội dung file thật

---

## 3. Theaters

### GET /theaters

**Business Rules**
- Endpoint GET /theaters
- Công khai
- Trả danh sách rạp

**Edge Cases**
- Chưa có rạp nào → danh sách rỗng

### GET /theaters/:id

**Business Rules**
- Endpoint GET /theaters/:id
- Công khai

**Edge Cases**
- `:id` không tồn tại → 404
- `:id` không phải số → 422

### POST /theaters

**Business Rules**
- Endpoint POST /theaters
- Chỉ ADMIN
- Body gồm `name` và `location`
- Rạp mới **chưa có ghế nào**; ghế được thêm bằng `POST /theaters/:id/seats`

**Edge Cases**
- Thiếu `name` hoặc `location` → 422
- Chưa đăng nhập → 401; CUSTOMER → 403

### PUT /theaters/:id

**Business Rules**
- Endpoint PUT /theaters/:id
- Chỉ ADMIN
- Cập nhật thông tin rạp (`name`, `location`); không động tới ghế

**Edge Cases**
- `:id` không tồn tại → 404
- `:id` không phải số → 422
- Chưa đăng nhập → 401; CUSTOMER → 403

### DELETE /theaters/:id

**Business Rules**
- Endpoint DELETE /theaters/:id
- Chỉ ADMIN
- Không xóa được rạp nếu có booking đang hiệu lực ở bất kỳ suất chiếu nào của rạp
- Xóa rạp xóa luôn ghế và các suất chiếu của rạp (kể cả booking đã hủy gắn với các suất đó)
- Thành công trả `204`

**Edge Cases**
- Còn booking đang hiệu lực → 400
- Chỉ còn booking đã hủy → xóa được
- Không có booking → xóa được, ghế và suất chiếu bị xóa theo
- `:id` không tồn tại → 404
- Chưa đăng nhập → 401; CUSTOMER → 403

### POST /theaters/:id/seats

**Business Rules**
- Endpoint POST /theaters/:id/seats
- Chỉ ADMIN
- Body `{ "rows": [ { "row", "seat_count", "seat_type" } ] }`
- `row` gồm 1 đến 2 chữ cái A–Z; khoảng trắng bị cắt và chữ thường được đổi thành chữ hoa
- `seat_count` từ 1 đến 50; mỗi hàng được tạo ghế số 1 đến `seat_count`
- `seat_type` là `STANDARD`, `VIP` hoặc `COUPLE`, mặc định `STANDARD`
- **Một hàng đã tồn tại thì bị khóa**: không thêm ghế, không mở rộng hàng đó
- Ghế và booking hiện có không bao giờ bị thay đổi
- Cả request thành công hoặc thất bại như một khối: một dòng sai thì không có ghế nào được tạo
- Thành công trả `201` kèm tổng số ghế và danh sách hàng của rạp

**Edge Cases**
- Hàng đã tồn tại trong rạp → 400 (`already exist`); số ghế của rạp không đổi
- Cùng một hàng xuất hiện hai lần trong request → 400 (`more than once`)
- `row` rỗng, là số, hoặc dài hơn 2 ký tự → 422
- `seat_count` bằng 0, âm, hoặc lớn hơn 50 (50 được nhận, 51 bị từ chối) → 422
- `seat_type` không hợp lệ → 422
- Rạp không tồn tại → 404
- Chưa đăng nhập → 401; CUSTOMER → 403

### GET /theaters/:id/seats/summary

**Business Rules**
- Endpoint GET /theaters/:id/seats/summary
- Chỉ ADMIN
- Trả tổng số ghế và danh sách hàng (đã sắp xếp) của rạp

**Edge Cases**
- Rạp chưa có ghế → tổng bằng 0, danh sách hàng rỗng
- Rạp không tồn tại → 404
- Chưa đăng nhập → 401; CUSTOMER → 403

---

## 4. Showtimes

### GET /showtimes

**Business Rules**
- Endpoint GET /showtimes
- Công khai
- Query tùy chọn: `date` (`YYYY-MM-DD`, ngày giờ Việt Nam), `theater_id`, `movie_id`; các bộ lọc kết hợp theo AND
- Kết quả xếp theo giờ bắt đầu tăng dần
- Không có bộ lọc → trả mọi suất chiếu

**Edge Cases**
- Không suất nào khớp → danh sách rỗng
- `theater_id` hoặc `movie_id` không tồn tại → danh sách rỗng, không phải 404
- `date` sai định dạng → 422
- Suất 00:30 giờ VN thuộc ngày đó, không thuộc ngày hôm trước (dù là 17:30 ngày hôm trước theo UTC)
- Suất 23:59 giờ VN thuộc ngày đó; suất 00:00 giờ VN thuộc ngày kế tiếp

### GET /showtimes/availability

**Business Rules**
- Endpoint GET /showtimes/availability
- Công khai
- Query lặp `showtime_id` (ví dụ `?showtime_id=1&showtime_id=2`); trả `available_seats` cho từng suất trong **một** request
- `available_seats` = tổng ghế của rạp trừ số ghế đã đặt (xem quy ước "ghế đã đặt")
- ⚠ Hold đã quá hạn thì không được tính là đã đặt (hiện code vẫn tính, xem Sai lệch đã biết)
- Route này phải được khai báo trước `/showtimes/:id`, nếu không `availability` bị hiểu là một id

**Edge Cases**
- Không truyền `showtime_id` nào → 422
- `showtime_id` không tồn tại → bị bỏ qua, không có trong kết quả
- Suất chưa có ghế nào được đặt → bằng tổng số ghế của rạp
- Suất hết chỗ → 0
- Mỗi suất được tính riêng: đặt ghế A1 ở suất này không ảnh hưởng suất khác cùng rạp

### GET /showtimes/:id

**Business Rules**
- Endpoint GET /showtimes/:id
- Công khai

**Edge Cases**
- `:id` không tồn tại → 404
- `:id` không phải số → 422

### GET /showtimes/:id/seats

**Business Rules**
- Endpoint GET /showtimes/:id/seats
- Công khai
- Trả mọi ghế của rạp, mỗi ghế có `seat_id`, `seat_number` (dạng `A1`), `seat_type`, `price` (đã gồm phụ phí loại ghế và định dạng) và `status` là `AVAILABLE` hoặc `BOOKED`
- Xếp theo hàng, rồi theo số ghế **theo thứ tự số** (A9 đứng trước A10)
- Trước khi trả kết quả, hệ thống dọn các hold quá hạn của suất này, nên ghế của hold quá hạn trở thành `AVAILABLE`
- `price` trên bản đồ ghế bằng đúng số tiền tính khi đặt vé

**Edge Cases**
- Suất không tồn tại → 404
- Rạp chưa có ghế → danh sách rỗng
- Ghế có hold còn hạn → `BOOKED`
- Ghế có hold quá hạn chưa trả tiền → `AVAILABLE`
- Ghế thuộc booking đã `PAID` (kể cả quá `expires_at`) → `BOOKED`
- Cùng một ghế có thể `BOOKED` ở suất này và `AVAILABLE` ở suất khác

### POST /showtimes

**Business Rules**
- Endpoint POST /showtimes
- Chỉ ADMIN
- Body gồm `movie_id`, `theater_id`, `start_time` (ISO 8601, có timezone), `price` (mặc định 75.000), `format` (`2D`, `3D`, `IMAX`; mặc định `2D`)
- Thành công trả `201`

**Edge Cases**
- `movie_id` không tồn tại → 404 `Movie not found`
- `theater_id` không tồn tại → 404 `Theater not found`
- `format` không hợp lệ → 422
- Thiếu `start_time` hoặc `movie_id` hoặc `theater_id` → 422
- Chưa đăng nhập → 401; CUSTOMER → 403
- ⚠ `price` âm phải bị từ chối (422); hiện code vẫn nhận. `price = 0` được nhận
- Câu hỏi mở: `start_time` trong quá khứ và trùng giờ cùng rạp hiện **không** bị chặn

### POST /showtimes/batch

**Business Rules**
- Endpoint POST /showtimes/batch
- Chỉ ADMIN
- Body `{ "showtimes": [ ... ] }`, mỗi phần tử có cùng định dạng như `POST /showtimes`
- Tạo như một khối: một dòng lỗi thì **không** dòng nào được tạo
- Thành công trả `201` kèm danh sách suất chiếu đã tạo, theo đúng thứ tự gửi lên

**Edge Cases**
- Danh sách rỗng → 400 `No showtimes provided`
- Một dòng có phim hoặc rạp không tồn tại → 400 `Row N: ...`, không tạo dòng nào; chỉ báo dòng lỗi đầu tiên
- Một dòng sai schema (ví dụ `format` lạ) → 422, không tạo dòng nào
- Chưa đăng nhập → 401; CUSTOMER → 403

### PUT /showtimes/:id

**Business Rules**
- Endpoint PUT /showtimes/:id
- Chỉ ADMIN
- Cập nhật một phần; nếu đổi `movie_id` hoặc `theater_id` thì giá trị mới phải tồn tại
- Đề xuất, chưa triển khai: không cho đổi `theater_id` khi suất đã có booking đang hiệu lực, vì các ghế đã đặt thuộc rạp cũ → 400

**Edge Cases**
- Suất không tồn tại → 404
- `movie_id` hoặc `theater_id` mới không tồn tại → 404
- `:id` không phải số → 422
- Chưa đăng nhập → 401; CUSTOMER → 403

### DELETE /showtimes/:id

**Business Rules**
- Endpoint DELETE /showtimes/:id
- Chỉ ADMIN
- Không xóa được suất có booking đang hiệu lực
- Các booking đã hủy gắn với suất bị xóa theo
- Thành công trả `204`

**Edge Cases**
- Còn booking đang hiệu lực → 400
- Chỉ còn booking đã hủy, hoặc hold bỏ dở đã được dọn → xóa được (204)
- Không có booking → xóa được
- Suất không tồn tại → 404
- Chưa đăng nhập → 401; CUSTOMER → 403

---

## 5. Bookings

### POST /bookings

**Business Rules**
- Endpoint POST /bookings
- Phải đăng nhập
- Body gồm `showtime_id` và `seat_ids` (ít nhất 1 ghế, không trùng nhau)
- Ghế được giữ ngay khi tạo booking: tạo `CONFIRMED` + `PENDING`, `expires_at` = 5 phút sau
- Chống đặt trùng ở tầng database bằng ràng buộc duy nhất `(showtime_id, seat_id)`, không dùng "kiểm tra rồi chèn"
- Tất cả hoặc không ghế nào: nếu một ghế đã bị giữ thì không ghế nào trong request được giữ
- `total_amount` = tổng giá từng ghế (theo quy ước giá vé), **được chốt tại thời điểm đặt**; admin đổi giá sau đó không làm đổi số tiền khách phải trả
- Trước khi đặt, hold quá hạn của suất này được dọn, nên ghế của hold quá hạn đặt được
- Thành công trả `201` kèm booking và danh sách ghế

**Edge Cases**
- Chưa đăng nhập → 401
- Suất không tồn tại → 404
- Có ghế không tồn tại → 404
- Có ghế thuộc rạp khác với rạp của suất → 400
- Ghế đã có booking đang hiệu lực (kể cả hold chưa trả tiền còn hạn), dù chỉ một phần trong số ghế yêu cầu → 409, không ghế nào được giữ, không để lại booking nửa vời
- `seat_ids` rỗng → 422
- `seat_ids` có phần tử trùng nhau → 422
- Cùng một ghế ở hai suất khác nhau → đặt được ở cả hai
- Nhiều request đồng thời cùng một ghế → đúng một request thành công (201), các request còn lại 409
- Câu hỏi mở: đặt vé cho suất đã bắt đầu hoặc đã qua hiện **không** bị chặn

### GET /bookings

**Business Rules**
- Endpoint GET /bookings
- Phải đăng nhập
- Chỉ trả booking của chính user, mới nhất trước
- Mỗi booking hold quá hạn chưa trả tiền được chuyển `CANCELLED` và nhả ghế ngay trước khi trả kết quả

**Edge Cases**
- Chưa đăng nhập → 401
- Chưa có booking → danh sách rỗng
- Booking của người khác không bao giờ xuất hiện
- Booking `PAID` quá `expires_at` → giữ nguyên `CONFIRMED` + `PAID`, ghế vẫn được giữ

### GET /bookings/:id

**Business Rules**
- Endpoint GET /bookings/:id
- Phải đăng nhập
- Chỉ **chủ booking** xem được; ADMIN cũng không xem được booking của người khác ở endpoint này (dùng `GET /admin/bookings`)
- Hold quá hạn chưa trả tiền được chuyển `CANCELLED` trước khi trả kết quả

**Edge Cases**
- Booking không tồn tại hoặc thuộc người khác → 404 (hai trường hợp không phân biệt được)
- Chưa đăng nhập → 401
- `:id` không phải số → 422

### POST /bookings/:id/cancel

**Business Rules**
- Endpoint POST /bookings/:id/cancel
- Phải đăng nhập; chỉ chủ booking
- Hủy xóa các dòng giữ ghế (ghế trở lại `AVAILABLE`) nhưng **giữ lại bản ghi booking** với `status = CANCELLED` để làm lịch sử
- Chỉ hủy được booking chưa thanh toán
- Booking được khóa dòng và kiểm tra lại trạng thái **sau khi** có khóa; nếu một thanh toán vừa hoàn tất thì việc hủy bị từ chối
- Trả booking sau khi hủy

**Edge Cases**
- Booking đã `CANCELLED` → 400 `already cancelled`
- Booking đã `PAID` → 400; booking và ghế giữ nguyên
- Hold đã quá hạn nhưng chưa được dọn → hủy được (200)
- Booking vừa bị thanh toán xong ở request song song → 400, booking vẫn `PAID` (⚠ cần bản sửa khóa dòng, xem Sai lệch đã biết)
- Booking không tồn tại hoặc thuộc người khác → 404
- Chưa đăng nhập → 401

### POST /bookings/:id/pay

**Business Rules**
- Endpoint POST /bookings/:id/pay
- Phải đăng nhập; chỉ chủ booking
- Body gồm `method` (`MOMO`, `VNPAY`, `CARD`) và `simulate_failure` tùy chọn (chỉ để mô phỏng, hiện **không có cổng thanh toán thật**)
- Mỗi lần thử tạo một dòng thanh toán với số tiền bằng `total_amount` đã chốt và mã tham chiếu dạng `<METHOD>-<12 ký tự hex>`
- Thành công → `payment_status = PAID`
- Bị từ chối → trả `200` với `succeeded = 0`; booking giữ nguyên `PENDING`, vẫn giữ ghế, khách được thử lại bằng phương thức khác
- Thứ tự kiểm tra: booking đã hủy → đã thanh toán → đã hết hạn; sau khi giữ khóa dòng và kiểm tra lại trạng thái
- Hết hạn (`expires_at` nhỏ hơn hoặc bằng thời điểm hiện tại): booking chuyển `CANCELLED`, ghế được nhả, **không** tạo dòng thanh toán

**Edge Cases**
- Booking đã `CANCELLED` → 400 `cancelled`; không có dòng thanh toán nào được tạo
- Booking đã `PAID` → 400 `already been paid`; không tính thêm tiền
- Booking đã `PAID` và cũng quá hạn → vẫn là `already been paid` (đã trả tiền thắng hết hạn)
- Hold hết hạn → 400 `expired`; booking thành `CANCELLED`, ghế được nhả
- Thanh toán đúng thời điểm `expires_at` → bị coi là quá hạn; còn 1 giây → thành công
- `method` không hợp lệ → 422
- Booking không tồn tại hoặc thuộc người khác → 404
- Chưa đăng nhập → 401
- Thử bị từ chối rồi thử lại thành công → hai dòng thanh toán (một thất bại, một thành công), mỗi dòng có mã tham chiếu riêng
- Hai request thanh toán đồng thời cho cùng một booking → đúng một thành công, request còn lại 400, chỉ có một dòng thanh toán (⚠ cần bản sửa khóa dòng, xem Sai lệch đã biết)
- Đổi giá suất chiếu sau khi đặt → số tiền thanh toán vẫn là giá đã chốt

---

## 6. Admin

### GET /admin/bookings

**Business Rules**
- Endpoint GET /admin/bookings
- Chỉ ADMIN
- Trả booking của mọi user, kèm `user_id`, trạng thái, trạng thái thanh toán, tổng tiền và danh sách ghế

**Edge Cases**
- Chưa có booking nào → danh sách rỗng
- Chưa đăng nhập → 401; CUSTOMER → 403

### GET /admin/users

**Business Rules**
- Endpoint GET /admin/users
- Chỉ ADMIN
- Trả danh sách user (id, tên, email, vai trò)
- Không bao giờ có `password` hoặc `password_hash`

**Edge Cases**
- Chưa đăng nhập → 401; CUSTOMER → 403
- Token claim `role = ADMIN` nhưng database ghi `CUSTOMER` → 403 (database là nguồn đúng)

### PUT /admin/users/:id/role

**Business Rules**
- Endpoint PUT /admin/users/:id/role
- Chỉ ADMIN
- Body gồm `role` là `ADMIN` hoặc `CUSTOMER`
- ADMIN **không thể tự hạ quyền chính mình** (không có cách nào lấy lại quyền qua API)
- Có hiệu lực ngay với token cũ: admin bị hạ quyền mất quyền ngay ở request kế tiếp, dù token còn hạn

**Edge Cases**
- Tự hạ mình xuống `CUSTOMER` → 400; vai trò không đổi
- Thăng cấp người khác → 200
- Hạ cấp admin khác → 200; request tiếp theo của họ → 403
- `role` không hợp lệ → 422
- User không tồn tại → 404
- `:id` không phải số → 422
- Chưa đăng nhập → 401; CUSTOMER → 403

### DELETE /admin/users/:id

**Business Rules**
- Endpoint DELETE /admin/users/:id
- Chỉ ADMIN
- Xóa cứng tài khoản. **Kéo theo xóa mọi booking của user đó**, gồm cả booking đã thanh toán, các dòng giữ ghế và dòng thanh toán liên quan
- ADMIN không thể tự xóa chính mình
- Thành công trả `204`

**Edge Cases**
- Tự xóa → 400; tài khoản vẫn còn
- User không tồn tại → 404
- `:id` không phải số → 422
- Chưa đăng nhập → 401; CUSTOMER → 403
- Token của user vừa bị xóa → mọi request sau đó nhận 401

### GET /admin/analytics

**Business Rules**
- Endpoint GET /admin/analytics
- Chỉ ADMIN
- Query bắt buộc `date_from` và `date_to` (`YYYY-MM-DD`, ngày giờ Việt Nam, **bao gồm cả hai đầu**); tối đa 366 ngày
- Chỉ thanh toán thành công mới tính vào doanh thu; thanh toán bị từ chối và booking đã hủy không tính
- `total_revenue`, `total_bookings` (số booking có thanh toán thành công), `total_tickets_sold`, `average_order_value` (bằng 0 nếu không có booking)
- `cancellation_rate` = số booking **tạo trong khoảng** bị hủy chia cho tổng số booking tạo trong khoảng, làm tròn 1 chữ số thập phân
- `revenue_change_pct` và `bookings_change_pct` so với kỳ liền trước có cùng độ dài, làm tròn 1 chữ số; bằng `null` khi kỳ trước bằng 0
- `daily_revenue`: đủ mọi ngày trong khoảng, ngày không có doanh thu bằng 0
- `top_movies`: tối đa 5 phim, theo doanh thu giảm dần
- `revenue_by_format`, `revenue_by_theater` (giảm dần), `revenue_by_seat_type`
- `revenue_by_seat_type` là **ước lượng**: doanh thu của mỗi booking được chia đều cho các ghế của nó
- `peak_hours`: luôn đủ 24 phần tử (giờ VN), `bookings_by_weekday`: luôn đủ 7 phần tử (`Sun` đến `Sat`, ngày VN); cả hai đếm booking theo thời điểm tạo
- Các lát cắt doanh thu theo ngày, format, rạp phải cộng lại đúng bằng `total_revenue`

**Edge Cases**
- `date_from` lớn hơn `date_to` → 400
- Khoảng dài hơn 366 ngày → 400; đúng 366 ngày → 200
- Thiếu tham số hoặc sai định dạng ngày → 422
- Khoảng không có dữ liệu → các số bằng 0, các danh sách doanh thu rỗng, `daily_revenue` vẫn đủ ngày, `peak_hours` đủ 24, `bookings_by_weekday` đủ 7
- Thanh toán lúc 00:30 giờ VN thuộc ngày VN đó (không thuộc ngày hôm trước theo UTC)
- Thanh toán đúng 00:00 của ngày sau `date_to` → không tính
- Kỳ trước không có dữ liệu → `revenue_change_pct = null`
- Chưa đăng nhập → 401; CUSTOMER → 403
- `revenue_by_seat_type` có thể lệch vài VND so với tổng do chia lấy phần nguyên

### GET /admin/analytics/showtime-performance

**Business Rules**
- Endpoint GET /admin/analytics/showtime-performance
- Chỉ ADMIN
- Query bắt buộc `date` (ngày giờ VN); tùy chọn `theater_id`, `movie_id`
- Trả mọi suất chiếu trong ngày đó: `showtime_id`, `start_time`, `movie_title`, `theater_name`, `format`, `booked_seats`, `total_seats`, `occupancy_pct`
- `occupancy_pct` = `booked_seats` chia `total_seats`, nhân 100, làm tròn 1 chữ số; bằng 0 nếu rạp không có ghế
- "Ghế đã đặt" theo quy ước chung (hold chưa trả tiền còn hạn được tính; booking đã hủy đã nhả ghế nên không tính)
- Xếp theo `occupancy_pct` giảm dần

**Edge Cases**
- Ngày không có suất nào → danh sách rỗng
- Thiếu `date` → 422
- Bộ lọc không khớp (ví dụ `theater_id` không tồn tại) → danh sách rỗng
- Suất 00:30 giờ VN thuộc ngày đó; suất 23:59 thuộc ngày hôm đó; suất 00:00 thuộc ngày kế
- Rạp không có ghế → `total_seats = 0` và `occupancy_pct = 0`, không lỗi chia cho 0
- Chưa đăng nhập → 401; CUSTOMER → 403

---

## 7. System

### GET /health

**Business Rules**
- Endpoint GET /health
- Công khai
- Trả trạng thái của dịch vụ và kết nối database; dùng cho healthcheck của container

**Edge Cases**
- Hành vi khi database không kết nối được: chưa xác minh với code (xem "Điểm chưa xác minh")

### GET /static/posters/:filename

**Business Rules**
- Endpoint GET /static/posters/:filename
- Công khai; phục vụ file poster đã upload
- Trong container, request đi qua nginx tại `/api/static/posters/:filename`

**Edge Cases**
- File không tồn tại → 404

---

## Sai lệch đã biết giữa spec và code

| # | Nội dung | Spec nói | Code hiện tại | Theo dõi bằng |
|---|---|---|---|---|
| 1 | `availability` và hold quá hạn | Hold quá hạn không được tính là đã đặt | Vẫn tính (bản đồ ghế thì dọn trước nên đúng) | `xfail`: `test_availability_ignores_expired_holds` |
| 2 | Giá âm khi tạo showtime | 422 | Được nhận | `xfail`: `test_showtime_price_boundary` |
| 3 | Thanh toán và hủy đồng thời | Một thanh toán duy nhất thành công; không hủy được booking vừa thanh toán | Sai khi hai session cùng chạy: `with_for_update()` không làm mới object đã load, cần `populate_existing()` ở `pay_for_booking`, `cancel_booking`, `expire_booking_if_needed` | 5 test concurrency đang đỏ |
| 4 | Xóa suất chỉ còn booking đã hủy | 204 | 500 do quan hệ `Showtime.bookings` không có cascade | `test_a_showtime_whose_booking_was_cancelled_can_be_deleted` |
| 5 | Hold quá hạn và chặn xóa | Hold bỏ dở không nên chặn việc xóa | Vẫn tính là booking đang hiệu lực cho đến khi được dọn | chưa có test |
| 6 | Upload poster | Kiểm tra nội dung file thật | Chỉ kiểm tra `Content-Type` khai báo | chưa có test |
| 7 | `coming_soon` | So sánh với ngày hôm nay theo giờ VN | So với ngày của server | chưa có test |
| 8 | Đổi `theater_id` của suất đã có booking | Bị chặn (đề xuất) | Không bị chặn, ghế đã đặt thuộc rạp cũ | chưa có test |
| 9 | Path param không phải số | Mẫu spec công ty ghi 400 | FastAPI trả 422; spec này dùng 422 | — |

## Câu hỏi mở (cần quyết định sản phẩm)

- Có cho tạo showtime với `start_time` ở quá khứ, hoặc trùng giờ cùng rạp?
- Có cho đặt vé cho suất đã bắt đầu hoặc đã qua?
- Xóa user là xóa cứng kéo theo booking đã thanh toán; có chuyển sang xóa mềm (giữ lịch sử) không?
- `PaymentStatus.FAILED` hiện chưa được dùng; giữ hay bỏ?

## Điểm chưa xác minh với code

Các mục này viết theo hành vi suy ra từ tài liệu và test, chưa đối chiếu với source:
- Mã trả về chính xác khi từ chối loại file hoặc dung lượng poster (spec ghi chung là 4xx)
- Quy tắc kiểm tra `email` và `password` ở `POST /auth/register` (định dạng email, độ dài tối thiểu)
- Cấu trúc body của `PUT /theaters/:id` (cập nhật toàn bộ hay một phần)
- Hành vi của `GET /health` khi database không kết nối được
- Backend có kiểm tra `trailer_url` là link YouTube hay chỉ frontend kiểm tra
- Mã `201` cho `POST /movies`, `POST /theaters`, `POST /showtimes`, `POST /showtimes/batch`