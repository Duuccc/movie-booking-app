# Báo cáo kỹ thuật thiết kế testcase: Movie Booking App

**Ngày:** 28/10/2026
**Phạm vi:** bộ test backend (pytest, Postgres thật), bộ test E2E (Playwright), tổng cộng 7 khu vực nghiệp vụ.
**Bốn kỹ thuật:** EP (Equivalence Partitioning), BVA (Boundary Value Analysis), DT (Decision Table), ST (State Transition).

---

## 2. Equivalence Partitioning (EP)

Chia đầu vào thành các lớp mà code xử lý giống nhau, mỗi lớp thử bằng một đại diện.

### EP-1. Tên hàng ghế

| Lớp | Đại diện | Test |
|---|---|---|
| Hợp lệ | `"A"`, `"a"` (chữ thường), `" b "` (có khoảng trắng), `"AA"` | `test_valid_rows_are_trimmed_and_uppercased` (4) |
| Không hợp lệ | `""`, `" "`, `"1"`, `"A1"`, `"ABC"`, `"A-"`, chuỗi rất dài | `test_invalid_rows_are_rejected` (7) (unit) |
| Không hợp lệ qua API | hàng rỗng, hàng là số, hàng quá dài, 0 ghế, 51 ghế, số ghế âm | `test_invalid_rows_are_rejected` (6) (`test_theaters.py`) |
| Chuẩn hoá chữ hoa | `"a"` thành `"A"` | `test_row_letters_are_normalised_to_uppercase` |
| Hàng lặp trong một request | `A` hai lần | `test_the_same_row_twice_in_one_request_is_rejected` |
| Một dòng sai làm hỏng cả request | A hợp lệ + B không hợp lệ | `test_one_invalid_row_rejects_the_whole_request` |

### EP-2. Request đặt vé (`test_booking_creation.py`)

| Lớp | Test |
|---|---|
| Hợp lệ | `test_create_booking_succeeds` |
| Ghế đã bị giữ | `test_booking_a_taken_seat_returns_409` |
| Một phần ghế trùng (tất cả hoặc không có gì) | `test_a_conflict_rolls_back_the_whole_booking` |
| Cùng ghế, khác suất chiếu | `test_the_same_seat_can_be_booked_for_different_showtimes` |
| Ghế thuộc rạp khác | `test_a_seat_from_another_theater_is_rejected` |
| Suất chiếu không tồn tại | `test_unknown_showtime_returns_404` |
| Ghế không tồn tại | `test_unknown_seat_returns_404` |
| Danh sách ghế rỗng | `test_empty_seat_list_is_rejected` |
| Danh sách ghế trùng | `test_duplicate_seat_ids_are_rejected` |
| Chưa đăng nhập | `test_booking_requires_login` |
| Booking của người khác | `test_another_users_booking_looks_like_it_does_not_exist` |

### EP-3. Token xác thực (`test_auth.py`)

| Lớp | Test |
|---|---|
| Hợp lệ | `test_me_returns_the_logged_in_user` |
| Không có token | `test_me_without_a_token_returns_401` |
| Token rác | `test_me_rejects_a_garbage_token` |
| Hết hạn | `test_me_rejects_an_expired_token` |
| Sai chữ ký | `test_me_rejects_a_token_signed_with_the_wrong_secret` |
| Hợp lệ nhưng user đã bị xoá | `test_me_rejects_a_valid_token_for_a_user_that_no_longer_exists` |

### EP-4. Đăng ký và hồ sơ

| Lớp | Test |
|---|---|
| Email mới | `test_register_creates_a_customer_and_never_returns_the_password` |
| Email đã tồn tại | `test_register_rejects_an_email_that_is_already_taken` |
| Gửi kèm trường `role` thừa | `test_a_client_cannot_choose_its_own_role_at_registration` |
| Tên có khoảng trắng thừa | `test_update_name_trims_whitespace` |
| Tên rỗng | `test_update_name_rejects_a_blank_name` |
| Chưa đăng nhập | `test_update_name_requires_login` |

### EP-5. Thanh toán (`test_payments.py`)

| Lớp | Test |
|---|---|
| Phương thức hợp lệ (MOMO, VNPAY, CARD) | `test_payment_reference_is_prefixed_with_the_method` (3) |
| Phương thức không hợp lệ | `test_an_unknown_payment_method_is_rejected` |
| Kết quả cổng: thành công | `test_successful_payment_marks_the_booking_paid` |
| Kết quả cổng: bị từ chối | `test_a_declined_payment_keeps_the_booking_pending_and_the_seats_held` |
| Người gọi: chưa đăng nhập, không phải chủ, booking không tồn tại | `test_paying_requires_login`, `test_another_customer_cannot_pay_for_my_booking`, `test_paying_for_an_unknown_booking_returns_404` |

### EP-6. Showtime, theater, movie (admin)

| Lớp | Test |
|---|---|
| Showtime hợp lệ | `test_admin_creates_a_showtime` |
| Dùng giá trị mặc định (giá, format) | `test_price_and_format_have_defaults` |
| Phim hoặc rạp không tồn tại | `test_create_rejects_an_unknown_movie_or_theater` (2) |
| Format không hợp lệ | `test_create_rejects_an_unknown_format` |
| Cập nhật một phần | `test_update_changes_only_the_fields_sent` (showtime, movie) |
| Cập nhật tham chiếu sai hoặc đối tượng không tồn tại | `test_update_rejects_an_unknown_movie`, `test_update_of_an_unknown_showtime_returns_404`, `test_unknown_theater_returns_404` |
| Batch: toàn bộ hợp lệ | `test_batch_creates_every_row` |
| Batch: một dòng lỗi nghiệp vụ hoặc lỗi schema | `test_batch_is_all_or_nothing`, `test_batch_with_a_schema_invalid_row_creates_nothing` |
| Movie hợp lệ, thiếu trường bắt buộc | `test_admin_creates_a_movie`, `test_create_requires_title_and_duration` (2) |
| Theater: tạo không ghế, cập nhật, tạo hàng ghế | `test_admin_creates_a_theater_with_no_seats_yet`, `test_admin_updates_a_theater`, `test_rows_create_the_requested_number_of_seats` |
| Loại ghế được lưu và đến bản đồ ghế | `test_seat_types_are_stored_and_reach_the_seat_map` |

### EP-7. Danh mục phim (`test_movie_categories.py`)

