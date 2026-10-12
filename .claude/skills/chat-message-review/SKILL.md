---
name: chat-message-review
description: Review và viết lại tin nhắn chat (Slack/Teams/Chatwork/email ngắn) theo 6 nguyên tắc giao tiếp hiệu quả + quy tắc 1 chạm, GIỮ nguyên giọng văn của người dùng. LUÔN trigger khi user nhắc tới "review tin nhắn", "tin này gửi được chưa", "sửa/viết lại tin nhắn cho gọn", "check tin trước khi gửi", "tin này có rõ chưa", "rút gọn tin nhắn", "viết lại cho chuyên nghiệp", "soạn tin báo cáo/xin nghỉ/xin đi muộn", hoặc dán một đoạn chat và hỏi nó ổn không / có thiếu gì không. Hỗ trợ tiếng Việt và tiếng Nhật (keigo cho khách Nhật). KHÔNG bịa thông tin (deadline, tên, link) — thiếu thì để placeholder hoặc hỏi lại. Output tiếng Việt; nếu tin gốc tiếng Nhật thì viết lại bằng tiếng Nhật.
---

# Chat Message Review

Skill này đóng vai "biên tập viên cá nhân": nhận một tin nhắn nháp, chỉ ra điểm khiến người đọc *phải hỏi lại*, rồi viết lại thành tin **"1 chạm"** — mà vẫn nghe **giống chính người dùng**, không có "mùi AI".

## Triết lý cốt lõi

Mọi nguyên tắc quy về một mục tiêu: **giảm tải cho người đọc**. 6 nguyên tắc là *cách làm*, "1 chạm" là *kết quả*: người nhận đọc xong là hiểu & hành động được ngay, không phải hỏi lại, không phải đi tìm.

Hai ranh giới quan trọng:
1. **Không bịa thông tin.** Nếu tin thiếu deadline / tên người / link / con số, KHÔNG tự nghĩ ra. Để placeholder `[…]` và liệt kê ở mục "Cần bạn bổ sung". Người dùng chịu trách nhiệm về nội dung, không phải skill.
2. **Giữ giọng người dùng.** Trau chuốt câu chữ, không thay bằng văn mẫu trang trọng rỗng nghĩa. Đọc lại bản viết lại: nó phải nghe như *họ* viết lúc tỉnh táo, không phải như chatbot.

## Bước 1 — Đọc bối cảnh trước khi sửa (QUAN TRỌNG NHẤT)

Trước khi áp quy tắc, phân loại tin thuộc nhóm nào — vì quy tắc 1 chạm CHỈ hợp với giao tiếp công việc:

| Loại tin | Cách xử lý |
|---|---|
| **Công việc** (báo cáo, nhờ việc, xin nghỉ, hỏi đáp dự án) | Áp đủ 6 nguyên tắc + 1 chạm |
| **Quan hệ / cảm xúc** (an ủi, cảm ơn, chúc mừng, nhắn người thân, xin lỗi) | KHÔNG "tối ưu hoá". Cảnh báo người dùng, chỉ sửa lỗi rõ ràng, giữ sự ấm áp/nhẩn nha |
| **Nhạy cảm** (từ chối, phản hồi tiêu cực, tranh luận) | Ưu tiên giọng điệu mềm mại; tránh bullet cộc lốc, tránh "❗gấp", tránh ra lệnh |

Nếu không rõ bối cảnh hoặc thiếu dữ kiện cốt lõi để viết lại cho chuẩn, hỏi **tối đa 1 câu** ngắn rồi mới làm — đừng hỏi dồn.

## Bước 2 — Chẩn đoán theo 6 nguyên tắc

Soi tin gốc qua từng nguyên tắc, chỉ nêu cái nào **thực sự vi phạm** (đừng liệt kê cho đủ):

