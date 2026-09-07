-- V1.1 broad taxonomy: 12 public domains, 48 editorial topics, 165 planned nodes.
-- This seed upgrades the original five-track prototype without discarding existing content.

UPDATE knowledge_domains
SET slug = 'geography', name = '地理', description = '理解空间、区域、资源与人地关系。', sort_order = 10
WHERE id = '10000000-0000-4000-8000-000000000001';

UPDATE knowledge_domains
SET slug = 'history-civilization', name = '历史与文明', description = '理解历史证据、文明演变与现代转型。', sort_order = 20
WHERE id = '10000000-0000-4000-8000-000000000002';

UPDATE knowledge_domains
SET slug = 'economy-finance', name = '经济金融', description = '理解经济运行、个人财务、商业与就业。', sort_order = 40
WHERE id = '10000000-0000-4000-8000-000000000003';

INSERT INTO knowledge_domains (id, slug, name, description, sort_order)
VALUES
  ('10000000-0000-4000-8000-000000000004', 'society-law', '政治法律与社会制度', '理解政府、法律、公共服务与社会协作。', 30),
  ('10000000-0000-4000-8000-000000000005', 'math-logic', '数学统计与逻辑', '理解数字、概率、推理与数据表达。', 50),
  ('10000000-0000-4000-8000-000000000006', 'natural-science', '物理化学生物', '理解物质、生命、地球、宇宙与环境。', 60),
  ('10000000-0000-4000-8000-000000000007', 'health-safety', '健康与生活风险', '理解身体、健康习惯、心理与急救安全。', 70),
  ('10000000-0000-4000-8000-000000000008', 'computer-security', '计算机与数字安全', '理解互联网、隐私、网络风险、AI 与数据。', 80),
  ('10000000-0000-4000-8000-000000000009', 'engineering-infrastructure', '工程与基础设施', '理解建筑、能源、交通、通信与城市系统。', 90),
  ('10000000-0000-4000-8000-000000000010', 'language-communication', '语言表达与沟通', '理解阅读、写作、论证、沟通与媒介。', 100),
  ('10000000-0000-4000-8000-000000000011', 'culture-daily-life', '文化艺术与日常生活', '理解文学、艺术、影像与生活文化。', 110),
  ('10000000-0000-4000-8000-000000000012', 'current-affairs-context', '时事背景与世界格局', '理解国家、国际组织、公共指标与事件背景。', 120)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Reuse the five prototype topic IDs so all old foreign-key references remain valid.
UPDATE topics SET domain_id = '10000000-0000-4000-8000-000000000001', slug = 'earth-and-maps', name = '地球与地图', description = '地球位置、地图表达、经纬度与时间。', v1_target_count = 5
WHERE id = '20000000-0000-4000-8000-000000000001';
UPDATE topics SET domain_id = '10000000-0000-4000-8000-000000000001', slug = 'china-geography', name = '中国区域地理', description = '中国位置、地形、区划、人口与区域差异。', v1_target_count = 6
WHERE id = '20000000-0000-4000-8000-000000000002';
UPDATE topics SET domain_id = '10000000-0000-4000-8000-000000000002', slug = 'ancient-china', name = '中国古代史', description = '古代中国的朝代、制度、交流与关键转折。', v1_target_count = 7
WHERE id = '20000000-0000-4000-8000-000000000003';
UPDATE topics SET domain_id = '10000000-0000-4000-8000-000000000003', slug = 'economic-basics', name = '经济学基础', description = '供需、成本、激励、市场与基本经济概念。', v1_target_count = 4
WHERE id = '20000000-0000-4000-8000-000000000004';
UPDATE topics SET domain_id = '10000000-0000-4000-8000-000000000004', slug = 'government-and-policy', name = '政府、治理与公共政策', description = '政府职能、政策工具、执行与结果。', v1_target_count = 4
WHERE id = '20000000-0000-4000-8000-000000000005';