| Lớp | Test |
|---|---|
| `showing`: suất tương lai, suất đã qua, không có suất | `test_showing_lists_only_movies_with_a_future_showtime` |
| `coming_soon`: đã phát hành, sắp phát hành, không có ngày | `test_coming_soon_lists_only_movies_releasing_in_the_future` (regression lỗi `query.filter` không gán lại) |
| Không truyền category | `test_without_a_category_every_movie_is_listed` |
| Category lạ | `test_an_unknown_category_falls_back_to_every_movie` |
| `trending`: chưa có booking, có booking, booking đã huỷ | `test_trending_is_empty_when_nothing_is_booked`, `test_trending_ranks_movies_by_booked_seats`, `test_trending_ignores_cancelled_bookings` |

### EP-8. Bản đồ ghế và availability

| Lớp | Test |
|---|---|
| Không ghế nào bị đặt | `test_availability_counts_every_seat_when_nothing_is_booked` |
| Đặt một phần | `test_availability_drops_by_the_number_of_booked_seats` |
| Nhiều suất độc lập | `test_availability_is_tracked_per_showtime` |
| Hold chưa trả tiền còn hạn | `test_a_live_unpaid_hold_counts_as_taken` |
| Hold đã hết hạn chưa dọn | `test_availability_ignores_expired_holds` (xfail, lỗi đã biết) |
| Thiếu tham số | `test_availability_requires_at_least_one_showtime_id` |
| Suất không tồn tại | `test_seat_map_of_an_unknown_showtime_returns_404` |

### EP-9. Đầu vào của analytics và performance

| Lớp | Test |
|---|---|
| Khoảng ngày bị đảo | `test_a_reversed_range_is_rejected` |
| Thiếu hoặc sai định dạng ngày | `test_missing_or_malformed_dates_are_rejected` (4: no-dates, only-from, only-to, not-a-date) |
| Thiếu `date` ở performance | `test_the_date_is_required` |
| Loại bản ghi trong dữ liệu mẫu: thanh toán thành công, thanh toán bị từ chối, booking đã huỷ, giao dịch ngoài cửa sổ | Fixture `sales`, kiểm bằng `test_headline_numbers` |
| Nhóm theo format, rạp, loại ghế, phim | `test_revenue_by_format`, `test_revenue_by_theater_is_ordered_highest_first`, `test_revenue_by_seat_type_splits_each_booking_evenly_across_its_seats`, `test_top_movies_are_ranked_by_revenue` |

### EP-10. Upload poster (`test_movies_admin.py`)

| Lớp | Test |
|---|---|
| Loại file cho phép (JPEG, PNG, WEBP) | `test_each_allowed_image_type_is_accepted_and_stored` (3) |
| Loại file không cho phép (text, PDF, GIF) | `test_other_file_types_are_rejected_and_nothing_is_stored` (3) |

### EP-11. Concurrency: mức chồng lấn giữa các request

| Lớp | Test |
|---|---|
| Cùng một ghế | `test_only_one_of_many_simultaneous_bookings_for_the_same_seat_wins` |
| Cùng một tập nhiều ghế | `test_competing_multi_seat_bookings_are_all_or_nothing` |
| Chồng lấn một phần | `test_a_loser_of_a_partial_overlap_does_not_keep_its_free_seat` |
| Không chồng lấn | `test_bookings_for_different_seats_do_not_conflict` |

### EP-12. E2E

| Lớp | Test |
|---|---|
| Vai trò: customer, admin | `a customer is bounced away from the admin area`, `an admin lands on Analytics...` |
| Kiểu điều hướng: tải cứng, chuyển trang trong app | `a hard load of a deep link still serves the app (nginx SPA fallback)` |

---

## 3. Boundary Value Analysis (BVA)

Thử đúng tại biên (min, max) và sát biên (min−1, max+1).

| # | Biên | Giá trị thử | Test |
|---|---|---|---|
| B-1 | Số ghế mỗi hàng, miền 1 đến 50 | 1, 50 (hợp lệ) | `test_seat_count_at_the_boundaries_is_accepted` (2) |
| | | 0, −1, 51, 999999 (ngoài miền) | `test_seat_count_outside_the_range_is_rejected` (4) |
| | | 0, 51, −1 qua API | `test_invalid_rows_are_rejected` (6) (`test_theaters.py`) |
| B-2 | Độ dài tên hàng, miền 1 đến 2 | `"AA"` (max), `"ABC"` (max+1), `""` (min−1) | cặp test hàng hợp lệ và không hợp lệ (unit) |
| B-3 | Độ dài mật khẩu mới, tối thiểu 8 | `""`, 7 ký tự (min−1), 8 ký tự (min) | `test_new_password_length_boundary` (3) |
| B-4 | Độ dài khoảng ngày, tối đa 366 | 366 (qua), 367 (bị chặn) | `test_range_length_limit` (2) |
| B-5 | Mốc nửa đêm giờ Việt Nam (đầu bao gồm, cuối loại trừ) | 00:30, 23:59, 00:00 của ngày kế | `test_single_day_bounds_are_vietnam_midnight_to_midnight`, `test_multi_day_range_end_is_exclusive_midnight_after_the_last_day`, `test_date_filter_uses_the_vietnam_calendar_day` (5), `test_the_day_follows_vietnam_time`, `test_daily_revenue_is_grouped_by_vietnam_day`, `test_bookings_by_hour_use_vietnam_time`, `test_bookings_by_weekday_use_vietnam_time` |
| | Biên cửa sổ doanh thu (đầu kỳ, cuối kỳ, kỳ trước) | 7 cửa sổ | `test_revenue_and_change_for_each_window` (7: ca `last-minute-is-included`, `midnight-starts-the-next-day`, `00:30-belongs-to-the-vietnam-day`, ngày đơn lẻ) |
| B-6 | Hết hạn giữ ghế (`expires_at <= now`) | −1 giây, đúng bằng, +1 giây (đóng băng đồng hồ) | `test_hold_expiry_boundary` (3) |
| B-7 | Hạn thanh toán | đúng bằng `expires_at`, +1 giây | `test_payment_deadline_boundary` (2) |
| B-8 | Thời gian giữ ghế 5 phút | còn lại trong khoảng 4 đến 5 phút | `test_new_booking_holds_the_seats_for_five_minutes` |
| B-9 | `release_date` so với hôm nay | hôm qua, hôm nay, ngày mai | `test_coming_soon_boundary_is_strictly_after_today` (3) |
| B-10 | Cửa sổ trending 14 ngày | 13 ngày 23 giờ (tính), 14 ngày 1 giờ (không) | `test_trending_only_counts_the_last_fourteen_days` (2). Lệch ±1 giờ có chủ đích để không flaky |
| B-11 | Số ghế trống | 0, 1 còn lại, 4 còn lại, hết chỗ | `test_availability_at_both_ends_of_the_range` (4), `test_a_sold_out_showtime_rejects_new_bookings_and_shows_every_seat_booked` |
| B-12 | Giá suất chiếu | 1, 0, −1 | `test_showtime_price_boundary` (3). Ca −1 là `xfail`: API hiện chấp nhận giá âm |
| B-13 | Dung lượng poster, tối đa 5 MB | đúng 5 MB, vượt 1 byte | `test_poster_size_limit_boundary` (2) |
| B-14 | Mẫu số bằng 0 | `previous = 0`, `current = 0`, rạp 0 ghế, 0 booking | `test_percent_change_without_a_baseline_is_none`, ca `(0, 100)` trong `test_percent_change`, `test_a_theater_without_seats_has_zero_occupancy_instead_of_crashing`, `test_a_window_with_no_data_returns_complete_zeroed_series` |
| B-15 | Tỷ lệ và làm tròn | 100%, 0%, 1/3, 1/6 | `test_showtimes_are_listed_busiest_first`, `test_occupancy_is_rounded_to_one_decimal`, `test_cancellation_rate`, ca `(1, 3)` trong `test_percent_change` |
| B-16 | Giới hạn số phần tử | 6 phim, chỉ lấy 5 | `test_top_movies_is_limited_to_the_five_highest_earners` |
| B-17 | Số phần tử tối thiểu | 0 booking, 0 suất, 0 ghế, 0 dòng batch, 0 id | `test_trending_is_empty_when_nothing_is_booked`, `test_a_day_without_showtimes_is_an_empty_list`, `test_an_empty_batch_is_rejected`, `test_empty_seat_list_is_rejected`, `test_availability_requires_at_least_one_showtime_id` |
| B-18 | Biên chữ số của số ghế | A9 rồi A10 (sắp xếp số, không theo chuỗi) | `test_seat_map_orders_seat_10_after_seat_9` |
| B-19 | Độ dài tên người dùng | rỗng sau khi cắt khoảng trắng | `test_update_name_rejects_a_blank_name` |

