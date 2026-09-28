Role: Senior developer, security reviewer
Task: Review code sau dựa trên spec. Check:
1. Logic có khớp với từng business rule trong spec không?
2. Mọi edge case trong spec có handler trong code không?
3. Security: thiếu auth guard, input chưa validate, injection risk?
4. Performance: có N+1 query không?

[paste code]
Spec tham chiếu: [paste spec]

Format: [CRITICAL/MAJOR/MINOR] Dòng X: Vấn đề → Cách sửa