-- 中国人大旧链接对自动访问不稳定，改用直接支持同一结论的国务院规划公开页。
UPDATE submission_revisions
SET source_url = 'https://www.mee.gov.cn/zcwj/gwywj/201811/t20181129_676510.shtml'
WHERE id = '61000000-0000-4000-8100-000000000005'::uuid
  AND source_url = 'https://www.npc.gov.cn/npc/c12434/c541/201905/t20190522_66666.html';