Ghi chú: các test hết hạn dùng `−1 phút` và `+4 phút` (xem Phụ lục A) là **EP**, không phải BVA. Chúng cố ý chọn lệch lớn khỏi biên để không flaky.

---

## 4. Decision Table (DT)

Mỗi bảng liệt kê các tổ hợp điều kiện và kết quả. Cột **Test** cho biết ô nào đã được phủ.

### DT-1. Giá = loại ghế × định dạng chiếu (giá cơ sở 75.000)

| | 2D | 3D | IMAX |
|---|---|---|---|
| STANDARD | 75.000 | 100.000 | 125.000 |
| VIP (+15.000) | 90.000 | 115.000 | 140.000 |
| COUPLE (+35.000) | 110.000 | 135.000 | 160.000 |

Cả 9 ô nằm trong `test_seat_price` (9 case). Kiểm tra chéo: `test_total_includes_seat_type_and_format_surcharges`, `test_seat_map_shows_type_price_and_availability`, `test_the_price_on_the_seat_map_is_the_price_charged`.

### DT-2. Phân quyền = vai trò × endpoint

| Vai trò | 16 endpoint admin | 4 endpoint công khai |
|---|---|---|
| Anonymous | 401, `test_admin_endpoints_reject_anonymous_requests` (16) | 200, `test_browsing_endpoints_are_public` (4) |
| Customer | 403, `test_admin_endpoints_reject_customers` (16) | 200, `test_public_endpoints_do_not_change_for_logged_in_users` (4 trong 8) |
| Admin | qua cổng quyền, `test_admin_passes_the_permission_gate_on_every_admin_endpoint` (16), cộng 200 trên `GET /admin/bookings` (`test_admin_can_use_admin_endpoints`) | 200 (4 còn lại trong 8) |

Điều kiện thứ ba, **role trong token so với role trong DB**:

| Token claim | DB role | Kết quả | Test |
|---|---|---|---|
| ADMIN (giả) | CUSTOMER | 403 | `test_a_token_claiming_to_be_admin_does_not_make_a_customer_admin` |
| ADMIN (token cũ) | vừa bị hạ xuống CUSTOMER | 403 | `test_a_demoted_admin_loses_access_even_with_an_old_token` |

### DT-3. Đăng nhập = email tồn tại × mật khẩu đúng

| Email tồn tại | Mật khẩu đúng | Kết quả | Test |
|---|---|---|---|
| Có | Có | 200 và token | `test_login_returns_a_token_that_identifies_the_user` |
| Có | Không | 401 | `test_login_with_a_wrong_password_returns_401`, case `wrong-password` |
| Không | (mật khẩu hợp lệ của người khác) | 401, nội dung giống hệt | case `unknown-email` |
| Không | Không | 401, nội dung giống hệt | case `unknown-email-and-wrong-password` |

Test gộp: `test_every_failed_login_looks_identical` (3 case).

### DT-4. Đổi mật khẩu

| Đã đăng nhập | Mật khẩu hiện tại đúng | Mới khác cũ | Mới ≥ 8 ký tự | Kết quả | Test |
|---|---|---|---|---|---|
| Không | | | | 401 | `test_change_password_requires_login` |
| Có | Không | | | 400 | `test_change_password_requires_the_correct_current_password` |
| Có | Có | Không | | 400 | `test_change_password_rejects_reusing_the_current_password` |
| Có | Có | Có | Không | 422 | `test_new_password_length_boundary`, case `7-chars-one-below-the-minimum` |
| Có | Có | Có | Có | 204 | `test_changing_the_password_switches_which_password_logs_in`, case `8-chars-exactly-the-minimum` |

### DT-5. Admin đổi role hoặc xoá user