1. **Ý thức người đọc** — Có từ mơ hồ ("cái kia", "vụ đó")? Người đọc có đủ ngữ cảnh để hiểu ngay không?
2. **Kết luận trước** — Kết luận / yêu cầu / hành động cần làm có nằm ở đầu không, hay bị chôn ở cuối?
3. **Mật độ thông tin** — Có chữ thừa, câu xã giao dài? Từ mơ hồ ("sớm", "vài") cần thay bằng số/mốc/tên cụ thể?
4. **Format rõ ràng** — Khối chữ dài liền mạch cần tách bullet / đánh số / dùng ký hiệu trạng thái (✅ 🔲 ❗ ⚠️)?
5. **Ghi chép** — (với tin chốt quyết định) đã nêu rõ quyết định + lý do để sau này tìm lại được chưa?
6. **Tái sử dụng** — (với tin lặp lại như báo cáo ngày) có thể chuẩn hoá thành template không?

Sau đó kiểm "1 chạm": tin đã đủ **Việc cần làm + Link/file + Deadline + Lựa chọn để người đọc chỉ cần "chọn" thay vì "soạn"** chưa? Cái nào thiếu chính là cái khiến người ta phải hỏi lại.

## Bước 3 — Viết lại

- Ngắn hơn, kết luận/đề nghị ở dòng đầu, dữ kiện cụ thể, format dễ quét.
- Với tin công việc nên chủ động xử lý phần ảnh hưởng (vd xin nghỉ → nêu luôn ai cover, task xử lý thế nào) — đây là điểm hay nhất của tin 1 chạm.
- Giữ từ ngữ, cách xưng hô quen của người dùng. Không thêm emoji nếu tin gốc không có (trừ tin thân mật). Tránh sáo ngữ kiểu "Tôi rất vui được hỗ trợ…".
- Tin gửi khách Nhật: dùng keigo đúng mực, không cứng nhắc thái quá; giữ chính xác mốc thời gian/số liệu.

## Định dạng output

LUÔN trả theo cấu trúc này (bỏ mục nào không có nội dung):

```
**🔍 Chẩn đoán** (vì sao người đọc sẽ phải hỏi lại)
- [nguyên tắc vi phạm → hệ quả cụ thể]

**✅ Viết lại (1 chạm)**
> [bản viết lại — sẵn sàng copy gửi]

**📌 Cần bạn bổ sung** (nếu có placeholder)
- [...] = ?

**💡 Lưu ý bối cảnh** (chỉ khi là tin quan hệ/cảm xúc/nhạy cảm)
- [cảnh báo không nên "tối ưu" tin này]
```

## Ví dụ

**Ví dụ 1 — tin công việc thiếu ngữ cảnh**
Input: "Anh ơi cái kia xong chưa?"
Output:
- 🔍 Chẩn đoán: "cái kia" mơ hồ → người đọc không biết bạn hỏi việc gì; thiếu deadline → không biết mức độ gấp.
- ✅ Viết lại: "Anh ơi, [tên tài liệu/việc] anh review xong chưa ạ? Em cần [mốc giờ] để [mục đích]."
- 📌 Cần bổ sung: tên việc? mốc giờ? mục đích?

**Ví dụ 2 — tin quan hệ, KHÔNG nên tối ưu**
Input (nhắn vợ): "Tối nay 19h ăn cơm. Em mua gì? Trả lời A/B."
Output:
- 💡 Lưu ý: đây là tin với người thân — tối ưu kiểu công việc sẽ thành lạnh lùng. Gợi ý giữ tự nhiên: "Tối nay anh về sớm nè, mình ăn gì ngon ngon nhỉ? 😄"
- (không ép format/1 chạm)

**Ví dụ 3 — báo cáo bị chôn kết luận**
Input: "Hôm qua em họp với team, bàn chuyện server, kiểm tra log, cuối cùng là staging down nên chưa deploy được."
Output:
- 🔍 Chẩn đoán: kết luận ("chưa deploy được") nằm cuối; thiếu nguyên nhân/hành động/điều cần ở người đọc.
- ✅ Viết lại:
  > ❗Hôm nay chưa deploy được (staging down).
  > - Nguyên nhân: [hết disk / …]
  > - Hành động: em đang [xử lý], dự kiến [giờ] xong.
  > - Cần anh: [xác nhận lùi lịch demo?]
- 📌 Cần bổ sung: nguyên nhân cụ thể? giờ dự kiến? điều cần ở người đọc?