INSERT INTO topics (id, domain_id, slug, name, description, v1_target_count)
VALUES
  ('22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'world-regions', '世界区域与空间', '大洲、大洋、人口与世界区域框架。', 5),
  ('22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'climate-and-earth-systems', '气候、资源与地球系统', '气候、资源、板块与地球环境系统。', 4),
  ('22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'historical-method', '史料与历史方法', '时间线、史料证据、因果与历史解释。', 3),
  ('22000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'modern-china', '中国近现代史', '近现代中国的重要转型、制度与社会变化。', 5),
  ('22000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'world-civilizations', '世界文明与现代转型', '主要文明、交流网络与现代世界的形成。', 5),
  ('22000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004', 'law-and-rights', '法律、权利与责任', '法律体系、基本权利、义务与责任。', 4),
  ('22000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000004', 'public-services-and-security', '公共服务与社会保障', '公共物品、财政、公共服务与社会保障。', 4),
  ('22000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', 'social-cooperation', '社会协作与共同问题', '外部性、信息差、集体行动与社会信任。', 3),
  ('22000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000003', 'macroeconomy', '宏观经济与政策', 'GDP、通胀、利率、财政与货币政策。', 5),
  ('22000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000003', 'personal-finance', '个人财务常识', '储蓄、借贷、利息、风险与长期财务选择。', 3),
  ('22000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000003', 'business-trade-and-work', '商业、贸易与就业', '企业、贸易、劳动市场与就业指标。', 3),
  ('22000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000005', 'numbers-and-estimation', '数字、单位与估算', '数量级、比例、单位换算与合理估算。', 3),
  ('22000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000005', 'probability-and-statistics', '概率与统计', '概率、抽样、平均数、分布与不确定性。', 3),
  ('22000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000005', 'logic-and-reasoning', '逻辑与推理', '命题、因果、证据与常见推理错误。', 3),
  ('22000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000005', 'data-literacy', '数据与图表阅读', '图表、指标、口径与数据误读。', 3),
  ('22000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000006', 'physics-basics', '物理基础', '运动、力、能量、热、光与电的基础规律。', 4),
  ('22000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000006', 'chemistry-and-materials', '化学与材料', '原子、分子、反应、材料与物质变化。', 4),
  ('22000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000006', 'biology-and-evolution', '生命与演化', '细胞、遗传、演化、生态与生命系统。', 4),
  ('22000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000006', 'earth-and-space', '地球与宇宙', '地球结构、天体运动、恒星与宇宙尺度。', 3),
  ('22000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000006', 'energy-and-environment', '能源与环境科学', '能源转换、污染、生态与气候科学。', 3),
  ('22000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000007', 'body-and-medicine', '人体与医学常识', '身体系统、疾病、诊疗与医学证据基础。', 4),
  ('22000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000007', 'nutrition-activity-sleep', '营养、运动与睡眠', '饮食、活动、恢复与健康习惯。', 4),
  ('22000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000007', 'mental-health-and-cognition', '心理健康与认知', '情绪、压力、认知偏差与求助常识。', 3),
  ('22000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000007', 'safety-and-first-aid', '安全与急救', '日常风险识别、应急反应与急救原则。', 4),
  ('22000000-0000-4000-8000-000000000025', '10000000-0000-4000-8000-000000000008', 'computer-and-internet', '计算机与互联网基础', '计算设备、网络、网站与互联网服务。', 3),
  ('22000000-0000-4000-8000-000000000026', '10000000-0000-4000-8000-000000000008', 'privacy-and-accounts', '隐私与账号安全', '个人信息、密码、权限与账号保护。', 3),
  ('22000000-0000-4000-8000-000000000027', '10000000-0000-4000-8000-000000000008', 'cybersecurity-and-scams', '网络安全与诈骗识别', '恶意软件、钓鱼、诈骗与安全处置。', 3),
  ('22000000-0000-4000-8000-000000000028', '10000000-0000-4000-8000-000000000008', 'ai-and-data-systems', 'AI 与数据系统', '算法、训练数据、模型能力与局限。', 3),
  ('22000000-0000-4000-8000-000000000029', '10000000-0000-4000-8000-000000000009', 'buildings-and-manufacturing', '建筑与制造', '结构、材料、制造过程与质量安全。', 2),
  ('22000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-000000000009', 'electricity-infrastructure', '电力与能源设施', '发电、电网、供能与基础设施可靠性。', 3),
  ('22000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000009', 'water-transport-cities', '水、交通与城市系统', '供排水、道路、交通与城市运行。', 3),
  ('22000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000009', 'communication-and-logistics', '通信与物流', '信息传输、仓储、配送与供应网络。', 2),
  ('22000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000010', 'reading-and-writing', '阅读与写作', '文本结构、信息提取与清晰表达。', 3),
  ('22000000-0000-4000-8000-000000000034', '10000000-0000-4000-8000-000000000010', 'argument-and-explanation', '论证与解释', '观点、理由、证据、反例与解释结构。', 3),
  ('22000000-0000-4000-8000-000000000035', '10000000-0000-4000-8000-000000000010', 'communication-and-negotiation', '沟通与协商', '倾听、反馈、冲突处理与协商。', 2),
  ('22000000-0000-4000-8000-000000000036', '10000000-0000-4000-8000-000000000010', 'media-literacy', '媒介与信息理解', '消息来源、传播机制、事实与观点。', 2),
  ('22000000-0000-4000-8000-000000000037', '10000000-0000-4000-8000-000000000011', 'literature-and-narrative', '文学与叙事', '文学体裁、叙事方法与作品理解。', 2),
  ('22000000-0000-4000-8000-000000000038', '10000000-0000-4000-8000-000000000011', 'visual-art-and-design', '视觉艺术与设计', '视觉语言、构图、设计与艺术观看。', 2),
  ('22000000-0000-4000-8000-000000000039', '10000000-0000-4000-8000-000000000011', 'music-performance-film', '音乐、表演与影像', '音乐、戏剧、电影与视听表达。', 3),
  ('22000000-0000-4000-8000-000000000040', '10000000-0000-4000-8000-000000000011', 'daily-culture-and-customs', '日常文化与生活方式', '习俗、饮食、节日与生活方式差异。', 3),
  ('22000000-0000-4000-8000-000000000041', '10000000-0000-4000-8000-000000000012', 'countries-and-organizations', '国家与国际组织', '国家制度、国际组织与跨国协作框架。', 3),
  ('22000000-0000-4000-8000-000000000042', '10000000-0000-4000-8000-000000000012', 'public-indicators', '公共数据与指标', '人口、经济、健康与发展指标的口径。', 2),
  ('22000000-0000-4000-8000-000000000043', '10000000-0000-4000-8000-000000000012', 'events-and-background', '事件脉络与背景', '把新闻事件放回时间、地理与制度背景。', 3)
ON CONFLICT (id) DO UPDATE SET
  domain_id = EXCLUDED.domain_id,
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  v1_target_count = EXCLUDED.v1_target_count,
  is_active = true;

-- Existing published knowledge is assigned from its stable catalog slug.
UPDATE knowledge_nodes AS kn
SET topic_id = t.id
FROM topics AS t
WHERE t.slug = CASE
  WHEN kn.slug IN ('latitude-longitude', 'time-zones') THEN 'earth-and-maps'
  WHEN kn.slug IN ('seven-continents', 'five-oceans', 'population-density') THEN 'world-regions'
  WHEN kn.slug IN ('china-terrain-steps', 'china-administrative-levels', 'monsoon-climate') THEN 'china-geography'
  WHEN kn.slug = 'climate-and-weather' THEN 'climate-and-earth-systems'
  WHEN kn.slug = 'dynasty-and-era' THEN 'historical-method'
  WHEN kn.slug IN ('qin-unification', 'silk-road', 'imperial-examination') THEN 'ancient-china'
  WHEN kn.slug = 'industrial-revolution' THEN 'world-civilizations'
  WHEN kn.slug IN ('gdp', 'inflation') THEN 'macroeconomy'
  WHEN kn.slug = 'interest-rate' THEN 'personal-finance'
  WHEN kn.slug = 'unemployment-rate' THEN 'business-trade-and-work'
  WHEN kn.slug IN ('public-goods', 'tax-and-fiscal-spending') THEN 'public-services-and-security'
  ELSE NULL
END;

-- Existing sample and editorial candidates are also assigned automatically.
UPDATE submissions AS s
SET topic_id = t.id
FROM topics AS t
WHERE t.slug = CASE
  WHEN s.proposed_slug IN ('map-projection') THEN 'earth-and-maps'
  WHEN s.proposed_slug IN ('plate-tectonics', 'south-north-water-resources') THEN 'climate-and-earth-systems'
  WHEN s.proposed_slug IN ('china-location', 'china-terrain-types') THEN 'china-geography'
  WHEN s.proposed_slug IN ('historical-evidence') THEN 'historical-method'
  WHEN s.proposed_slug IN ('population-southward', 'sui-unification') THEN 'ancient-china'
  WHEN s.proposed_slug IN ('nominal-and-real', 'monetary-policy', 'fiscal-policy') THEN 'macroeconomy'
  WHEN s.proposed_slug IN ('policy-goal-tool-result') THEN 'government-and-policy'
  WHEN s.proposed_slug IN ('externalities', 'information-asymmetry') THEN 'social-cooperation'
  WHEN s.id IN ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000010') THEN 'world-regions'
  WHEN s.id IN ('50000000-0000-4000-8000-000000000002') THEN 'china-geography'
  WHEN s.id IN ('50000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000008') THEN 'historical-method'
  WHEN s.id IN ('50000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000014') THEN 'macroeconomy'
  WHEN s.id IN ('50000000-0000-4000-8000-000000000006') THEN 'public-services-and-security'
  WHEN s.id IN ('50000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000013') THEN 'earth-and-maps'
  WHEN s.id IN ('50000000-0000-4000-8000-000000000012') THEN 'government-and-policy'
  ELSE NULL
END;