| Đối tượng | Hành động | Kết quả | Test |
|---|---|---|---|
| Chính mình | hạ xuống CUSTOMER | 400 | `test_an_admin_cannot_remove_their_own_admin_role` |
| Người khác | thăng lên ADMIN | 200 | `test_admin_can_promote_a_customer` |
| Admin khác | hạ xuống CUSTOMER | 200 | `test_a_demoted_admin_loses_access_even_with_an_old_token` |
| Role không hợp lệ | | 422 | `test_role_change_rejects_an_unknown_role` |
| Không tồn tại | đổi role | 404 | `test_role_change_for_an_unknown_user_returns_404` |
| Chính mình | xoá | 400 | `test_an_admin_cannot_delete_their_own_account` |
| Người khác | xoá | 204 | `test_admin_can_delete_another_user` |
| Không tồn tại | xoá | 404 | `test_deleting_an_unknown_user_returns_404` |

Ô chưa phủ: tự đặt mình thành ADMIN (không đổi gì).

### DT-6. Chặn xoá = đối tượng × tình trạng booking

| | Có booking đang hiệu lực | Chỉ có booking đã huỷ | Không có booking |
|---|---|---|---|
| Showtime | `test_a_showtime_with_an_active_booking_cannot_be_deleted` (400) | `test_a_showtime_whose_booking_was_cancelled_can_be_deleted` (204, hiện đỏ vì lỗi cascade) | `test_a_showtime_without_bookings_can_be_deleted` |
| Movie | `test_a_movie_with_an_active_booking_cannot_be_deleted` | `test_a_movie_whose_only_bookings_are_cancelled_can_be_deleted` | `test_deleting_a_movie_without_bookings_removes_its_showtimes` |
| Theater | `test_a_theater_with_an_active_booking_cannot_be_deleted` | `test_a_theater_whose_only_bookings_are_cancelled_can_be_deleted` | `test_deleting_a_theater_without_bookings_removes_its_seats_and_showtimes` |

Cột giữa của Movie và Theater là hai test viết sau khi phát hiện lỗi cascade; cần áp dụng vào bộ test.

### DT-7. Dọn hold = đã hết hạn × đã thanh toán (`HOLD_CASES`)

| Hết hạn | Đã trả tiền | Hành động | Case |
|---|---|---|---|
| Có | Không | huỷ và trả ghế | `expired-and-unpaid` |
| Không | Không | giữ nguyên | `still-within-the-hold` |
| Có | Có | giữ nguyên | `expired-but-paid` |
| Không | Có | giữ nguyên | `paid-and-still-within-the-hold` |

Bảng chạy qua hai hàm: `test_expire_bookings_for_showtime` (4) và `test_expire_booking_if_needed` (4), tức 8 lần thực thi. Quy tắc ưu tiên "đã trả tiền thắng hết hạn" có thêm `test_a_paid_booking_past_its_hold_time_is_not_treated_as_expired` và `test_my_bookings_list_leaves_a_paid_booking_alone_even_past_its_hold_time`.

### DT-8. Bộ lọc = rạp × phim

| Rạp | Phim | Test (`/showtimes`) | Test (performance) |
|---|---|---|---|
| Không | Không | `test_showtimes_come_back_in_start_time_order` | `test_showtimes_are_listed_busiest_first` |
| Có | Không | `test_filter_by_theater` | `test_filter_by_theater` |
| Không | Có | `test_filter_by_movie` | `test_filter_by_movie` |
| Có | Có | `test_filters_combine` | `test_filters_combine` |
| Không khớp | | `test_filters_that_match_nothing_return_an_empty_list` | `test_filters_that_match_nothing_return_an_empty_list` |

### DT-9. Quy tắc tính vào doanh thu và tỷ lệ huỷ

| Loại bản ghi | Tính doanh thu | Tính tỷ lệ huỷ | Bản ghi trong fixture `sales` |
|---|---|---|---|
| Thanh toán thành công, trong cửa sổ | Có | Có (booking không huỷ) | P1 đến P4 |
| Thanh toán bị từ chối (booking còn PENDING) | Không | Có (booking tạo trong cửa sổ) | F1 |
| Booking đã huỷ | Không | Có (tử số) | K1 |
| Thanh toán đúng `window_end` hoặc ngoài cửa sổ | Không | Không | X1, Z1, Q1, Q2, Q3 |

Test: `test_headline_numbers`, `test_cancellation_rate`, `test_bookings_change_compares_paid_bookings_with_the_previous_period`.

### DT-10. Tạo showtime: tham chiếu hợp lệ

| Phim tồn tại | Rạp tồn tại | Format hợp lệ | Kết quả | Test |
|---|---|---|---|---|
| Có | Có | Có | 201 | `test_admin_creates_a_showtime` |
| Không | Có | Có | 404 | `test_create_rejects_an_unknown_movie_or_theater`, case `movie_id` |
| Có | Không | Có | 404 | case `theater_id` |
| Có | Có | Không | 422 | `test_create_rejects_an_unknown_format` |

Chỉ phủ trường hợp lỗi đơn; chưa phủ tổ hợp hai lỗi cùng lúc.

### DT-11. E2E: vai trò × khu vực admin

| Vai trò | Vào `/admin` | Test |
|---|---|---|
| Customer | bị đưa về `/` | `a customer is bounced away from the admin area` |
| Admin | tới `/admin/analytics` | `an admin lands on Analytics and its queries run against real Postgres` |

---

## 5. State Transition (ST)

### ST-1. Vòng đời booking

Bốn trạng thái: **HELD** (CONFIRMED + PENDING còn hạn), **EXPIRED-HOLD** (quá hạn, chưa được dọn), **PAID**, **CANCELLED**.

