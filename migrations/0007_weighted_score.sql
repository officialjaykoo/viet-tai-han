-- Scale scores to millipoints so fractional vote weights can apply as integers.
-- 100 millipoints ≈ 1 displayed point.
UPDATE posts SET score = score * 100;
UPDATE comments SET score = score * 100;