| Từ | Sự kiện | Đến | Test |
|---|---|---|---|
| (mới) | đặt vé | HELD | `test_create_booking_succeeds` |
| HELD | trả tiền thành công | PAID | `test_successful_payment_marks_the_booking_paid` |
| HELD | trả tiền bị từ chối | HELD, giữ ghế | `test_a_declined_payment_keeps_the_booking_pending_and_the_seats_held` |
| HELD | từ chối rồi thử lại | PAID (chuỗi hai bước) | `test_retrying_after_a_decline_succeeds_and_keeps_every_attempt` |
| HELD | huỷ | CANCELLED, trả ghế | `test_cancelling_frees_the_seat_for_someone_else`, `test_a_booking_can_still_be_cancelled_after_a_declined_payment` |
| HELD | dọn dẹp (còn hạn) | HELD | case `still-within-the-hold`, `test_a_seat_held_by_a_live_booking_still_conflicts` |
| HELD | thời gian trôi qua hạn | EXPIRED-HOLD | `test_hold_expiry_boundary` (3), `test_payment_deadline_boundary` (2) |
| EXPIRED-HOLD | dọn dẹp | CANCELLED | `test_expire_bookings_for_showtime`, `test_expire_booking_if_needed`, `test_expire_bookings_returns_how_many_it_expired`, `test_expire_bookings_only_touches_the_given_showtime` |
| EXPIRED-HOLD | xem bản đồ ghế | CANCELLED | `test_seat_map_frees_expired_holds_but_keeps_live_ones` |
| EXPIRED-HOLD | người khác đặt ghế đó | CANCELLED, đặt được | `test_a_seat_held_by_an_expired_booking_can_be_booked` |
| EXPIRED-HOLD | xem danh sách hoặc một booking | CANCELLED | `test_my_bookings_list_shows_expired_holds_as_cancelled`, `test_a_single_booking_lookup_shows_an_expired_hold_as_cancelled` |
| EXPIRED-HOLD | huỷ | CANCELLED | `test_a_hold_that_expired_but_was_not_cleaned_up_can_still_be_cancelled` |
| EXPIRED-HOLD | trả tiền | bị từ chối, chuyển CANCELLED | `test_paying_an_expired_booking_is_rejected_and_releases_the_seats` |
| PAID | dọn dẹp | PAID | case `expired-but-paid` và `paid-and-still-within-the-hold` |
| PAID | trả tiền lại | bị từ chối, không charge thêm | `test_paying_twice_is_rejected_and_charges_only_once` |
| PAID | huỷ | bị từ chối | `test_a_paid_booking_cannot_be_cancelled` |
| CANCELLED | trả tiền | bị từ chối | `test_a_cancelled_booking_cannot_be_paid` |
| CANCELLED | huỷ lại | bị từ chối | `test_cancelling_twice_is_rejected` |

Mọi chuyển trạng thái không hợp lệ (PAID hoặc CANCELLED nhận lại một hành động) đều có test.

### ST-2. Các vòng đời khác

| Đối tượng | Chuyển trạng thái | Test |
|---|---|---|
| Ghế theo từng suất | AVAILABLE thành BOOKED khi đặt | `test_seat_map_marks_only_the_booked_seats` |
| | BOOKED thành AVAILABLE khi huỷ | `test_cancelling_a_booking_removes_it_from_the_booked_count` |
| Role | CUSTOMER thành ADMIN | `test_admin_can_promote_a_customer` |
| | ADMIN thành CUSTOMER, có hiệu lực ngay với token cũ | `test_a_demoted_admin_loses_access_even_with_an_old_token` |
| Mật khẩu | cũ hợp lệ thành mới hợp lệ | `test_changing_the_password_switches_which_password_logs_in` |
| Tài khoản | chưa có thành đã đăng ký rồi đăng nhập được | `test_a_registered_user_can_log_in_with_the_same_credentials` |
| | tồn tại thành bị xoá (kéo theo booking) | `test_deleting_a_user_also_deletes_their_bookings` |
| Hàng ghế của rạp | chưa có thành đã có (không mở rộng được) | `test_an_existing_row_cannot_be_extended` |
| | thêm hàng mới, ghế và booking cũ giữ nguyên | `test_adding_a_row_leaves_existing_seats_and_bookings_alone` |
| Ảnh poster | chưa có thành có ảnh, thay ảnh thì xoá file cũ, xoá phim thì xoá file | `test_replacing_a_poster_deletes_the_old_file`, `test_deleting_a_movie_deletes_its_uploaded_poster` |
| Xoá suất chiếu có booking đã huỷ | showtime tồn tại thành bị xoá | `test_a_showtime_whose_booking_was_cancelled_can_be_deleted` và 3 test đi kèm |

### ST-3. Thứ tự sự kiện đồng thời (cặp hai sự kiện)

Bốn test mô phỏng chính xác thứ tự "request A đọc, request B ghi và commit, request A tiếp tục":

| Thứ tự | Test |
|---|---|
| huỷ rồi trả tiền | `test_paying_a_booking_that_was_cancelled_after_the_payment_request_loaded_it` |
| trả tiền rồi trả tiền | `test_a_second_payment_that_loaded_the_booking_before_the_first_one_finished` |
| trả tiền rồi huỷ | `test_cancelling_a_booking_that_was_paid_after_the_cancel_request_loaded_it` |
| trả tiền rồi dọn hết hạn | `test_a_payment_that_landed_just_before_the_hold_ran_out_survives_the_cleanup` |

Cộng thêm `test_two_simultaneous_payments_for_one_booking_charge_only_once` (hai thread thật, cùng thanh toán).

### ST-4. E2E: luồng trạng thái phiên

| Luồng | Test |
|---|---|
| Khách ẩn danh thành chọn ghế, đăng nhập, đặt vé, thanh toán, thấy trong "My Bookings" (đường chính; ghế đã chọn phải sống sót qua bước đăng nhập) | `a customer browses, picks seats, logs in, pays and sees the booking` |
| Hai người cùng ghế: người chậm hơn nhận thông báo, ghế chuyển sang đã đặt | `when two customers pick the same seat, the slower one is told it is taken` |
| Đã đăng nhập thành server không nhận phiên nữa, rồi bị đăng xuất | `a session the server no longer accepts logs the user out` |

---

## 6. Test không thuộc bốn kỹ thuật

| Loại | Test |
|---|---|
| Bất biến (tổng các lát cắt bằng tổng) | `test_every_breakdown_adds_up_to_the_total` |
| Bất biến (giá đã chốt không đổi theo giá hiện tại) | `test_payment_amount_is_the_price_snapshot_not_the_current_price` |
| Concurrency bằng thread thật (kết quả không đoán trước, so sánh theo tập kết quả) | 4 test đầu của `test_concurrency.py`, `test_two_simultaneous_payments_for_one_booking_charge_only_once` |
| Regression của lỗi đã gặp | `test_availability_route_is_not_shadowed_by_the_showtime_id_route`, `test_coming_soon_lists_only_movies_releasing_in_the_future` |
| Characterization (ghi lại hành vi hiện tại, đổi thì phải đổi có chủ đích) | `test_an_unknown_category_falls_back_to_every_movie`, `test_deleting_a_user_also_deletes_their_bookings`, `test_deleting_a_showtime_also_deletes_its_cancelled_bookings` |
| Hạ tầng (E2E) | `the API is reachable through the nginx proxy` |

---

## 7. Ô còn trống và rủi ro

### Đã biết, đang theo dõi bằng `xfail(strict=True)`

| Hạn chế | Test |
|---|---|
| `availability` đếm cả hold đã hết hạn chưa được dọn, trong khi bản đồ ghế dọn trước | `test_availability_ignores_expired_holds` |
| API chấp nhận `price` âm | `test_showtime_price_boundary`, case `negative` |

### Chưa phủ

| Kỹ thuật | Ô còn trống |
|---|---|
| BVA | Cận biên chính xác của cửa sổ trending (hiện dùng ±1 giờ); độ dài phim bằng 0 hoặc âm; poster 0 byte; độ dài tiêu đề |
| DT | Tổ hợp hai lỗi cùng lúc khi tạo showtime; tổ hợp loại file × dung lượng của poster; admin tự đặt mình thành ADMIN |
| ST | Trạng thái `PaymentStatus.FAILED` chưa bao giờ được dùng nên chưa có test; luồng hoàn tiền (booking đã trả tiền rồi huỷ) chưa tồn tại trong code nên không có test |
| Ngoài bốn kỹ thuật | Frontend không có test đơn vị (đã chủ động bỏ); layout và CSS (flexbox, cắt chữ) nằm ngoài tầm của pytest và Playwright; deadlock khi hai request đặt `[A1, A2]` và `[A2, A1]` cùng lúc chưa có test |

### Cần xác nhận khi chạy

- Bản sửa `populate_existing()` cho 3 hàm (đang làm đỏ 5 test concurrency).
- Bản sửa cascade `Showtime.bookings` (đang làm đỏ 1 test, và 3 test mới đi kèm chưa chạy).
- Kết quả chạy của Milestone 5, của các test bổ sung và của bộ E2E.

---

## Phụ lục A. Từng test → kỹ thuật

Cột **Kỹ thuật**: `EP`, `BVA`, `DT`, `ST`, hoặc `—`. Số trong ngoặc là số case parametrize.

### A.1. `tests/unit/test_pricing.py`

| Test | Kỹ thuật |
|---|---|
| `test_seat_price` (9) | DT |

### A.2. `tests/unit/test_seat_row_validation.py`

| Test | Kỹ thuật |
|---|---|
| `test_valid_rows_are_trimmed_and_uppercased` (4) | EP |
| `test_invalid_rows_are_rejected` (7) | EP+BVA |
| `test_seat_count_at_the_boundaries_is_accepted` (2) | BVA |
| `test_seat_count_outside_the_range_is_rejected` (4) | BVA |

### A.3. `tests/unit/test_analytics_helpers.py`

| Test | Kỹ thuật |
|---|---|
| `test_percent_change` (5) | EP+BVA |
| `test_percent_change_without_a_baseline_is_none` | BVA |
| `test_single_day_bounds_are_vietnam_midnight_to_midnight` | BVA |
| `test_multi_day_range_end_is_exclusive_midnight_after_the_last_day` | BVA |

### A.4. `tests/api/test_booking_creation.py`

| Test | Kỹ thuật |
|---|---|
| `test_create_booking_succeeds` | EP+ST |
| `test_new_booking_holds_the_seats_for_five_minutes` | BVA |
| `test_total_includes_seat_type_and_format_surcharges` | DT |
| `test_booking_a_taken_seat_returns_409` | EP |
| `test_a_conflict_rolls_back_the_whole_booking` | EP |
| `test_the_same_seat_can_be_booked_for_different_showtimes` | EP |
| `test_a_seat_from_another_theater_is_rejected` | EP |
| `test_unknown_showtime_returns_404` | EP |
| `test_unknown_seat_returns_404` | EP |
| `test_empty_seat_list_is_rejected` | EP+BVA |
| `test_duplicate_seat_ids_are_rejected` | EP |
| `test_booking_requires_login` | EP |
| `test_cancelling_frees_the_seat_for_someone_else` | ST |
| `test_another_users_booking_looks_like_it_does_not_exist` | EP |

### A.5. `tests/api/test_auth.py`

| Test | Kỹ thuật |
|---|---|
| `test_register_creates_a_customer_and_never_returns_the_password` | EP |
| `test_a_registered_user_can_log_in_with_the_same_credentials` | ST |
| `test_register_rejects_an_email_that_is_already_taken` | EP |
| `test_a_client_cannot_choose_its_own_role_at_registration` | EP |
| `test_login_returns_a_token_that_identifies_the_user` | DT |
| `test_login_with_a_wrong_password_returns_401` | DT |
| `test_every_failed_login_looks_identical` (3) | DT |
| `test_me_returns_the_logged_in_user` | EP |
| `test_me_without_a_token_returns_401` | EP |
| `test_me_rejects_a_garbage_token` | EP |
| `test_me_rejects_an_expired_token` | EP |
| `test_me_rejects_a_token_signed_with_the_wrong_secret` | EP |
| `test_me_rejects_a_valid_token_for_a_user_that_no_longer_exists` | EP |
| `test_update_name_trims_whitespace` | EP |
| `test_update_name_rejects_a_blank_name` | EP+BVA |
| `test_update_name_requires_login` | EP |
| `test_changing_the_password_switches_which_password_logs_in` | DT+ST |
| `test_change_password_requires_the_correct_current_password` | DT |
| `test_change_password_rejects_reusing_the_current_password` | DT |
| `test_new_password_length_boundary` (3) | BVA+DT |
| `test_change_password_requires_login` | DT |

### A.6. `tests/api/test_authorization.py`

| Test | Kỹ thuật |
|---|---|
| `test_admin_endpoints_reject_anonymous_requests` (16) | DT |
| `test_admin_endpoints_reject_customers` (16) | DT |
| `test_a_token_claiming_to_be_admin_does_not_make_a_customer_admin` | DT |
| `test_admin_can_use_admin_endpoints` | DT |
| `test_browsing_endpoints_are_public` (4) | DT |
| `test_public_endpoints_do_not_change_for_logged_in_users` (8) | DT |
| `test_admin_passes_the_permission_gate_on_every_admin_endpoint` (16) | DT |

### A.7. `tests/api/test_admin_users.py`

| Test | Kỹ thuật |
|---|---|
| `test_admin_can_list_users_without_password_hashes` | EP |
| `test_admin_can_promote_a_customer` | DT+ST |
| `test_a_demoted_admin_loses_access_even_with_an_old_token` | DT+ST |
| `test_an_admin_cannot_remove_their_own_admin_role` | DT |
| `test_role_change_rejects_an_unknown_role` | EP |
| `test_role_change_for_an_unknown_user_returns_404` | EP |
| `test_an_admin_cannot_delete_their_own_account` | DT |
| `test_admin_can_delete_another_user` | DT |
| `test_deleting_an_unknown_user_returns_404` | EP |
| `test_deleting_a_user_also_deletes_their_bookings` | ST (characterization) |

### A.8. `tests/api/test_payments.py`

| Test | Kỹ thuật |
|---|---|
| `test_successful_payment_marks_the_booking_paid` | ST+EP |
| `test_payment_reference_is_prefixed_with_the_method` (3) | EP |
| `test_payment_amount_is_the_price_snapshot_not_the_current_price` | — |
| `test_a_declined_payment_keeps_the_booking_pending_and_the_seats_held` | ST+EP |
| `test_retrying_after_a_decline_succeeds_and_keeps_every_attempt` | ST |
| `test_paying_twice_is_rejected_and_charges_only_once` | ST |
| `test_a_cancelled_booking_cannot_be_paid` | ST |
| `test_paying_an_expired_booking_is_rejected_and_releases_the_seats` | ST |
| `test_a_paid_booking_past_its_hold_time_is_not_treated_as_expired` | DT+ST |
| `test_another_customer_cannot_pay_for_my_booking` | EP |
| `test_paying_requires_login` | EP |
| `test_paying_for_an_unknown_booking_returns_404` | EP |
| `test_an_unknown_payment_method_is_rejected` | EP |
| `test_a_paid_booking_cannot_be_cancelled` | ST |
| `test_a_booking_can_still_be_cancelled_after_a_declined_payment` | ST |
| `test_cancelling_twice_is_rejected` | ST |
| `test_payment_deadline_boundary` (2) | BVA+ST |

### A.9. `tests/api/test_booking_expiry.py`

| Test | Kỹ thuật |
|---|---|
| `test_expire_bookings_for_showtime` (4) | DT+ST |
| `test_expire_bookings_returns_how_many_it_expired` | EP |
| `test_expire_bookings_only_touches_the_given_showtime` | EP |
| `test_expire_booking_if_needed` (4) | DT+ST |
| `test_expire_booking_if_needed_ignores_an_unknown_booking` | EP |
| `test_seat_map_frees_expired_holds_but_keeps_live_ones` | ST |
| `test_a_seat_held_by_an_expired_booking_can_be_booked` | ST |
| `test_a_seat_held_by_a_live_booking_still_conflicts` | ST |
| `test_my_bookings_list_shows_expired_holds_as_cancelled` | ST |
| `test_a_single_booking_lookup_shows_an_expired_hold_as_cancelled` | ST |
| `test_my_bookings_list_leaves_a_paid_booking_alone_even_past_its_hold_time` | DT+ST |
| `test_hold_expiry_boundary` (3) | BVA |
| `test_a_hold_that_expired_but_was_not_cleaned_up_can_still_be_cancelled` | ST |

### A.10. `tests/api/test_showtimes_listing.py`

| Test | Kỹ thuật |
|---|---|
| `test_showtimes_come_back_in_start_time_order` | DT |
| `test_filter_by_theater` | DT |
| `test_filter_by_movie` | DT |
| `test_filters_combine` | DT |
| `test_filters_that_match_nothing_return_an_empty_list` | DT |
| `test_date_filter_uses_the_vietnam_calendar_day` (5) | BVA |
| `test_get_one_showtime` | EP |
| `test_unknown_showtime_returns_404` | EP |

### A.11. `tests/api/test_showtimes_admin.py`

| Test | Kỹ thuật |
|---|---|
| `test_admin_creates_a_showtime` | EP+DT |
| `test_price_and_format_have_defaults` | EP |
| `test_create_rejects_an_unknown_movie_or_theater` (2) | EP+DT |
| `test_create_rejects_an_unknown_format` | EP+DT |
| `test_update_changes_only_the_fields_sent` | EP |
| `test_update_rejects_an_unknown_movie` | EP |
| `test_update_of_an_unknown_showtime_returns_404` | EP |
| `test_batch_creates_every_row` | EP |
| `test_batch_is_all_or_nothing` | EP |
| `test_batch_with_a_schema_invalid_row_creates_nothing` | EP |
| `test_an_empty_batch_is_rejected` | EP+BVA |
| `test_a_showtime_with_an_active_booking_cannot_be_deleted` | DT |
| `test_a_movie_with_an_active_booking_cannot_be_deleted` | DT |
| `test_a_theater_with_an_active_booking_cannot_be_deleted` | DT |
| `test_a_showtime_without_bookings_can_be_deleted` | DT |
| `test_deleting_a_movie_without_bookings_removes_its_showtimes` | DT |
| `test_deleting_a_theater_without_bookings_removes_its_seats_and_showtimes` | DT |
| `test_a_showtime_whose_booking_was_cancelled_can_be_deleted` | DT+ST |
| `test_a_movie_whose_only_bookings_are_cancelled_can_be_deleted` | DT |
| `test_a_theater_whose_only_bookings_are_cancelled_can_be_deleted` | DT |
| `test_a_showtime_whose_abandoned_hold_was_cleaned_up_can_be_deleted` | DT+ST |
| `test_deleting_a_showtime_also_deletes_its_cancelled_bookings` | DT (characterization) |
| `test_showtime_price_boundary` (3) | BVA |

### A.12. `tests/api/test_showtime_seats.py`

| Test | Kỹ thuật |
|---|---|
| `test_seat_map_shows_type_price_and_availability` | DT |
| `test_seat_map_orders_seat_10_after_seat_9` | BVA |
| `test_seat_map_marks_only_the_booked_seats` | ST |
| `test_the_price_on_the_seat_map_is_the_price_charged` | DT |
| `test_seat_map_of_an_unknown_showtime_returns_404` | EP |
| `test_availability_route_is_not_shadowed_by_the_showtime_id_route` | — (regression) |
| `test_availability_requires_at_least_one_showtime_id` | EP+BVA |
| `test_availability_counts_every_seat_when_nothing_is_booked` | EP |
| `test_availability_drops_by_the_number_of_booked_seats` | EP |
| `test_availability_is_tracked_per_showtime` | EP |
| `test_a_live_unpaid_hold_counts_as_taken` | EP+ST |
| `test_availability_ignores_expired_holds` (xfail) | EP+ST |
| `test_availability_at_both_ends_of_the_range` (4) | BVA |
| `test_a_sold_out_showtime_rejects_new_bookings_and_shows_every_seat_booked` | BVA |

### A.13. `tests/api/test_theaters.py`

| Test | Kỹ thuật |
|---|---|
| `test_admin_creates_a_theater_with_no_seats_yet` | EP |
| `test_admin_updates_a_theater` | EP |
| `test_unknown_theater_returns_404` | EP |
| `test_rows_create_the_requested_number_of_seats` | EP |
| `test_seat_types_are_stored_and_reach_the_seat_map` | EP |
| `test_row_letters_are_normalised_to_uppercase` | EP |
| `test_an_existing_row_cannot_be_extended` | ST |
| `test_the_same_row_twice_in_one_request_is_rejected` | EP |
| `test_invalid_rows_are_rejected` (6) | EP+BVA |
| `test_one_invalid_row_rejects_the_whole_request` | EP |
| `test_adding_a_row_leaves_existing_seats_and_bookings_alone` | ST |

### A.14. `tests/api/test_movie_categories.py`

| Test | Kỹ thuật |
|---|---|
| `test_showing_lists_only_movies_with_a_future_showtime` | EP |
| `test_coming_soon_lists_only_movies_releasing_in_the_future` | EP (regression) |
| `test_without_a_category_every_movie_is_listed` | EP |
| `test_an_unknown_category_falls_back_to_every_movie` | EP (characterization) |
| `test_trending_is_empty_when_nothing_is_booked` | EP+BVA |
| `test_trending_ranks_movies_by_booked_seats` | EP |
| `test_trending_ignores_cancelled_bookings` | EP |
| `test_coming_soon_boundary_is_strictly_after_today` (3) | BVA |
| `test_trending_only_counts_the_last_fourteen_days` (2) | BVA |

### A.15. `tests/api/test_analytics.py`

| Test | Kỹ thuật |
|---|---|
| `test_headline_numbers` | DT |
| `test_cancellation_rate` | DT+BVA |
| `test_revenue_and_change_for_each_window` (7) | BVA |
| `test_bookings_change_compares_paid_bookings_with_the_previous_period` | EP |
| `test_daily_revenue_is_grouped_by_vietnam_day` | BVA |
| `test_top_movies_are_ranked_by_revenue` | EP |
| `test_top_movies_is_limited_to_the_five_highest_earners` | BVA |
| `test_revenue_by_format` | EP |
| `test_revenue_by_theater_is_ordered_highest_first` | EP |
| `test_revenue_by_seat_type_splits_each_booking_evenly_across_its_seats` | EP |
| `test_bookings_by_hour_use_vietnam_time` | BVA |
| `test_bookings_by_weekday_use_vietnam_time` | BVA |
| `test_every_breakdown_adds_up_to_the_total` | — (bất biến) |
| `test_a_window_with_no_data_returns_complete_zeroed_series` | EP+BVA |
| `test_a_reversed_range_is_rejected` | EP |
| `test_range_length_limit` (2) | BVA |
| `test_missing_or_malformed_dates_are_rejected` (4) | EP |

### A.16. `tests/api/test_showtime_performance.py`

| Test | Kỹ thuật |
|---|---|
| `test_showtimes_are_listed_busiest_first` | DT+BVA |
| `test_a_row_describes_its_showtime` | EP |
| `test_the_format_is_reported` | EP |
| `test_the_day_follows_vietnam_time` | BVA |
| `test_a_day_without_showtimes_is_an_empty_list` | BVA |
| `test_filter_by_theater` | DT |
| `test_filter_by_movie` | DT |
| `test_filters_combine` | DT |
| `test_filters_that_match_nothing_return_an_empty_list` | DT |
| `test_cancelling_a_booking_removes_it_from_the_booked_count` | ST |
| `test_occupancy_is_rounded_to_one_decimal` | BVA |
| `test_a_theater_without_seats_has_zero_occupancy_instead_of_crashing` | BVA |
| `test_the_date_is_required` | EP |

### A.17. `tests/api/test_movies_admin.py`

| Test | Kỹ thuật |
|---|---|
| `test_admin_creates_a_movie` | EP |
| `test_create_requires_title_and_duration` (2) | EP |
| `test_update_changes_only_the_fields_sent` | EP |
| `test_each_allowed_image_type_is_accepted_and_stored` (3) | EP |
| `test_other_file_types_are_rejected_and_nothing_is_stored` (3) | EP |
| `test_poster_size_limit_boundary` (2) | BVA |
| `test_replacing_a_poster_deletes_the_old_file` | ST |
| `test_deleting_a_movie_deletes_its_uploaded_poster` | ST |

### A.18. `tests/api/test_concurrency.py`

| Test | Kỹ thuật |
|---|---|
| `test_only_one_of_many_simultaneous_bookings_for_the_same_seat_wins` | EP+concurrency |
| `test_competing_multi_seat_bookings_are_all_or_nothing` | EP+concurrency |
| `test_a_loser_of_a_partial_overlap_does_not_keep_its_free_seat` | EP+concurrency |
| `test_bookings_for_different_seats_do_not_conflict` | EP+concurrency |
| `test_two_simultaneous_payments_for_one_booking_charge_only_once` | ST+concurrency |
| `test_paying_a_booking_that_was_cancelled_after_the_payment_request_loaded_it` | ST |
| `test_a_second_payment_that_loaded_the_booking_before_the_first_one_finished` | ST |
| `test_cancelling_a_booking_that_was_paid_after_the_cancel_request_loaded_it` | ST |
| `test_a_payment_that_landed_just_before_the_hold_ran_out_survives_the_cleanup` | ST |

### A.19. E2E (`e2e/tests/*.spec.js`)

| Test | Kỹ thuật |
|---|---|
| `a customer browses, picks seats, logs in, pays and sees the booking` | ST |
| `when two customers pick the same seat, the slower one is told it is taken` | ST |
| `a customer is bounced away from the admin area` | DT+EP |
| `an admin lands on Analytics and its queries run against real Postgres` | DT+EP |
| `a session the server no longer accepts logs the user out` | ST |
| `a hard load of a deep link still serves the app (nginx SPA fallback)` | EP |
| `the API is reachable through the nginx proxy` | — (hạ tầng) |
